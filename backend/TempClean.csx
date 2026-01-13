using Npgsql;
var connString = "Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true";
using var conn = new NpgsqlConnection(connString); 
conn.Open();
var tables = new[] { "PhoneVerificationOtps", "EmailVerificationTokens", "RefreshTokens", "Memberships", "Users", "Organizations" };
foreach (var t in tables) { try { using var cmd = new NpgsqlCommand($"TRUNCATE TABLE \"{t}\" CASCADE", conn); cmd.ExecuteNonQuery(); Console.WriteLine($"Truncated {t}"); } catch (Exception ex) { Console.WriteLine($"Skip {t}: {ex.Message}"); } }
Console.WriteLine("DB cleaned!");
