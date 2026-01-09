using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FilterUniqueIndexForOwnerContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OwnerContents_ScreenId_SlotNumber",
                table: "OwnerContents");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerContents_ScreenId_SlotNumber",
                table: "OwnerContents",
                columns: new[] { "ScreenId", "SlotNumber" },
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OwnerContents_ScreenId_SlotNumber",
                table: "OwnerContents");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerContents_ScreenId_SlotNumber",
                table: "OwnerContents",
                columns: new[] { "ScreenId", "SlotNumber" },
                unique: true);
        }
    }
}
