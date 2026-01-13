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
            // Password hash for "Password123!" using BCrypt
            var passwordHash = "$2a$11$rBLRstFqUvnLmQzdqJWk0.YpGPOvYp3MgqXnKJKkGwZhDPW6MRwGq";

            // Seed Admin User
            migrationBuilder.Sql($@"
                INSERT INTO ""Users"" (""Id"", ""Email"", ""PasswordHash"", ""FirstName"", ""LastName"", ""Role"", ""CreatedAt"", ""IsDeleted"", ""IsEmailVerified"", ""IsPhoneVerified"")
                VALUES (
                    'a1111111-1111-1111-1111-111111111111',
                    'admin@pixelspot.com',
                    '{passwordHash}',
                    'Admin',
                    'User',
                    0,
                    NOW(),
                    false,
                    true,
                    true
                )
                ON CONFLICT (""Id"") DO NOTHING;
            ");

            // Seed Screen Owner User
            migrationBuilder.Sql($@"
                INSERT INTO ""Users"" (""Id"", ""Email"", ""PasswordHash"", ""FirstName"", ""LastName"", ""Role"", ""CreatedAt"", ""IsDeleted"", ""IsEmailVerified"", ""IsPhoneVerified"")
                VALUES (
                    'b2222222-2222-2222-2222-222222222222',
                    'owner@pixelspot.com',
                    '{passwordHash}',
                    'Screen',
                    'Owner',
                    1,
                    NOW(),
                    false,
                    true,
                    true
                )
                ON CONFLICT (""Id"") DO NOTHING;
            ");

            // Seed Advertiser User
            migrationBuilder.Sql($@"
                INSERT INTO ""Users"" (""Id"", ""Email"", ""PasswordHash"", ""FirstName"", ""LastName"", ""Role"", ""CreatedAt"", ""IsDeleted"", ""IsEmailVerified"", ""IsPhoneVerified"")
                VALUES (
                    'c3333333-3333-3333-3333-333333333333',
                    'advertiser@pixelspot.com',
                    '{passwordHash}',
                    'Ad',
                    'Vertiser',
                    2,
                    NOW(),
                    false,
                    true,
                    true
                )
                ON CONFLICT (""Id"") DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM ""Users"" WHERE ""Email"" IN ('admin@pixelspot.com', 'owner@pixelspot.com', 'advertiser@pixelspot.com');");
        }
    }
}
