using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedTestUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BCrypt hash for "Password123!" - generated using BCrypt.Net
            var passwordHash = "$2a$11$K7tPD1TzRX5RfZvKqG5z0uIf9j6Y8V7qJ5XKz3U1L9M2N4O6P8Q0R";
            
            // Insert test users for each role
            // Role values: Admin = 0, ScreenOwner = 1, Advertiser = 2
            migrationBuilder.Sql($@"
                -- Admin user
                IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'admin@ccms.com')
                BEGIN
                    INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, IsEmailVerified, CreatedAt, IsDeleted)
                    VALUES (
                        '11111111-1111-1111-1111-111111111111',
                        'admin@ccms.com',
                        'Admin',
                        'User',
                        '{passwordHash}',
                        0,
                        1,
                        GETUTCDATE(),
                        0
                    )
                END

                -- Screen Owner user
                IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'owner@ccms.com')
                BEGIN
                    INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, IsEmailVerified, CreatedAt, IsDeleted)
                    VALUES (
                        '22222222-2222-2222-2222-222222222222',
                        'owner@ccms.com',
                        'Screen',
                        'Owner',
                        '{passwordHash}',
                        1,
                        1,
                        GETUTCDATE(),
                        0
                    )
                END

                -- Advertiser user
                IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'advertiser@ccms.com')
                BEGIN
                    INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, IsEmailVerified, CreatedAt, IsDeleted)
                    VALUES (
                        '33333333-3333-3333-3333-333333333333',
                        'advertiser@ccms.com',
                        'Advertiser',
                        'User',
                        '{passwordHash}',
                        2,
                        1,
                        GETUTCDATE(),
                        0
                    )
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM Users WHERE Email IN ('admin@ccms.com', 'owner@ccms.com', 'advertiser@ccms.com')
            ");
        }
    }
}
