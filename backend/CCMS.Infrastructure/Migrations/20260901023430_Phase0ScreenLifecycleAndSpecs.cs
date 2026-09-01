using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase0ScreenLifecycleAndSpecs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PhysicalHeightMm",
                table: "Screens",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PhysicalWidthMm",
                table: "Screens",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PixelPitchMm",
                table: "Screens",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScreenType",
                table: "Screens",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ScreenLifecycleEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: false),
                    ToStatus = table.Column<int>(type: "integer", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenLifecycleEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreenLifecycleEvents_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScreenLifecycleEvents_Screen_CreatedAt",
                table: "ScreenLifecycleEvents",
                columns: new[] { "ScreenId", "CreatedAt" });

            // ── Data backfill: move every existing screen onto the real lifecycle ──
            //
            // Until now screens defaulted to Active (0) at creation regardless of
            // verification, and "Inactive"(1)/"Offline"(3) conflated owner intent
            // with connectivity. Reclassify:
            //
            //   Verified(3):        Active→Active, Maintenance→Maintenance,
            //                       Inactive→Paused(7), Offline→Ready(6)
            //                       (Offline screens were already hidden from search,
            //                        so Ready de-lists nothing)
            //   Mid-flow(1,2):      → PendingVerification(5)
            //   ReVerification(5):  → PendingVerification(5)
            //   Rejected(4)/Unverified(0): → Draft(4)
            //
            // Every changed row gets a System audit event so the reclassification
            // is visible in each screen's lifecycle history.
            migrationBuilder.Sql(@"
CREATE TEMP TABLE _lifecycle_backfill AS
SELECT s.""Id"" AS screen_id,
       s.""Status"" AS old_status,
       CASE
         WHEN s.""VerificationStatus"" = 3 AND s.""Status"" = 0 THEN 0
         WHEN s.""VerificationStatus"" = 3 AND s.""Status"" = 2 THEN 2
         WHEN s.""VerificationStatus"" = 3 AND s.""Status"" = 1 THEN 7
         WHEN s.""VerificationStatus"" = 3 AND s.""Status"" = 3 THEN 6
         WHEN s.""VerificationStatus"" = 3 THEN s.""Status""
         WHEN s.""VerificationStatus"" IN (1, 2, 5) THEN 5
         ELSE 4
       END AS new_status
FROM ""Screens"" s;

UPDATE ""Screens"" s
SET ""Status"" = b.new_status,
    ""UpdatedAt"" = NOW() AT TIME ZONE 'utc'
FROM _lifecycle_backfill b
WHERE s.""Id"" = b.screen_id AND s.""Status"" IS DISTINCT FROM b.new_status;

INSERT INTO ""ScreenLifecycleEvents""
    (""Id"", ""ScreenId"", ""FromStatus"", ""ToStatus"", ""ActorUserId"", ""ActorRole"", ""Reason"", ""CreatedAt"", ""IsDeleted"")
SELECT gen_random_uuid(), b.screen_id, b.old_status, b.new_status, NULL, 'System',
       'Lifecycle state machine backfill (Phase 0 migration)',
       NOW() AT TIME ZONE 'utc', FALSE
FROM _lifecycle_backfill b
WHERE b.old_status IS DISTINCT FROM b.new_status;

DROP TABLE _lifecycle_backfill;

-- Canonical millimetre dimensions from the legacy feet/meters columns.
UPDATE ""Screens""
SET ""PhysicalWidthMm""  = CASE LOWER(""DimensionUnit"")
                             WHEN 'feet'   THEN ROUND(""PhysicalWidth""  * 304.8)::int
                             WHEN 'meters' THEN ROUND(""PhysicalWidth""  * 1000)::int
                             ELSE NULL END,
    ""PhysicalHeightMm"" = CASE LOWER(""DimensionUnit"")
                             WHEN 'feet'   THEN ROUND(""PhysicalHeight"" * 304.8)::int
                             WHEN 'meters' THEN ROUND(""PhysicalHeight"" * 1000)::int
                             ELSE NULL END
WHERE ""PhysicalWidth"" > 0 AND ""PhysicalHeight"" > 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScreenLifecycleEvents");

            migrationBuilder.DropColumn(
                name: "PhysicalHeightMm",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "PhysicalWidthMm",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "PixelPitchMm",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "ScreenType",
                table: "Screens");
        }
    }
}
