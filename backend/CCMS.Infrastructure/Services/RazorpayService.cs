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

        // The null-coalescing checks above miss the case that actually happens in
        // practice: the keys present but EMPTY (appsettings ships "" and the env vars
        // are unset). That builds a client which authenticates against Razorpay with
        // blank credentials and only fails deep inside the first real call, as an
        // opaque "Authentication failed" — which is how every booking approval came to
        // return a 500. Warn loudly instead of throwing, because the service is
        // constructed by DI for handlers that legitimately skip payment entirely while
        // Payments:RequirePrepayment is false; throwing here would break those too.
        if (string.IsNullOrWhiteSpace(keyId) || string.IsNullOrWhiteSpace(keySecret))
        {
            _logger.LogWarning(
                "Razorpay credentials are not configured (Razorpay:KeyId / Razorpay:KeySecret are empty). "
                + "Any operation that actually contacts Razorpay — creating an order, verifying a payment, "
                + "issuing a refund — will fail with 'Authentication failed' until they are set. This is "
                + "expected while Payments:RequirePrepayment is false and no payment is being collected.");
        }

        _client = new RazorpayClient(keyId, keySecret);
    }

    public async Task<RazorpayOrderResult> CreateOrderAsync(decimal amount, string currency, string receipt)
    {
        // Defensive amount validation — this service is the last line of defence before money moves.
        if (amount <= 0m)
            throw new ArgumentException("Amount must be positive", nameof(amount));
        if (amount > 1_000_000m)
            throw new ArgumentException("Amount exceeds maximum allowed", nameof(amount));
        if (decimal.Round(amount, 2) != amount)
            throw new ArgumentException("Amount must have at most 2 decimal places", nameof(amount));
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Currency is required", nameof(currency));

        // Razorpay expects amount in smallest currency unit (paise for INR). Use a checked cast so
        // any overflow throws instead of wrapping silently — and round defensively before scaling.
        var amountInPaise = checked((int)(decimal.Round(amount, 2) * 100m));

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
