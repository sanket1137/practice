using Npgsql;

var connectionString = "Host=ep-snowy-haze-ag6lkc0h-pooler.c-2.eu-central-1.aws.neon.tech;Database=pixelspot_ccms;Username=neondb_owner;Password=npg_Y9bQL3rHdXPq;SSL Mode=Require;Trust Server Certificate=true";

await using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();
Console.WriteLine("Connected to database!\n");

// Fix test users to be verified
await using (var cmd = new NpgsqlCommand(
    "UPDATE \"Users\" SET \"IsEmailVerified\" = true, \"IsPhoneVerified\" = true WHERE \"Email\" LIKE '%@example.com'", conn))
{
    var rows = await cmd.ExecuteNonQueryAsync();
    Console.WriteLine($"✅ Updated {rows} user(s) to be verified\n");
}

// Show users
Console.WriteLine("Users:");
await using (var cmd = new NpgsqlCommand(
    "SELECT \"Id\", \"Email\", \"Role\", \"IsEmailVerified\", \"IsPhoneVerified\" FROM \"Users\" LIMIT 10", conn))
{
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var id = reader.GetGuid(0);
        var email = reader.GetString(1);
        var role = reader.GetInt32(2);
        var emailVerified = reader.GetBoolean(3);
        var phoneVerified = reader.GetBoolean(4);
        Console.WriteLine($"  {email} (Role: {role}, EmailVerified: {emailVerified}, PhoneVerified: {phoneVerified})");
        Console.WriteLine($"    ID: {id}");
    }
}

Console.WriteLine("\nScreens:");
await using (var cmd2 = new NpgsqlCommand(
    "SELECT \"Id\", \"Name\", \"OwnerId\", \"DeviceId\", \"Status\" FROM \"Screens\" LIMIT 10", conn))
{
    await using var reader = await cmd2.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var id = reader.GetGuid(0);
        var name = reader.GetString(1);
        var ownerId = reader.GetGuid(2);
        var deviceId = reader.IsDBNull(3) ? "N/A" : reader.GetString(3);
        var status = reader.GetInt32(4);
        Console.WriteLine($"  {name} (Status: {status}, DeviceId: {deviceId})");
        Console.WriteLine($"    Screen ID: {id}");
    }
}
