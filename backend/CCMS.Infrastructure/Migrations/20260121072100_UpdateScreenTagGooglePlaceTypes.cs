using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CCMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateScreenTagGooglePlaceTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fix clinic_nearby: Replace 'health' with valid types
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""doctor"",""dental_clinic"",""medical_lab""]'
                WHERE ""Slug"" = 'clinic_nearby';
            ");

            // Fix gym_nearby: Add fitness_center type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""gym"",""fitness_center""]'
                WHERE ""Slug"" = 'gym_nearby';
            ");

            // Fix fitness_zone: Add fitness_center type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""gym"",""fitness_center""]'
                WHERE ""Slug"" = 'fitness_zone';
            ");

            // Fix yoga_studio_nearby: Add google place type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""yoga_studio""]'
                WHERE ""Slug"" = 'yoga_studio_nearby';
            ");

            // Fix wellness_hub: Add wellness center types
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""gym"",""fitness_center"",""spa"",""wellness_center"",""yoga_studio""]'
                WHERE ""Slug"" = 'wellness_hub';
            ");

            // Fix religious_zone: Replace place_of_worship with actual types
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""hindu_temple"",""mosque"",""church"",""synagogue""]'
                WHERE ""Slug"" = 'religious_zone';
            ");

            // Fix supermarket_nearby: Replace grocery_or_supermarket with valid types
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""supermarket"",""grocery_store""]'
                WHERE ""Slug"" = 'supermarket_nearby';
            ");

            // Fix coworking_nearby: Add corporate_office type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""corporate_office""]'
                WHERE ""Slug"" = 'coworking_nearby';
            ");

            // Fix government_office_nearby: Add government_office type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""local_government_office"",""government_office"",""city_hall""]'
                WHERE ""Slug"" = 'government_office_nearby';
            ");

            // Fix nightlife_zone: Add pub type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""bar"",""pub"",""night_club""]'
                WHERE ""Slug"" = 'nightlife_zone';
            ");

            // Fix bar_district: Add pub type
            migrationBuilder.Sql(@"
                UPDATE ""ScreenTags""
                SET ""GooglePlaceTypes"" = '[""bar"",""pub""]'
                WHERE ""Slug"" = 'bar_district';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert to old types (not recommended)
        }
    }
}
