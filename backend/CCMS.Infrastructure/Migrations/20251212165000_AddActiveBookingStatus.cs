using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddActiveBookingStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Note: BookingStatus is an enum in C# code.
            // The database stores it as an integer (0-5).
            // Adding Active=4 and renumbering Completed from 4 to 5 doesn't require SQL changes
            // because existing Completed bookings (stored as 4) will still work.
            // New Active bookings will use value 4, and new Completed will use 5.
            
            // No database schema changes required - this is a code-only change
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No database schema changes to revert
        }
    }
}
