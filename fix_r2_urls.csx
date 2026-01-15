#r "nuget: Npgsql, 8.0.0"
using Npgsql;

var conn = new NpgsqlConnection("Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true");
conn.Open();
Console.WriteLine("Connected to database");

var oldUrl = "https://pub-c37d8aeca6e04cb7bb13a43d90d86fd6.r2.dev";
var newUrl = "https://pub-8b275ed0704741b798c135d2ba0f55f9.r2.dev";

// Update Creatives table
Console.WriteLine("\n=== Updating Creatives FileUrl ===");
var cmd1 = new NpgsqlCommand("UPDATE \"Creatives\" SET \"FileUrl\" = REPLACE(\"FileUrl\", @oldUrl, @newUrl) WHERE \"FileUrl\" LIKE @pattern RETURNING \"Id\", \"Name\", \"FileUrl\"", conn);
cmd1.Parameters.AddWithValue("oldUrl", oldUrl);
cmd1.Parameters.AddWithValue("newUrl", newUrl);
cmd1.Parameters.AddWithValue("pattern", oldUrl + "%");

var reader1 = cmd1.ExecuteReader();
var count1 = 0;
while (reader1.Read()) {
    count1++;
    Console.WriteLine("  Updated: " + reader1["Name"] + " -> " + reader1["FileUrl"]);
}
reader1.Close();
Console.WriteLine("  Total creatives updated: " + count1);

// Update Creatives ThumbnailUrl
Console.WriteLine("\n=== Updating Creatives ThumbnailUrl ===");
var cmd2 = new NpgsqlCommand("UPDATE \"Creatives\" SET \"ThumbnailUrl\" = REPLACE(\"ThumbnailUrl\", @oldUrl, @newUrl) WHERE \"ThumbnailUrl\" LIKE @pattern RETURNING \"Id\", \"Name\", \"ThumbnailUrl\"", conn);
cmd2.Parameters.AddWithValue("oldUrl", oldUrl);
cmd2.Parameters.AddWithValue("newUrl", newUrl);
cmd2.Parameters.AddWithValue("pattern", oldUrl + "%");

var reader2 = cmd2.ExecuteReader();
var count2 = 0;
while (reader2.Read()) {
    count2++;
    Console.WriteLine("  Updated: " + reader2["Name"] + " -> " + reader2["ThumbnailUrl"]);
}
reader2.Close();
Console.WriteLine("  Total thumbnails updated: " + count2);

// Update Screens DefaultVideoUrl
Console.WriteLine("\n=== Updating Screens DefaultVideoUrl ===");
var cmd3 = new NpgsqlCommand("UPDATE \"Screens\" SET \"DefaultVideoUrl\" = REPLACE(\"DefaultVideoUrl\", @oldUrl, @newUrl) WHERE \"DefaultVideoUrl\" LIKE @pattern RETURNING \"Id\", \"Name\", \"DefaultVideoUrl\"", conn);
cmd3.Parameters.AddWithValue("oldUrl", oldUrl);
cmd3.Parameters.AddWithValue("newUrl", newUrl);
cmd3.Parameters.AddWithValue("pattern", oldUrl + "%");

var reader3 = cmd3.ExecuteReader();
var count3 = 0;
while (reader3.Read()) {
    count3++;
    Console.WriteLine("  Updated: " + reader3["Name"] + " -> " + reader3["DefaultVideoUrl"]);
}
reader3.Close();
Console.WriteLine("  Total screen default videos updated: " + count3);

conn.Close();
Console.WriteLine("\n✅ All URLs updated from old to new R2 subdomain!");
Console.WriteLine("Old: " + oldUrl);
Console.WriteLine("New: " + newUrl);
