using CCMS.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Razorpay.Api;

namespace CCMS.Infrastructure.Services;

public class RazorpayService : IRazorpayService
{
    private readonly RazorpayClient _client;
    private readonly string _webhookSecret;
    private readonly ILogger<RazorpayService> _logger;

    public RazorpayService(IConfiguration configuration, ILogger<RazorpayService> logger)
    {
        _logger = logger;

        var keyId = configuration["Razorpay:KeyId"]
            ?? throw new InvalidOperationException("Razorpay:KeyId not configured");
        var keySecret = configuration["Razorpay:KeySecret"]
            ?? throw new InvalidOperationException("Razorpay:KeySecret not configured");
        _webhookSecret = configuration["Razorpay:WebhookSecret"] ?? string.Empty;

        _client = new RazorpayClient(keyId, keySecret);
    }

    public async Task<RazorpayOrderResult> CreateOrderAsync(decimal amount, string currency, string receipt)
    {
        // Razorpay expects amount in smallest currency unit (paise for INR)
        var amountInPaise = (int)(amount * 100);

        var options = new Dictionary<string, object>
        {
            { "amount", amountInPaise },
            { "currency", currency },
            { "receipt", receipt },
            { "payment_capture", 1 } // Auto-capture
        };

        var order = await Task.Run(() => _client.Order.Create(options));

        var orderId = (string)order["id"].ToString();
        var orderStatus = (string)order["status"].ToString();

        _logger.LogInformation("Razorpay order created: {OrderId} for amount {Amount} {Currency}",
            orderId, amount, currency);

        return new RazorpayOrderResult
        {
            OrderId = orderId,
            Amount = amount,
            Currency = currency,
            Status = orderStatus
        };
    }

    public bool VerifyPaymentSignature(string orderId, string paymentId, string signature)
    {
        var attributes = new Dictionary<string, string>
        {
            { "razorpay_order_id", orderId },
            { "razorpay_payment_id", paymentId },
            { "razorpay_signature", signature }
        };

        try
        {
            Utils.verifyPaymentSignature(attributes);
            return true;
        }
        catch (Razorpay.Api.Errors.SignatureVerificationError)
        {
            _logger.LogWarning("Payment signature verification failed for order {OrderId}, payment {PaymentId}",
                orderId, paymentId);
            return false;
        }
    }

    public async Task<string> CapturePaymentAsync(string paymentId, decimal amount)
    {
        var amountInPaise = (int)(amount * 100);

        var payment = await Task.Run(() =>
        {
            var p = _client.Payment.Fetch(paymentId);
            return p.Capture(new Dictionary<string, object> { { "amount", amountInPaise } });
        });

        var status = (string)payment["status"].ToString();
        _logger.LogInformation("Payment captured: {PaymentId} for amount {Amount}", paymentId, amount);
        return status;
    }

    public async Task<RazorpayRefundResult> InitiateRefundAsync(string paymentId, decimal amount)
    {
        var amountInPaise = (int)(amount * 100);

        var refund = await Task.Run(() =>
        {
            var payment = _client.Payment.Fetch(paymentId);
            return payment.Refund(new Dictionary<string, object> { { "amount", amountInPaise } });
        });

        var refundId = (string)refund["id"].ToString();
        var refundStatus = (string)refund["status"].ToString();

        _logger.LogInformation("Refund initiated for payment {PaymentId}, amount {Amount}", paymentId, amount);

        return new RazorpayRefundResult
        {
            RefundId = refundId,
            Amount = amount,
            Status = refundStatus
        };
    }

    public async Task<RazorpayRefundStatusResult> GetRefundStatusAsync(string paymentId, string refundId)
    {
        var refund = await Task.Run(() =>
        {
            var payment = _client.Payment.Fetch(paymentId);
            return payment.FetchRefund(refundId);
        });

        return new RazorpayRefundStatusResult
        {
            RefundId = (string)refund["id"].ToString(),
            Status = (string)refund["status"].ToString(),
            Amount = decimal.Parse(refund["amount"].ToString()) / 100m
        };
    }

    public async Task<RazorpayVirtualAccountResult> CreateVirtualAccountAsync(string orderId, string description)
    {
        var options = new Dictionary<string, object>
        {
            { "receivers", new Dictionary<string, object>
                {
                    { "types", new[] { "bank_account" } }
                }
            },
            { "description", description },
            { "close_by", DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds() },
            { "order_id", orderId }
        };

        var virtualAccount = await Task.Run(() => _client.VirtualAccount.Create(options));

        var vaId = (string)virtualAccount["id"].ToString();
        var receivers = virtualAccount["receivers"] as Newtonsoft.Json.Linq.JArray;
        var bankAccount = receivers?[0];
        var accountNumber = bankAccount?["account_number"]?.ToString() ?? string.Empty;
        var ifsc = bankAccount?["ifsc"]?.ToString() ?? string.Empty;

        _logger.LogInformation("Virtual account created: {VaId} for order {OrderId}", vaId, orderId);

        return new RazorpayVirtualAccountResult
        {
            VirtualAccountId = vaId,
            AccountNumber = accountNumber,
            Ifsc = ifsc,
            Status = (string)virtualAccount["status"].ToString()
        };
    }
}
