using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase3PlayLogLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlayLogSeals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    Day = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RecordCount = table.Column<int>(type: "integer", nullable: false),
                    RecordsRoot = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PrevSealHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SealHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SealedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Algorithm = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayLogSeals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayLogSeals_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayLogSeals_ScreenId_Day",
                table: "PlayLogSeals",
                columns: new[] { "ScreenId", "Day" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayLogSeals");
        }
    }
}
