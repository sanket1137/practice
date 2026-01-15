#r "nuget: Npgsql, 8.0.0"
using Npgsql;

var conn = new NpgsqlConnection("Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true");
conn.Open();
Console.WriteLine("Connected to database");

// Check Creatives table for this URL
Console.WriteLine("\n=== Checking Creatives table ===");
var cmd1 = new NpgsqlCommand("SELECT \"Id\", \"Name\", \"FileUrl\", \"CampaignId\" FROM \"Creatives\" WHERE \"FileUrl\" LIKE '%918872c4-9393-4e41-91f9-f14854f90e58%'", conn);
var reader1 = cmd1.ExecuteReader();
var found = false;
while (reader1.Read()) {
    found = true;
    Console.WriteLine("Creative found:");
    Console.WriteLine("  ID: " + reader1["Id"]);
    Console.WriteLine("  Name: " + reader1["Name"]);
    Console.WriteLine("  FileUrl: " + reader1["FileUrl"]);
    Console.WriteLine("  CampaignId: " + reader1["CampaignId"]);
}
if (!found) Console.WriteLine("No creative found with this URL pattern");
reader1.Close();

// Check Bookings table for this creative
Console.WriteLine("\n=== Checking Bookings table ===");
var cmd2 = new NpgsqlCommand("SELECT b.\"Id\", b.\"Status\", b.\"SlotNumbers\", b.\"CreativeId\", c.\"Name\" as CampaignName, s.\"Name\" as ScreenName, cr.\"FileUrl\" FROM \"Bookings\" b JOIN \"Campaigns\" c ON b.\"CampaignId\" = c.\"Id\" JOIN \"Screens\" s ON b.\"ScreenId\" = s.\"Id\" LEFT JOIN \"Creatives\" cr ON b.\"CreativeId\" = cr.\"Id\" WHERE cr.\"FileUrl\" LIKE '%918872c4-9393-4e41-91f9-f14854f90e58%'", conn);
var reader2 = cmd2.ExecuteReader();
found = false;
while (reader2.Read()) {
    found = true;
    Console.WriteLine("Booking found:");
    Console.WriteLine("  BookingId: " + reader2["Id"]);
    Console.WriteLine("  Status: " + reader2["Status"]);
    Console.WriteLine("  Slots: " + reader2["SlotNumbers"]);
    Console.WriteLine("  Campaign: " + reader2["CampaignName"]);
    Console.WriteLine("  Screen: " + reader2["ScreenName"]);
    Console.WriteLine("  FileUrl: " + reader2["FileUrl"]);
}
if (!found) Console.WriteLine("No booking found with this creative URL");
reader2.Close();

conn.Close();
Console.WriteLine("\nDone!");
