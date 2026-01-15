#r "nuget: Npgsql, 8.0.0"
using Npgsql;

var conn = new NpgsqlConnection("Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true");
conn.Open();

var cmd = new NpgsqlCommand("SELECT \"Id\", \"Name\", \"ApiKeyHash\" IS NOT NULL as HasApiKey FROM \"Screens\" WHERE \"IsDeleted\" = false", conn);
var reader = cmd.ExecuteReader();

Console.WriteLine("Available Screens:");
while (reader.Read()) { 
    Console.WriteLine("  " + reader["Id"] + " - " + reader["Name"] + " (HasApiKey: " + reader["HasApiKey"] + ")"); 
}
reader.Close();
conn.Close();
