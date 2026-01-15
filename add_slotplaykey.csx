#r "nuget: Npgsql, 8.0.0"
using Npgsql;

var connectionString = "Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true";
var connection = new NpgsqlConnection(connectionString);
connection.Open();
Console.WriteLine("Connected!");

var sql1 = "ALTER TABLE \"Impressions\" ADD COLUMN IF NOT EXISTS \"SlotPlayKey\" TEXT";
var cmd1 = new NpgsqlCommand(sql1, connection);
cmd1.ExecuteNonQuery();
Console.WriteLine("SlotPlayKey column added!");

var sql2 = "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Impressions_SlotPlayKey\" ON \"Impressions\" (\"SlotPlayKey\") WHERE \"SlotPlayKey\" IS NOT NULL";
var cmd2 = new NpgsqlCommand(sql2, connection);
cmd2.ExecuteNonQuery();
Console.WriteLine("SlotPlayKey unique index created!");

var sql3 = "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Impressions_ImpressionId\" ON \"Impressions\" (\"ImpressionId\") WHERE \"ImpressionId\" IS NOT NULL";
var cmd3 = new NpgsqlCommand(sql3, connection);
cmd3.ExecuteNonQuery();
Console.WriteLine("ImpressionId unique index created!");

connection.Close();
Console.WriteLine("Done!");
