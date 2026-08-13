using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingPaymentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActiveQrChallengeCode",
                table: "Screens",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LastVerificationId",
                table: "Screens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QrChallengeExpiresAt",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VerificationStatus",
                table: "Screens",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "VerifiedAt",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "VerifiedByAdminUserId",
                table: "Screens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentExpiresAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RazorpayOrderId",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RazorpayPaymentId",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RazorpayRefundId",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VirtualAccountIfsc",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VirtualAccountNumber",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ScreenVerifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    QrChallengeCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VideoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DeviceFingerprintHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DeviceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ScanGpsLatitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    ScanGpsLongitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    PlayerIpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AdminReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AdminReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenVerifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreenVerifications_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScreenVerifications_Users_AdminReviewedByUserId",
                        column: x => x.AdminReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ScreenVerifications_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Screens_LastVerificationId",
                table: "Screens",
                column: "LastVerificationId");

            migrationBuilder.CreateIndex(
                name: "IX_Screens_VerificationStatus",
                table: "Screens",
                column: "VerificationStatus");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenVerifications_AdminReviewedByUserId",
                table: "ScreenVerifications",
                column: "AdminReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenVerifications_RequestedByUserId",
                table: "ScreenVerifications",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenVerifications_Screen_Status",
                table: "ScreenVerifications",
                columns: new[] { "ScreenId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreenVerifications_Status_CreatedAt",
                table: "ScreenVerifications",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Screens_ScreenVerifications_LastVerificationId",
                table: "Screens",
                column: "LastVerificationId",
                principalTable: "ScreenVerifications",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Screens_ScreenVerifications_LastVerificationId",
                table: "Screens");

            migrationBuilder.DropTable(
                name: "ScreenVerifications");

            migrationBuilder.DropIndex(
                name: "IX_Screens_LastVerificationId",
                table: "Screens");

            migrationBuilder.DropIndex(
                name: "IX_Screens_VerificationStatus",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "ActiveQrChallengeCode",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastVerificationId",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "QrChallengeExpiresAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "VerificationStatus",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "VerifiedAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "VerifiedByAdminUserId",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "PaymentExpiresAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RazorpayOrderId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RazorpayPaymentId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "RazorpayRefundId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "VirtualAccountIfsc",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "VirtualAccountNumber",
                table: "Bookings");
        }
    }
}
