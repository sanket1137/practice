using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using CCMS.Domain.Entities;
using CCMS.Domain.ValueObjects;
using System.Text.Json;

namespace CCMS.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Screen> Screens => Set<Screen>();
    public DbSet<SlotAvailability> SlotAvailabilities => Set<SlotAvailability>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<Creative> Creatives => Set<Creative>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Impression> Impressions => Set<Impression>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Membership> Memberships => Set<Membership>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.PasswordHash).IsRequired();
            
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // RefreshToken configuration
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            
            entity.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Screen configuration
        modelBuilder.Entity<Screen>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.DeviceId);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.DeviceId).HasMaxLength(100);
            
            // Complex type for Address
            entity.OwnsOne(e => e.Location, address =>
            {
                address.Property(a => a.Street).HasMaxLength(200);
                address.Property(a => a.City).HasMaxLength(100);
                address.Property(a => a.State).HasMaxLength(100);
                address.Property(a => a.Country).HasMaxLength(100);
                address.Property(a => a.PostalCode).HasMaxLength(20);
            });
            
            // Complex type for OperatingSchedule (stored as JSON)
            entity.OwnsOne(e => e.Schedule, schedule =>
            {
                schedule.OwnsOne(s => s.Monday);
                schedule.OwnsOne(s => s.Tuesday);
                schedule.OwnsOne(s => s.Wednesday);
                schedule.OwnsOne(s => s.Thursday);
                schedule.OwnsOne(s => s.Friday);
                schedule.OwnsOne(s => s.Saturday);
                schedule.OwnsOne(s => s.Sunday);
            });
            
            entity.HasOne(e => e.Owner)
                .WithMany(u => u.Screens)
                .HasForeignKey(e => e.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Campaign configuration
        modelBuilder.Entity<Campaign>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            
            entity.HasOne(e => e.Advertiser)
                .WithMany(u => u.Campaigns)
                .HasForeignKey(e => e.AdvertiserId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Creative configuration
        modelBuilder.Entity<Creative>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.FileUrl).IsRequired();
            entity.Property(e => e.FileName).IsRequired().HasMaxLength(255);
            
            entity.HasOne(e => e.Campaign)
                .WithMany(c => c.Creatives)
                .HasForeignKey(e => e.CampaignId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Booking configuration
        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Store SlotNumbers as JSON
            var slotNumbersConverter = new ValueConverter<List<int>, string>(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<List<int>>(v, (JsonSerializerOptions?)null) ?? new List<int>()
            );
            
            entity.Property(e => e.SlotNumbers)
                .HasConversion(slotNumbersConverter)
                .HasColumnType("nvarchar(max)");
            
            entity.HasOne(e => e.Screen)
                .WithMany(s => s.Bookings)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Campaign)
                .WithMany(c => c.Bookings)
                .HasForeignKey(e => e.CampaignId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Creative)
                .WithMany(c => c.Bookings)
                .HasForeignKey(e => e.CreativeId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Impression configuration
        modelBuilder.Entity<Impression>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Indexes for stats queries
            entity.HasIndex(e => new { e.ScreenId, e.PlayedAt })
                .HasDatabaseName("IX_Impressions_Screen_PlayedAt");
            
            entity.HasIndex(e => new { e.CampaignId, e.PlayedAt })
                .HasDatabaseName("IX_Impressions_Campaign_PlayedAt");
            
            entity.HasIndex(e => new { e.BookingId, e.SessionDate })
                .HasDatabaseName("IX_Impressions_Booking_SessionDate");
            
            // Relationships
            entity.HasOne(e => e.Booking)
                .WithMany(b => b.Impressions)
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Campaign)
                .WithMany()
                .HasForeignKey(e => e.CampaignId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Screen)
                .WithMany(s => s.Impressions)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Creative)
                .WithMany()
                .HasForeignKey(e => e.CreativeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Organization configuration
        modelBuilder.Entity<Organization>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            
            entity.HasOne(e => e.Owner)
                .WithMany()
                .HasForeignKey(e => e.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Membership configuration
        modelBuilder.Entity<Membership>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.OrganizationId }).IsUnique();
            
            entity.HasOne(e => e.User)
                .WithMany(u => u.Memberships)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Organization)
                .WithMany(o => o.Memberships)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // SlotAvailability configuration
        modelBuilder.Entity<SlotAvailability>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique constraint: one record per screen per date
            entity.HasIndex(e => new { e.ScreenId, e.Date }).IsUnique();
            
            // Check constraints
            entity.ToTable(t => 
            {
                t.HasCheckConstraint("CK_SlotAvailability_BookedSlotsNonNegative", "[BookedSlots] >= 0");
                t.HasCheckConstraint("CK_SlotAvailability_BookedSlotsNotExceedTotal", "[BookedSlots] <= [TotalSlots]");
            });
            
            // JSON column for slot bookings
            entity.Property(e => e.SlotBookings)
                .HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null!),
                    v => JsonSerializer.Deserialize<Dictionary<int, Guid?>>(v, (JsonSerializerOptions)null!) ?? new Dictionary<int, Guid?>()
                );
            
            entity.HasOne(e => e.Screen)
                .WithMany()
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries<BaseEntity>();

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
    }
}
