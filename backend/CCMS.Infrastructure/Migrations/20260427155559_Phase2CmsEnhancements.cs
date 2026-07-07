using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase2CmsEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoApprovalEnabled",
                table: "Screens",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelGraceExpiresAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "NotificationPreferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    NotificationType = table.Column<int>(type: "integer", nullable: false),
                    InAppEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    EmailEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleWindows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaylistId = table.Column<Guid>(type: "uuid", nullable: false),
                    DaysOfWeekMask = table.Column<int>(type: "integer", nullable: false),
                    StartMinute = table.Column<int>(type: "integer", nullable: false),
                    EndMinute = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleWindows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleWindows_Playlists_PlaylistId",
                        column: x => x.PlaylistId,
                        principalTable: "Playlists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScheduleWindows_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScreenGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreenGroups_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScreenGroupMembers",
                columns: table => new
                {
                    ScreenGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScreenId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreenGroupMembers", x => new { x.ScreenGroupId, x.ScreenId });
                    table.ForeignKey(
                        name: "FK_ScreenGroupMembers_ScreenGroups_ScreenGroupId",
                        column: x => x.ScreenGroupId,
                        principalTable: "ScreenGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScreenGroupMembers_Screens_ScreenId",
                        column: x => x.ScreenId,
                        principalTable: "Screens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationPreferences_User_Type",
                table: "NotificationPreferences",
                columns: new[] { "UserId", "NotificationType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleWindows_PlaylistId",
                table: "ScheduleWindows",
                column: "PlaylistId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleWindows_ScreenId",
                table: "ScheduleWindows",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenGroupMembers_ScreenId",
                table: "ScreenGroupMembers",
                column: "ScreenId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreenGroups_OwnerId",
                table: "ScreenGroups",
                column: "OwnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationPreferences");

            migrationBuilder.DropTable(
                name: "ScheduleWindows");

            migrationBuilder.DropTable(
                name: "ScreenGroupMembers");

            migrationBuilder.DropTable(
                name: "ScreenGroups");

            migrationBuilder.DropColumn(
                name: "AutoApprovalEnabled",
                table: "Screens");

            migrationBuilder.DropColumn(
                name: "CancelGraceExpiresAt",
                table: "Bookings");
        }
    }
}
