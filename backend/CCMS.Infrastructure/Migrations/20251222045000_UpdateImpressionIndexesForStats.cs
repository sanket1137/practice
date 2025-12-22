using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inhentdoc />
    public partial class UpdateImpressionIndexesForStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rename column
            migrationBuilder.RenameColumn(
                name: "PlayTimestamp",
                table: "Impressions",
                newName: "PlayedAt");
            
            // Remove old column
            migrationBuilder.DropColumn(
                name: "PlayCount",
                table: "Impressions");
            
            // Drop old indexes
            migrationBuilder.DropIndex(
                name: "IX_Impressions_BookingId_SessionDate",
                table: "Impressions");
            
            migrationBuilder.DropIndex(
                name: "IX_Impressions_ScreenId_SessionDate",
                table: "Impressions");
            
            // Add new indexes optimized for stats queries
            migrationBuilder.CreateIndex(
                name: "IX_Impressions_Screen_PlayedAt",
                table: "Impressions",
                columns: new[] { "ScreenId", "PlayedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Impressions_Campaign_PlayedAt",
                table: "Impressions",
                columns: new[] { "CampaignId", "PlayedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Impressions_Booking_SessionDate",
                table: "Impressions",
                columns: new[] { "BookingId", "SessionDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop new indexes
            migrationBuilder.DropIndex(
                name: "IX_Impressions_Screen_PlayedAt",
                table: "Impressions");

            migrationBuilder.DropIndex(
                name: "IX_Impressions_Campaign_PlayedAt",
                table: "Impressions");

            migrationBuilder.DropIndex(
                name: "IX_Impressions_Booking_SessionDate",
                table: "Impressions");
            
            // Add back old column
            migrationBuilder.AddColumn<int>(
                name: "PlayCount",
                table: "Impressions",
                type: "int",
                nullable: false,
                defaultValue: 1);
            
            // Rename column back
            migrationBuilder.RenameColumn(
                name: "PlayedAt",
                table: "Impressions",
                newName: "PlayTimestamp");
            
            // Recreate old indexes
            migrationBuilder.CreateIndex(
                name: "IX_Impressions_BookingId_SessionDate",
                table: "Impressions",
                columns: new[] { "BookingId", "SessionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Impressions_ScreenId_SessionDate",
                table: "Impressions",
                columns: new[] { "ScreenId", "SessionDate" });
        }
    }
}
