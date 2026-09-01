using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase3LedgerV2Reseal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ledger v2 changed the deterministic record ordering (ties now break
            // on SlotPlayKey, which exports carry, instead of the internal row id)
            // so third parties can recompute digests from the CSV alone. Seals
            // minted under v1 (the feature was hours old, nothing distributed)
            // are wiped and re-mint lazily under v2 on the next integrity check.
            migrationBuilder.Sql("DELETE FROM \"PlayLogSeals\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
