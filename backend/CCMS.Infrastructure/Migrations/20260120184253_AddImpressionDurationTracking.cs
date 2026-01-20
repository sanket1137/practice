using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImpressionDurationTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "Impressions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExpectedDurationSeconds",
                table: "Impressions",
                type: "integer",
                nullable: true);

            // SlotPlayKey column already exists in the database, skip adding it
            // migrationBuilder.AddColumn<string>(
            //     name: "SlotPlayKey",
            //     table: "Impressions",
            //     type: "text",
            //     nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WasFullPlay",
                table: "Impressions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ImpressionDailySummaries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: true),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreativeId = table.Column<Guid>(type: "uuid", nullable: true),
                    OwnerContentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalPlays = table.Column<int>(type: "integer", nullable: false),
                    FullPlays = table.Column<int>(type: "integer", nullable: false),
                    PartialPlays = table.Column<int>(type: "integer", nullable: false),
                    TotalDurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    TotalExpectedDurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    FirstPlayAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastPlayAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HourlyPlays = table.Column<string>(type: "text", nullable: false),
                    VerifiedPlays = table.Column<int>(type: "integer", nullable: false),
                    UnverifiedPlays = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImpressionDailySummaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImpressionDailySummaries_Bookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "Bookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ImpressionDailySummaries_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ImpressionDailySummaries_Creatives_CreativeId",
                        column: x => x.CreativeId,
                        principalTable: "Creatives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ImpressionDailySummaries_OwnerContents_OwnerContentId",
                        column: x => x.OwnerContentId,
                        principalTable: "OwnerContents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ImpressionDailySummaries_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Impressions_Booking_WasFullPlay",
                table: "Impressions",
                columns: new[] { "BookingId", "WasFullPlay" });

            migrationBuilder.CreateIndex(
                name: "IX_Impressions_SessionDate",
                table: "Impressions",
                column: "SessionDate");

            migrationBuilder.CreateIndex(
                name: "IX_ImpressionDailySummaries_Booking_Screen_Date",
                table: "ImpressionDailySummaries",
                columns: new[] { "BookingId", "ScreenId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImpressionDailySummaries_Campaign_Date",
                table: "ImpressionDailySummaries",
                columns: new[] { "CampaignId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ImpressionDailySummaries_CreativeId",
                table: "ImpressionDailySummaries",
                column: "CreativeId");

            migrationBuilder.CreateIndex(
                name: "IX_ImpressionDailySummaries_OwnerContent_Date",
                table: "ImpressionDailySummaries",
                columns: new[] { "OwnerContentId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ImpressionDailySummaries_Screen_Date",
                table: "ImpressionDailySummaries",
                columns: new[] { "ScreenId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImpressionDailySummaries");

            migrationBuilder.DropIndex(
                name: "IX_Impressions_Booking_WasFullPlay",
                table: "Impressions");

            migrationBuilder.DropIndex(
                name: "IX_Impressions_SessionDate",
                table: "Impressions");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "Impressions");

            migrationBuilder.DropColumn(
                name: "ExpectedDurationSeconds",
                table: "Impressions");

            migrationBuilder.DropColumn(
                name: "SlotPlayKey",
                table: "Impressions");

            migrationBuilder.DropColumn(
                name: "WasFullPlay",
                table: "Impressions");
        }
    }
}
