namespace CCMS.Application.Interfaces;

public class RazorpayOrderResult
{
    public string OrderId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = string.Empty;
}

public class RazorpayRefundResult
{
    public string RefundId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class RazorpayRefundStatusResult
{
    public string RefundId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // "pending" | "processed" | "failed"
    public decimal Amount { get; set; }
}

public class RazorpayVirtualAccountResult
{
    public string VirtualAccountId { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Ifsc { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public interface IRazorpayService
{
    Task<RazorpayOrderResult> CreateOrderAsync(decimal amount, string currency, string receipt);
    bool VerifyPaymentSignature(string orderId, string paymentId, string signature);
    Task<string> CapturePaymentAsync(string paymentId, decimal amount);
    Task<RazorpayRefundResult> InitiateRefundAsync(string paymentId, decimal amount);
    Task<RazorpayRefundStatusResult> GetRefundStatusAsync(string paymentId, string refundId);
    Task<RazorpayVirtualAccountResult> CreateVirtualAccountAsync(string orderId, string description);
}
