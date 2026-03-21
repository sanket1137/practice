using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceOverrideHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DeviceOverrideHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OldFingerprintHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    NewFingerprintHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsPending = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeviceOverrideHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeviceOverrideHistories_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DeviceOverrideHistories_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DeviceOverrideHistory_Screen",
                table: "DeviceOverrideHistories",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceOverrideHistory_Screen_Pending",
                table: "DeviceOverrideHistories",
                columns: new[] { "ScreenId", "IsPending" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeviceOverrideHistories");
        }
    }
}
