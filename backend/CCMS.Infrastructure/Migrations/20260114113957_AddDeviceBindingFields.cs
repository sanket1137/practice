using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceBindingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeviceBoundAt",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceFingerprintHash",
                table: "Screens",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeviceOverrideAt",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeviceOverrideByUserId",
                table: "Screens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceOverrideReason",
                table: "Screens",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastDeviceVerification",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousDeviceFingerprintHash",
                table: "Screens",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeviceBoundAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "DeviceFingerprintHash",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "DeviceOverrideAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "DeviceOverrideByUserId",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "DeviceOverrideReason",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastDeviceVerification",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "PreviousDeviceFingerprintHash",
                table: "Screens");
        }
    }
}
