using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddScreenOnlineStatusColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add online status tracking columns
            migrationBuilder.AddColumn<bool>(
                name: "IsOnline",
                table: "Screens",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeenAt",
                table: "Screens",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConnectedDeviceId",
                table: "Screens",
                type: "nvarchar(max)",
                nullable: true);

            // Make DeviceId nullable  
            migrationBuilder.AlterColumn<string>(
                name: "DeviceId",
                table: "Screens",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            // Drop unique index on DeviceId
            migrationBuilder.DropIndex(
                name: "IX_Screens_DeviceId",
                table: "Screens");

            // Create non-unique index on DeviceId
            migrationBuilder.CreateIndex(
                name: "IX_Screens_DeviceId",
                table: "Screens",
                column: "DeviceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsOnline",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastSeenAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "ConnectedDeviceId",
                table: "Screens");

            // Revert DeviceId to required
            migrationBuilder.AlterColumn<string>(
                name: "DeviceId",
                table: "Screens",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            // Recreate unique index
            migrationBuilder.DropIndex(
                name: "IX_Screens_DeviceId",
                table: "Screens");

            migrationBuilder.CreateIndex(
                name: "IX_Screens_DeviceId",
                table: "Screens",
                column: "DeviceId",
                unique: true);
        }
    }
}
