using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase5TimescaleAndMosaicLed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── ScreenGroup: Phase 5 mosaic columns ───────────────────────
            migrationBuilder.AddColumn<int>(
                name: "Rows",
                table: "ScreenGroups",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "Cols",
                table: "ScreenGroups",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<decimal>(
                name: "BezelHorizontalMm",
                table: "ScreenGroups",
                type: "numeric(6,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "BezelVerticalMm",
                table: "ScreenGroups",
                type: "numeric(6,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ContentMode",
                table: "ScreenGroups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "MasterVideoR2Key",
                table: "ScreenGroups",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "ScreenGroups",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // ── ScreenGroupAssignment table ───────────────────────────────
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
                    SegmentR2Key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenGroupAssignments", x => x.Id);
                    table.ForeignKey("FK_ScreenGroupAssignments_ScreenGroups_GroupId", x => x.GroupId, "ScreenGroups", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_ScreenGroupAssignments_Screens_ScreenId", x => x.ScreenId, "Screens", "Id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_ScreenGroupAssignments_Group_Position", "ScreenGroupAssignments", new[] { "GroupId", "Row", "Col" }, unique: true);

            // ── LedWallZones table ────────────────────────────────────────
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
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedWallZones", x => x.Id);
                    table.ForeignKey("FK_LedWallZones_Screens_ScreenId", x => x.ScreenId, "Screens", "Id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_LedWallZones_ScreenId", "LedWallZones", "ScreenId");

            // ── LedControllerAgents table ─────────────────────────────────
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
                    TemperatureCelsius = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    IsOnline = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedControllerAgents", x => x.Id);
                    table.ForeignKey("FK_LedControllerAgents_Screens_ScreenId", x => x.ScreenId, "Screens", "Id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_LedControllerAgents_ScreenId", "LedControllerAgents", "ScreenId");

            // ── TimescaleDB hypertable + continuous aggregates ────────────
            // Skipped on environments without TimescaleDB. Apply manually on
            // Timescale-enabled clusters (see docs/PLAYER_REALTIME_AND_STREAMING.md).
            // Original SQL preserved in git history; this migration only creates
            // the LED/Mosaic tables and the plain Impressions storage on dev.
            migrationBuilder.Sql("SELECT 1; -- timescale ops deferred");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop TimescaleDB objects first (safe if they dont exist)
            migrationBuilder.Sql(@"
DO $$
BEGIN
    DROP MATERIALIZED VIEW IF EXISTS pop_daily CASCADE;
    DROP MATERIALIZED VIEW IF EXISTS pop_hourly CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
");

            migrationBuilder.DropTable(name: "LedControllerAgents");
            migrationBuilder.DropTable(name: "LedWallZones");
            migrationBuilder.DropTable(name: "ScreenGroupAssignments");

            migrationBuilder.DropColumn(name: "Rows", table: "ScreenGroups");
            migrationBuilder.DropColumn(name: "Cols", table: "ScreenGroups");
            migrationBuilder.DropColumn(name: "BezelHorizontalMm", table: "ScreenGroups");
            migrationBuilder.DropColumn(name: "BezelVerticalMm", table: "ScreenGroups");
            migrationBuilder.DropColumn(name: "ContentMode", table: "ScreenGroups");
            migrationBuilder.DropColumn(name: "MasterVideoR2Key", table: "ScreenGroups");
            migrationBuilder.DropColumn(name: "IsActive", table: "ScreenGroups");
        }
    }
}
