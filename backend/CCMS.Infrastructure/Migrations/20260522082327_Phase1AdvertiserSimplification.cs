using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase1AdvertiserSimplification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BezelHorizontalMm",
                table: "ScreenGroups",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "BezelVerticalMm",
                table: "ScreenGroups",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "Cols",
                table: "ScreenGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ContentMode",
                table: "ScreenGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "ScreenGroups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MasterVideoR2Key",
                table: "ScreenGroups",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Rows",
                table: "ScreenGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AssetType",
                table: "MediaAssets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "CollectionId",
                table: "MediaAssets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFavorite",
                table: "MediaAssets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUsedAt",
                table: "MediaAssets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "Tags",
                table: "MediaAssets",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY[]::text[]");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "MediaAssets",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MediaAssetId",
                table: "Creatives",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Goal",
                table: "Campaigns",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FitMode",
                table: "Bookings",
                type: "integer",
                nullable: false,
                defaultValue: 4);

            migrationBuilder.CreateTable(
                name: "LedControllerAgents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentVersion = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ControllerSoftware = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DeviceToken = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    TemperatureCelsius = table.Column<decimal>(type: "numeric", nullable: true),
                    IsOnline = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedControllerAgents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LedControllerAgents_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LedWallZones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    X = table.Column<int>(type: "integer", nullable: false),
                    Y = table.Column<int>(type: "integer", nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    ContentType = table.Column<int>(type: "integer", nullable: false),
                    ContentConfig = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedWallZones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LedWallZones_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MediaCollections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaCollections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MediaCollections_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScreenGroupAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    Row = table.Column<int>(type: "integer", nullable: false),
                    Col = table.Column<int>(type: "integer", nullable: false),
                    CropX = table.Column<int>(type: "integer", nullable: false),
                    CropY = table.Column<int>(type: "integer", nullable: false),
                    CropW = table.Column<int>(type: "integer", nullable: false),
                    CropH = table.Column<int>(type: "integer", nullable: false),
                    SegmentR2Key = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenGroupAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreenGroupAssignments_ScreenGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "ScreenGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScreenGroupAssignments_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_Collection",
                table: "MediaAssets",
                column: "CollectionId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_Owner_IsFavorite",
                table: "MediaAssets",
                columns: new[] { "OwnerId", "IsFavorite" });

            migrationBuilder.CreateIndex(
                name: "IX_MediaAssets_Owner_LastUsedAt",
                table: "MediaAssets",
                columns: new[] { "OwnerId", "LastUsedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Creatives_MediaAssetId",
                table: "Creatives",
                column: "MediaAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_LedControllerAgents_ScreenId",
                table: "LedControllerAgents",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_LedWallZones_ScreenId",
                table: "LedWallZones",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaCollections_Owner_Name",
                table: "MediaCollections",
                columns: new[] { "OwnerId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreenGroupAssignments_Group_Position",
                table: "ScreenGroupAssignments",
                columns: new[] { "GroupId", "Row", "Col" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreenGroupAssignments_ScreenId",
                table: "ScreenGroupAssignments",
                column: "ScreenId");

            migrationBuilder.AddForeignKey(
                name: "FK_Creatives_MediaAssets_MediaAssetId",
                table: "Creatives",
                column: "MediaAssetId",
                principalTable: "MediaAssets",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_MediaAssets_MediaCollections_CollectionId",
                table: "MediaAssets",
                column: "CollectionId",
                principalTable: "MediaCollections",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Backfill AssetType for existing MediaAssets based on MimeType.
            // Image=1, Video=2, Html=3, Other=0 (already the default).
            migrationBuilder.Sql(@"
                UPDATE ""MediaAssets""
                SET ""AssetType"" = CASE
                    WHEN ""MimeType"" ILIKE 'image/%' THEN 1
                    WHEN ""MimeType"" ILIKE 'video/%' THEN 2
                    WHEN ""MimeType"" = 'text/html'   THEN 3
                    ELSE 0
                END
                WHERE ""AssetType"" = 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Creatives_MediaAssets_MediaAssetId",
                table: "Creatives");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaAssets_MediaCollections_CollectionId",
                table: "MediaAssets");

            migrationBuilder.DropTable(
                name: "LedControllerAgents");

            migrationBuilder.DropTable(
                name: "LedWallZones");

            migrationBuilder.DropTable(
                name: "MediaCollections");

            migrationBuilder.DropTable(
                name: "ScreenGroupAssignments");

            migrationBuilder.DropIndex(
                name: "IX_MediaAssets_Collection",
                table: "MediaAssets");

            migrationBuilder.DropIndex(
                name: "IX_MediaAssets_Owner_IsFavorite",
                table: "MediaAssets");

            migrationBuilder.DropIndex(
                name: "IX_MediaAssets_Owner_LastUsedAt",
                table: "MediaAssets");

            migrationBuilder.DropIndex(
                name: "IX_Creatives_MediaAssetId",
                table: "Creatives");

            migrationBuilder.DropColumn(
                name: "BezelHorizontalMm",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "BezelVerticalMm",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "Cols",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "ContentMode",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "MasterVideoR2Key",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "Rows",
                table: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "AssetType",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "CollectionId",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "IsFavorite",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "LastUsedAt",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "MediaAssetId",
                table: "Creatives");

            migrationBuilder.DropColumn(
                name: "Goal",
                table: "Campaigns");

            migrationBuilder.DropColumn(
                name: "FitMode",
                table: "Bookings");
        }
    }
}
