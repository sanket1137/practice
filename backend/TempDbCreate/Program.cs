using Npgsql;
var connString = "Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true";
using var conn = new NpgsqlConnection(connString); 
conn.Open();

Console.WriteLine("=== Verifying empty tables ===\n");

var tables = new[] { "Users", "Organizations", "Screens", "Bookings", "Memberships" };
foreach (var table in tables) {
    using var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{table}\"", conn);
    var count = cmd.ExecuteScalar();
    Console.WriteLine($"{table}: {count} rows");
}
