using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CCMS.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CCMS.Infrastructure.Services;

/// <summary>
/// SMS service implementation using ComBirds/Edumarc API
/// </summary>
public class SmsService : ISmsService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SmsService> _logger;
    private readonly string _apiKey;
    private readonly string _senderId;
    private readonly string _templateId;
    private readonly string _baseUrl;
    private readonly string _userId;
    private readonly string _password;
    private readonly bool _useDevelopmentMode;

    // Indian mobile number pattern: starts with 6-9, followed by 9 digits
    private static readonly Regex IndianMobileRegex = new(@"^[6-9]\d{9}$", RegexOptions.Compiled);

    // OTP message template registered with DLT
    // Template: Dear {#var#} user, your OTP for login is: {#var#}. This code is valid for 2 minutes. OTP is confidential. Do not share it with anyone. - EDUMARC
    // Variables: {#var#} = "Pixelspot", {#var#} = OTP code
    // The message must be sent with variables already substituted
    private const string OtpMessageTemplate = "Dear {0} user, your OTP for login is: {1}. This code is valid for 2 minutes. OTP is confidential. Do not share it with anyone. - EDUMARC";
    private const string BrandName = "Pixelspot";

    public SmsService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<SmsService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("ComBirds");
        _logger = logger;
        
        // Development mode: logs OTP instead of sending via SMS gateway
        _useDevelopmentMode = configuration.GetValue<bool>("ComBirds:DevelopmentMode", false);
        
        _apiKey = configuration["ComBirds:ApiKey"] ?? string.Empty;
        _senderId = configuration["ComBirds:SenderId"] ?? "EDUMRC";
        _templateId = configuration["ComBirds:TemplateId"] ?? string.Empty;
        _baseUrl = configuration["ComBirds:BaseUrl"] ?? "https://smsapi.edumarcsms.com/api/v1";
        _userId = configuration["ComBirds:UserId"] ?? string.Empty;
        _password = configuration["ComBirds:Password"] ?? string.Empty;
        
        // Only validate credentials if not in development mode
        if (!_useDevelopmentMode)
        {
            if (string.IsNullOrEmpty(_apiKey))
                throw new InvalidOperationException("ComBirds:ApiKey not configured");
            if (string.IsNullOrEmpty(_templateId))
                throw new InvalidOperationException("ComBirds:TemplateId not configured");
        }
    }

    public async Task<bool> SendOtpAsync(string phoneNumber, string otp)
    {
        try
        {
            // Normalize and validate phone number
            var normalizedPhone = NormalizePhoneNumber(phoneNumber);
            if (!ValidatePhoneNumber(normalizedPhone))
            {
                _logger.LogWarning("Invalid phone number format: {PhoneNumber}", phoneNumber);
                return false;
            }

            // Development mode: just log the OTP
            if (_useDevelopmentMode)
            {
                _logger.LogWarning(
                    "[DEVELOPMENT MODE] OTP for {PhoneNumber}: {Otp} - Not actually sent via SMS",
                    MaskPhoneNumber(normalizedPhone), otp);
                return true;
            }

            // Build DLT compliant message using registered template
            // Substitute variables into the template message
            var message = string.Format(OtpMessageTemplate, BrandName, otp);

            // Build the payload matching the structure in ComBirdsSmsSender.cs
            object requestBody;
            if (!string.IsNullOrWhiteSpace(_userId) && !string.IsNullOrWhiteSpace(_password))
            {
                requestBody = new
                {
                    apiKey = _apiKey,
                    userId = _userId,
                    password = _password,
                    senderId = _senderId,
                    header = _senderId,
                    templateId = _templateId,
                    number = normalizedPhone,
                    mobile = normalizedPhone,
                    message = message
                };
            }
            else
            {
                requestBody = new
                {
                    apiKey = _apiKey,
                    senderId = _senderId,
                    header = _senderId,
                    templateId = _templateId,
                    number = normalizedPhone,
                    mobile = normalizedPhone,
                    message = message
                };
            }

            _logger.LogInformation(
                "Sending OTP to {PhoneNumber} via Edumarc API. SenderId: {SenderId}, TemplateId: {TemplateId}",
                MaskPhoneNumber(normalizedPhone), _senderId, _templateId);

            var jsonContent = JsonSerializer.Serialize(requestBody);
            _logger.LogDebug("SMS API Request body: {RequestBody}", jsonContent);
            
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            
            // Add API key header and Bearer token for backward compatibility
            var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/sendsms")
            {
                Content = content
            };
            request.Headers.TryAddWithoutValidation("apikey", _apiKey);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_apiKey}");

            var response = await _httpClient.SendAsync(request);
            var responseContent = await response.Content.ReadAsStringAsync();

            _logger.LogInformation(
                "SMS API Response - Status: {StatusCode}, Body: {ResponseBody}",
                response.StatusCode, responseContent);

            if (response.IsSuccessStatusCode && IsSuccessResponse(responseContent))
            {
                _logger.LogInformation(
                    "OTP sent successfully to {PhoneNumber}. Response: {Response}", 
                    MaskPhoneNumber(normalizedPhone), responseContent);
                return true;
            }

            _logger.LogError(
                "Failed to send OTP to {PhoneNumber}. Status: {StatusCode}, Response: {Response}",
                MaskPhoneNumber(normalizedPhone), response.StatusCode, responseContent);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending OTP to {PhoneNumber}", MaskPhoneNumber(phoneNumber));
            return false;
        }
    }

    public bool ValidatePhoneNumber(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            return false;

        var normalized = NormalizePhoneNumber(phoneNumber);
        return IndianMobileRegex.IsMatch(normalized);
    }

    public string NormalizePhoneNumber(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            return string.Empty;

        // Remove all non-digit characters
        var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());

        // Handle +91 prefix
        if (digitsOnly.StartsWith("91") && digitsOnly.Length == 12)
        {
            digitsOnly = digitsOnly[2..];
        }
        // Handle 0 prefix (trunk code)
        else if (digitsOnly.StartsWith("0") && digitsOnly.Length == 11)
        {
            digitsOnly = digitsOnly[1..];
        }

        return digitsOnly;
    }

    #region Private Methods

    private bool IsSuccessResponse(string response)
    {
        // Check for success indicators in Edumarc/ComBirds response
        // Response format: { "success": true, "data": { "msg": "...", "transactionId": "..." } }
        return response.Contains("\"success\": true", StringComparison.OrdinalIgnoreCase) ||
               response.Contains("\"success\":true", StringComparison.OrdinalIgnoreCase) ||
               response.Contains("\"status\":\"success\"", StringComparison.OrdinalIgnoreCase) ||
               response.Contains("SMS Submitted", StringComparison.OrdinalIgnoreCase) ||
               response.Contains("Message Sent", StringComparison.OrdinalIgnoreCase);
    }

    private static string MaskPhoneNumber(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber) || phoneNumber.Length < 6)
            return "***";
        
        return $"{phoneNumber[..3]}****{phoneNumber[^3..]}";
    }

    #endregion
}
