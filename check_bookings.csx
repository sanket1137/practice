#r "nuget: Npgsql, 8.0.0"
using Npgsql;

var conn = new NpgsqlConnection("Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true");
conn.Open();

Console.WriteLine("=== Active Bookings with Creative URLs ===");
var cmd = new NpgsqlCommand("SELECT b.\"Id\", b.\"Status\", b.\"SlotNumbers\", s.\"Name\" as Screen, cr.\"Name\" as Creative, cr.\"FileUrl\" FROM \"Bookings\" b JOIN \"Screens\" s ON b.\"ScreenId\" = s.\"Id\" LEFT JOIN \"Creatives\" cr ON b.\"CreativeId\" = cr.\"Id\" WHERE b.\"Status\" IN (1, 4) ORDER BY s.\"Name\", b.\"SlotNumbers\"", conn);
var reader = cmd.ExecuteReader();
while (reader.Read()) { 
    Console.WriteLine("Screen: " + reader["Screen"]);
    Console.WriteLine("  Booking: " + reader["Id"]);
    Console.WriteLine("  Status: " + reader["Status"] + " Slots: " + reader["SlotNumbers"]);
    Console.WriteLine("  Creative: " + reader["Creative"] + " - " + reader["FileUrl"]);
    Console.WriteLine();
}
reader.Close();

Console.WriteLine("\n=== All Creatives in System ===");
var cmd2 = new NpgsqlCommand("SELECT \"Id\", \"Name\", \"FileUrl\" FROM \"Creatives\" ORDER BY \"CreatedAt\" DESC LIMIT 10", conn);
var reader2 = cmd2.ExecuteReader();
while (reader2.Read()) { 
    Console.WriteLine("Creative: " + reader2["Name"]);
    Console.WriteLine("  ID: " + reader2["Id"]);
    Console.WriteLine("  URL: " + reader2["FileUrl"]);
}
reader2.Close();

conn.Close();
Console.WriteLine("\nDone!");
