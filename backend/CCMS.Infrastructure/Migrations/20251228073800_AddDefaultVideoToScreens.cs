using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefaultVideoToScreens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DefaultVideoUrl",
                table: "Screens",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasCustomDefaultVideo",
                table: "Screens",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DefaultVideoUploadedAt",
                table: "Screens",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DefaultVideoSizeBytes",
                table: "Screens",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultVideoUrl",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "HasCustomDefaultVideo",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "DefaultVideoUploadedAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "DefaultVideoSizeBytes",
                table: "Screens");
        }
    }
}
