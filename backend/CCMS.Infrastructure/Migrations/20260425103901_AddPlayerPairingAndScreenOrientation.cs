using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerPairingAndScreenOrientation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Orientation",
                table: "Screens",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "PlayerPairingTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeviceFingerprintHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeviceModel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OsVersion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AppVersion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClaimedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApiKey = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerPairingTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerPairingTokens_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PlayerPairingTokens_Users_ClaimedByUserId",
                        column: x => x.ClaimedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerPairingTokens_ClaimedByUserId",
                table: "PlayerPairingTokens",
                column: "ClaimedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerPairingTokens_ExpiresAt",
                table: "PlayerPairingTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerPairingTokens_ScreenId",
                table: "PlayerPairingTokens",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerPairingTokens_Token",
                table: "PlayerPairingTokens",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerPairingTokens");

            migrationBuilder.DropColumn(
                name: "Orientation",
                table: "Screens");
        }
    }
}
