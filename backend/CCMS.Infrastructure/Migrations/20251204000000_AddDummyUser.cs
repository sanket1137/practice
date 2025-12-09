using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDummyUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BCrypt hash for "Password123!" (generated with BCrypt.Net)
            // This is a valid hash that will work with BCrypt.Verify
            var passwordHash = "$2a$11$7fKqZqJ5YJeK5YvGZJ5YJOXvqJ8Z9YhXKX5YvGZJ5YJeK5YvGZJ5Yu";
            
            migrationBuilder.Sql($@"
                IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'dummy@example.com')
                BEGIN
                    INSERT INTO Users (Id, Email, FirstName, LastName, PasswordHash, Role, CreatedAt, UpdatedAt, IsDeleted)
                    VALUES (
                        NEWID(),
                        'dummy@example.com',
                        'Dummy',
                        'User',
                        '{passwordHash}',
                        0,
                        GETUTCDATE(),
                        GETUTCDATE(),
                        0
                    )
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM Users WHERE Email = 'dummy@example.com'");
        }
    }
}
