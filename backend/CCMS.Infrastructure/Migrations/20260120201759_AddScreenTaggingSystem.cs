using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddScreenTaggingSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameIndex(
                name: "IX_Screens_OwnerId",
                table: "Screens",
                newName: "IX_Screens_Owner");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastTaggedAt",
                table: "Screens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastTaggedLatitude",
                table: "Screens",
                type: "numeric(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastTaggedLongitude",
                table: "Screens",
                type: "numeric(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ScreenTags",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    GooglePlaceTypes = table.Column<string>(type: "text", nullable: true),
                    MaxDistanceMeters = table.Column<int>(type: "integer", nullable: true),
                    MinPoiCount = table.Column<int>(type: "integer", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    IsSystemTag = table.Column<bool>(type: "boolean", nullable: false),
                    IconName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ColorCode = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenTags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScreenTagAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    DistanceMeters = table.Column<int>(type: "integer", nullable: true),
                    PoiCount = table.Column<int>(type: "integer", nullable: true),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastRefreshedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenTagAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreenTagAssignments_ScreenTags_TagId",
                        column: x => x.TagId,
                        principalTable: "ScreenTags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScreenTagAssignments_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScreenTagAssignments_Users_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Screens_Location",
                table: "Screens",
                columns: new[] { "Latitude", "Longitude" });

            migrationBuilder.CreateIndex(
                name: "IX_Screens_Price",
                table: "Screens",
                column: "PricePerSlot");

            migrationBuilder.CreateIndex(
                name: "IX_Screens_Status",
                table: "Screens",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTagAssignments_AssignedByUserId",
                table: "ScreenTagAssignments",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTagAssignments_Screen",
                table: "ScreenTagAssignments",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTagAssignments_Screen_Primary",
                table: "ScreenTagAssignments",
                columns: new[] { "ScreenId", "IsPrimary" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTagAssignments_Screen_Source",
                table: "ScreenTagAssignments",
                columns: new[] { "ScreenId", "Source" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTagAssignments_Screen_Tag",
                table: "ScreenTagAssignments",
                columns: new[] { "ScreenId", "TagId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTagAssignments_Tag",
                table: "ScreenTagAssignments",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTags_Category",
                table: "ScreenTags",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenTags_Slug",
                table: "ScreenTags",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScreenTagAssignments");

            migrationBuilder.DropTable(
                name: "ScreenTags");

            migrationBuilder.DropIndex(
                name: "IX_Screens_Location",
                table: "Screens");

            migrationBuilder.DropIndex(
                name: "IX_Screens_Price",
                table: "Screens");

            migrationBuilder.DropIndex(
                name: "IX_Screens_Status",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastTaggedAt",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastTaggedLatitude",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "LastTaggedLongitude",
                table: "Screens");

            migrationBuilder.RenameIndex(
                name: "IX_Screens_Owner",
                table: "Screens",
                newName: "IX_Screens_OwnerId");
        }
    }
}
