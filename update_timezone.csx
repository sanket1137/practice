// C# Script to update screen timezone directly in database
#r "nuget: Npgsql, 8.0.0"

using Npgsql;

var connectionString = "Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true";
var screenId = "481757f0-fcf2-4910-b6fb-378f0b9e9b1a";
var timezone = "Asia/Kolkata";

Console.WriteLine("Connecting to database...");
var connection = new NpgsqlConnection(connectionString);
connection.Open();
Console.WriteLine("Connected!");

var sql = "UPDATE \"Screens\" SET \"Timezone\" = @timezone WHERE \"Id\" = @screenId RETURNING \"Name\", \"Timezone\"";
var cmd = new NpgsqlCommand(sql, connection);
cmd.Parameters.AddWithValue("timezone", timezone);
cmd.Parameters.AddWithValue("screenId", Guid.Parse(screenId));

var reader = cmd.ExecuteReader();
if (reader.Read())
{
    Console.WriteLine("Screen updated successfully!");
    Console.WriteLine("   Name: " + reader.GetString(0));
    Console.WriteLine("   Timezone: " + reader.GetString(1));
}
else
{
    Console.WriteLine("Screen not found!");
}

reader.Close();
connection.Close();
Console.WriteLine("Done!");
