using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerContentSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerContentId",
                table: "Impressions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OwnerContents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SlotNumber = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Duration = table.Column<int>(type: "int", nullable: false),
                    PricePerPlay = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OwnerContents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OwnerContents_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Impressions_OwnerContentId",
                table: "Impressions",
                column: "OwnerContentId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerContents_ScreenId_SlotNumber",
                table: "OwnerContents",
                columns: new[] { "ScreenId", "SlotNumber" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Impressions_OwnerContents_OwnerContentId",
                table: "Impressions",
                column: "OwnerContentId",
                principalTable: "OwnerContents",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Impressions_OwnerContents_OwnerContentId",
                table: "Impressions");

            migrationBuilder.DropTable(
                name: "OwnerContents");

            migrationBuilder.DropIndex(
                name: "IX_Impressions_OwnerContentId",
                table: "Impressions");

            migrationBuilder.DropColumn(
                name: "OwnerContentId",
                table: "Impressions");
        }
    }
}
