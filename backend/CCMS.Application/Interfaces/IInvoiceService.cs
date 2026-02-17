using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Interfaces;

public interface IInvoiceService
{
    /// <summary>
    /// Generates a PDF invoice for an approved booking
    /// </summary>
    /// <param name="booking">The booking details</param>
    /// <param name="advertiserName">Name of the advertiser</param>
    /// <param name="advertiserEmail">Email of the advertiser</param>
    /// <param name="screenOwnerName">Name of the screen owner</param>
    /// <returns>PDF invoice as byte array</returns>
    Task<byte[]> GenerateBookingInvoiceAsync(
        BookingDto booking,
        string advertiserName,
        string advertiserEmail,
        string screenOwnerName);

    /// <summary>
    /// Generates an invoice number based on booking ID and date
    /// </summary>
    /// <param name="bookingId">The booking ID</param>
    /// <param name="createdAt">The booking creation date</param>
    /// <returns>Formatted invoice number</returns>
    string GenerateInvoiceNumber(Guid bookingId, DateTime createdAt);
}
