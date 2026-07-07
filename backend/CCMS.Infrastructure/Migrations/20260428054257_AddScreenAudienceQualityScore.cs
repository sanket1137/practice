using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddScreenAudienceQualityScore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AudienceQualityScore",
                table: "Screens",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AudienceQualityScore",
                table: "Screens");
        }
    }
}
