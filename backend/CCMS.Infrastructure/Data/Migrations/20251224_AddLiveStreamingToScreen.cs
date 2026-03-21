using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLiveStreamingToScreen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LiveStreamingEnabled",
                table: "Screens",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastStreamedAt",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CurrentViewerCount",
                table: "Screens",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LiveStreamingEnabled",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastStreamedAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "CurrentViewerCount",
                table: "Screens");
        }
    }
}
