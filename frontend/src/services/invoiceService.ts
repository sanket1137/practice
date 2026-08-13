import api from './api';

/**
 * Downloads a PDF invoice for an approved booking.
 * Opens a new browser tab/window with the PDF or triggers a download.
 * 
 * @param bookingId - The ID of the booking to download invoice for
 * @returns Promise that resolves when the download starts
 * @throws Error if the booking is not approved or user doesn't have permission
 */
export async function downloadBookingInvoice(bookingId: string): Promise<void> {
    const response = await api.get(`/bookings/${bookingId}/invoice`, {
        responseType: 'blob',
    });

    // Extract filename from Content-Disposition header or generate one
    const contentDisposition = response.headers['content-disposition'];
    let filename = `invoice-${bookingId.substring(0, 8)}.pdf`;
    
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
        }
    }

    // Create a blob URL and trigger download
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link and click it to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Opens the invoice in a new browser tab for viewing.
 * 
 * @param bookingId - The ID of the booking to view invoice for
 * @returns Promise that resolves when the invoice is opened
 */
export async function viewBookingInvoice(bookingId: string): Promise<void> {
    const response = await api.get(`/bookings/${bookingId}/invoice`, {
        responseType: 'blob',
    });

    // Create a blob URL and open in new tab
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    
    // Open in new tab
    window.open(url, '_blank');
    
    // Note: We don't revoke the URL immediately so the user can view/download
    // The URL will be cleaned up when the tab is closed
}

export interface BookingInvoiceInfo {
    invoiceNumber: string;
    canDownload: boolean;
}

/**
 * Checks if an invoice can be downloaded for a given booking status.
 * 
 * @param status - The booking status
 * @returns Whether an invoice can be downloaded
 */
export function canDownloadInvoice(status: string): boolean {
    const allowedStatuses = ['approved', 'completed'];
    return allowedStatuses.includes(status.toLowerCase());
}
