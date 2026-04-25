using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
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
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<EmailVerificationToken> EmailVerificationTokens => Set<EmailVerificationToken>();
    public DbSet<PhoneVerificationOtp> PhoneVerificationOtps => Set<PhoneVerificationOtp>();
    public DbSet<Screen> Screens => Set<Screen>();
    public DbSet<SlotAvailability> SlotAvailabilities => Set<SlotAvailability>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<Creative> Creatives => Set<Creative>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Impression> Impressions => Set<Impression>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<OwnerContent> OwnerContents => Set<OwnerContent>();
    public DbSet<ImpressionDailySummary> ImpressionDailySummaries => Set<ImpressionDailySummary>();
    public DbSet<ScreenTag> ScreenTags => Set<ScreenTag>();
    public DbSet<ScreenTagAssignment> ScreenTagAssignments => Set<ScreenTagAssignment>();
    public DbSet<ScreenImage> ScreenImages => Set<ScreenImage>();
    public DbSet<DeviceOverrideHistory> DeviceOverrideHistories => Set<DeviceOverrideHistory>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();
    public DbSet<Payout> Payouts => Set<Payout>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<AdminAuthorizedMachine> AdminAuthorizedMachines => Set<AdminAuthorizedMachine>();
    public DbSet<ScreenVerification> ScreenVerifications => Set<ScreenVerification>();
    public DbSet<VisibilityChangeRequest> VisibilityChangeRequests => Set<VisibilityChangeRequest>();

    // ── CMS mode ──────────────────────────────────────────────────────────
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<PlaylistItem> PlaylistItems => Set<PlaylistItem>();
    public DbSet<PairingCode> PairingCodes => Set<PairingCode>();
    public DbSet<RemoteCommand> RemoteCommands => Set<RemoteCommand>();

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
            entity.Property(e => e.CompanyName).HasMaxLength(200);
            entity.Property(e => e.GstNumber).HasMaxLength(20);
            entity.Property(e => e.ThemePreference).HasMaxLength(10).HasDefaultValue("dark");
            
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

        // PasswordResetToken configuration
        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.Property(e => e.Token).IsRequired().HasMaxLength(100);
            
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // EmailVerificationToken configuration
        modelBuilder.Entity<EmailVerificationToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.Property(e => e.Token).IsRequired().HasMaxLength(100);
            
            entity.HasOne(e => e.User)
                .WithMany(u => u.EmailVerificationTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PhoneVerificationOtp configuration
        modelBuilder.Entity<PhoneVerificationOtp>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.PhoneNumber, e.CreatedAt }); // For rate limiting queries
            entity.Property(e => e.PhoneNumber).IsRequired().HasMaxLength(15);
            entity.Property(e => e.OtpCode).IsRequired().HasMaxLength(6);
            
            entity.HasOne(e => e.User)
                .WithMany(u => u.PhoneVerificationOtps)
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
            
            // Index for owner queries
            entity.HasIndex(e => e.OwnerId)
                .HasDatabaseName("IX_Screens_Owner");
            
            // Index for location-based search
            entity.HasIndex(e => new { e.Latitude, e.Longitude })
                .HasDatabaseName("IX_Screens_Location");
            
            // Index for status filtering
            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_Screens_Status");
            
            // Index for price range filtering
            entity.HasIndex(e => e.PricePerSlot)
                .HasDatabaseName("IX_Screens_Price");
            
            // Tagging fields
            entity.Property(e => e.LastTaggedLatitude)
                .HasColumnType("decimal(9,6)")
                .HasPrecision(9, 6);
                
            entity.Property(e => e.LastTaggedLongitude)
                .HasColumnType("decimal(9,6)")
                .HasPrecision(9, 6);
            
            // Fix decimal precision warnings
            entity.Property(e => e.PricePerSlot)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);
                
            entity.Property(e => e.CommissionPercentage)
                .HasColumnType("decimal(5,2)")
                .HasPrecision(5, 2)
                .HasDefaultValue(15m);
                
            entity.Property(e => e.Latitude)
                .HasColumnType("decimal(9,6)")
                .HasPrecision(9, 6);
                
            entity.Property(e => e.Longitude)
                .HasColumnType("decimal(9,6)")
                .HasPrecision(9, 6);
                
            entity.Property(e => e.PhysicalWidth)
                .HasColumnType("decimal(8,2)")
                .HasPrecision(8, 2);
                
            entity.Property(e => e.PhysicalHeight)
                .HasColumnType("decimal(8,2)")
                .HasPrecision(8, 2);
            
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

        // ScreenTag configuration (master tags)
        modelBuilder.Entity<ScreenTag>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique slug for tag identification
            entity.HasIndex(e => e.Slug)
                .IsUnique()
                .HasDatabaseName("IX_ScreenTags_Slug");
            
            // Index for category filtering
            entity.HasIndex(e => e.Category)
                .HasDatabaseName("IX_ScreenTags_Category");
            
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(150);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.GooglePlaceTypes).HasColumnType("text"); // JSON array
            entity.Property(e => e.IconName).HasMaxLength(50);
            entity.Property(e => e.ColorCode).HasMaxLength(7); // #RRGGBB
            
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ScreenTagAssignment configuration (junction table)
        modelBuilder.Entity<ScreenTagAssignment>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique constraint: one tag assignment per screen-tag combination
            entity.HasIndex(e => new { e.ScreenId, e.TagId })
                .IsUnique()
                .HasDatabaseName("IX_ScreenTagAssignments_Screen_Tag");
            
            // Index for getting all tags for a screen
            entity.HasIndex(e => e.ScreenId)
                .HasDatabaseName("IX_ScreenTagAssignments_Screen");
            
            // Index for finding screens by tag
            entity.HasIndex(e => e.TagId)
                .HasDatabaseName("IX_ScreenTagAssignments_Tag");
            
            // Index for filtering by source (Auto vs Manual)
            entity.HasIndex(e => new { e.ScreenId, e.Source })
                .HasDatabaseName("IX_ScreenTagAssignments_Screen_Source");
            
            // Index for finding primary tags
            entity.HasIndex(e => new { e.ScreenId, e.IsPrimary })
                .HasDatabaseName("IX_ScreenTagAssignments_Screen_Primary");
            
            entity.HasOne(e => e.Screen)
                .WithMany(s => s.TagAssignments)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Tag)
                .WithMany(t => t.ScreenAssignments)
                .HasForeignKey(e => e.TagId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.AssignedByUser)
                .WithMany()
                .HasForeignKey(e => e.AssignedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ScreenImage configuration
        modelBuilder.Entity<ScreenImage>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Index for getting all images for a screen
            entity.HasIndex(e => e.ScreenId)
                .HasDatabaseName("IX_ScreenImages_Screen");
            
            // Index for filtering by image type
            entity.HasIndex(e => new { e.ScreenId, e.ImageType })
                .HasDatabaseName("IX_ScreenImages_Screen_Type");
            
            // Index for finding primary images
            entity.HasIndex(e => new { e.ScreenId, e.IsPrimary })
                .HasDatabaseName("IX_ScreenImages_Screen_Primary");
            
            entity.Property(e => e.ImageUrl).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.OriginalFileName).IsRequired().HasMaxLength(255);
            entity.Property(e => e.ContentType).HasMaxLength(100);
            
            entity.HasOne(e => e.Screen)
                .WithMany(s => s.Images)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // DeviceOverrideHistory configuration
        modelBuilder.Entity<DeviceOverrideHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.HasIndex(e => e.ScreenId)
                .HasDatabaseName("IX_DeviceOverrideHistory_Screen");
            
            // Index for finding active pending overrides efficiently
            entity.HasIndex(e => new { e.ScreenId, e.IsPending })
                .HasDatabaseName("IX_DeviceOverrideHistory_Screen_Pending");
            
            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.Property(e => e.OldFingerprintHash).HasMaxLength(100);
            entity.Property(e => e.NewFingerprintHash).HasMaxLength(100);
            
            entity.HasOne(e => e.Screen)
                .WithMany()
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.RequestedByUser)
                .WithMany()
                .HasForeignKey(e => e.RequestedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Campaign configuration
        modelBuilder.Entity<Campaign>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            
            // Fix decimal precision warning
            entity.Property(e => e.Budget)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);
            
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
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired(false);

            entity.HasOne(e => e.UploadedBy)
                .WithMany()
                .HasForeignKey(e => e.UploadedById)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false);
                
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Booking configuration
        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Fix decimal precision warning
            entity.Property(e => e.TotalPrice)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);
            
            // Store SlotNumbers as JSON - PostgreSQL uses 'text'
            var slotNumbersConverter = new ValueConverter<List<int>, string>(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<List<int>>(v, (JsonSerializerOptions?)null) ?? new List<int>()
            );
            
            entity.Property(e => e.SlotNumbers)
                .HasConversion(slotNumbersConverter)
                .HasColumnType("text");
            
            entity.HasOne(e => e.Screen)
                .WithMany(s => s.Bookings)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Campaign)
                .WithMany(c => c.Bookings)
                .HasForeignKey(e => e.CampaignId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
                
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
            
            // Index for completion rate queries (advertiser reporting)
            entity.HasIndex(e => new { e.BookingId, e.WasFullPlay })
                .HasDatabaseName("IX_Impressions_Booking_WasFullPlay");
            
            // Index for date range queries on recent data
            entity.HasIndex(e => e.SessionDate)
                .HasDatabaseName("IX_Impressions_SessionDate");
            
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
                
            entity.HasOne(e => e.OwnerContent)
                .WithMany(oc => oc.Impressions)
                .HasForeignKey(e => e.OwnerContentId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // ImpressionDailySummary configuration (aggregated historical data)
        modelBuilder.Entity<ImpressionDailySummary>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique constraint: one summary per booking/screen/date combination
            entity.HasIndex(e => new { e.BookingId, e.ScreenId, e.Date })
                .IsUnique()
                .HasDatabaseName("IX_ImpressionDailySummaries_Booking_Screen_Date");
            
            // Index for campaign-level reporting
            entity.HasIndex(e => new { e.CampaignId, e.Date })
                .HasDatabaseName("IX_ImpressionDailySummaries_Campaign_Date");
            
            // Index for screen-level reporting
            entity.HasIndex(e => new { e.ScreenId, e.Date })
                .HasDatabaseName("IX_ImpressionDailySummaries_Screen_Date");
            
            // Index for owner content reporting
            entity.HasIndex(e => new { e.OwnerContentId, e.Date })
                .HasDatabaseName("IX_ImpressionDailySummaries_OwnerContent_Date");
            
            // JSON column for hourly breakdown - PostgreSQL uses 'text' or 'jsonb'
            entity.Property(e => e.HourlyPlays)
                .HasColumnType("text")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null!),
                    v => JsonSerializer.Deserialize<List<int>>(v, (JsonSerializerOptions)null!) ?? new List<int>(new int[24])
                );
            
            // Relationships
            entity.HasOne(e => e.Booking)
                .WithMany()
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Campaign)
                .WithMany()
                .HasForeignKey(e => e.CampaignId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Screen)
                .WithMany()
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Creative)
                .WithMany()
                .HasForeignKey(e => e.CreativeId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.OwnerContent)
                .WithMany()
                .HasForeignKey(e => e.OwnerContentId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // OwnerContent configuration
        modelBuilder.Entity<OwnerContent>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique constraint: one owner content per screen per slot (excluding soft-deleted)
            // PostgreSQL-compatible filter syntax
            entity.HasIndex(e => new { e.ScreenId, e.SlotNumber })
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false"); // PostgreSQL uses double quotes for identifiers
            
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.FileUrl).IsRequired();
            entity.Property(e => e.PricePerPlay).HasColumnType("decimal(10,2)");
            
            entity.HasOne(e => e.Screen)
                .WithMany()
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasQueryFilter(e => e.IsActive);
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
            
            // Check constraints - PostgreSQL-compatible syntax
            entity.ToTable(t => 
            {
                t.HasCheckConstraint("CK_SlotAvailability_BookedSlotsNonNegative", "\"BookedSlots\" >= 0");
                t.HasCheckConstraint("CK_SlotAvailability_BookedSlotsNotExceedTotal", "\"BookedSlots\" <= \"TotalSlots\"");
            });
            
            // JSON column for slot bookings - PostgreSQL uses 'text' or 'jsonb'
            entity.Property(e => e.SlotBookings)
                .HasColumnType("text")
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

        // Payment configuration
        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.RazorpayOrderId)
                .HasDatabaseName("IX_Payments_RazorpayOrderId");

            entity.HasIndex(e => e.RazorpayPaymentId)
                .HasDatabaseName("IX_Payments_RazorpayPaymentId");

            entity.HasIndex(e => e.BookingId)
                .HasDatabaseName("IX_Payments_BookingId");

            entity.Property(e => e.Amount)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.RefundAmount)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.RazorpayOrderId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.RazorpayPaymentId).HasMaxLength(100);
            entity.Property(e => e.RazorpaySignature).HasMaxLength(500);
            entity.Property(e => e.Currency).HasMaxLength(10);
            entity.Property(e => e.GatewayResponse).HasColumnType("text");

            entity.HasOne(e => e.Booking)
                .WithMany(b => b.Payments)
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Payments)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Wallet configuration
        modelBuilder.Entity<Wallet>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.UserId)
                .IsUnique()
                .HasDatabaseName("IX_Wallets_UserId");

            entity.Property(e => e.Balance)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.Currency).HasMaxLength(10);

            entity.Property(e => e.RowVersion)
                .HasColumnName("xmin")
                .HasColumnType("xid")
                .ValueGeneratedOnAddOrUpdate()
                .IsConcurrencyToken();

            entity.HasOne(e => e.User)
                .WithOne()
                .HasForeignKey<Wallet>(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // WalletTransaction configuration
        modelBuilder.Entity<WalletTransaction>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.WalletId)
                .HasDatabaseName("IX_WalletTransactions_WalletId");

            entity.HasIndex(e => e.ReferenceId)
                .HasDatabaseName("IX_WalletTransactions_ReferenceId");

            entity.Property(e => e.Amount)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.BalanceBefore)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.BalanceAfter)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.ReferenceType).HasMaxLength(50);

            entity.HasOne(e => e.Wallet)
                .WithMany(w => w.Transactions)
                .HasForeignKey(e => e.WalletId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Payout configuration
        modelBuilder.Entity<Payout>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.ScreenOwnerId)
                .HasDatabaseName("IX_Payouts_ScreenOwnerId");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_Payouts_Status");

            entity.Property(e => e.GrossAmount)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.CommissionPercentage)
                .HasColumnType("decimal(5,2)")
                .HasPrecision(5, 2);

            entity.Property(e => e.CommissionAmount)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.NetAmount)
                .HasColumnType("decimal(18,2)")
                .HasPrecision(18, 2);

            entity.Property(e => e.Currency).HasMaxLength(10);
            entity.Property(e => e.RazorpayPayoutId).HasMaxLength(100);
            entity.Property(e => e.BankAccountDetails).HasColumnType("text");
            entity.Property(e => e.AdminNotes).HasMaxLength(1000);

            entity.Property(e => e.AdvancePercentage)
                .HasColumnType("decimal(5,2)")
                .HasPrecision(5, 2);

            entity.HasIndex(e => e.BookingId)
                .HasDatabaseName("IX_Payouts_BookingId");

            entity.HasOne(e => e.ScreenOwner)
                .WithMany(u => u.Payouts)
                .HasForeignKey(e => e.ScreenOwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Booking)
                .WithMany(b => b.Payouts)
                .HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── Notification ──
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.UserId, e.IsRead })
                .HasDatabaseName("IX_Notifications_UserId_IsRead");

            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("IX_Notifications_CreatedAt");

            entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Message).HasMaxLength(1000).IsRequired();
            entity.Property(e => e.ActionUrl).HasMaxLength(500);
            entity.Property(e => e.ReferenceType).HasMaxLength(50);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── BankAccount (one-to-one with User) ──
        modelBuilder.Entity<BankAccount>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.UserId)
                .IsUnique()
                .HasDatabaseName("IX_BankAccounts_UserId");

            entity.Property(e => e.BeneficiaryName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.AccountNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.IfscCode).IsRequired().HasMaxLength(11);
            entity.Property(e => e.BankName).IsRequired().HasMaxLength(200);

            entity.HasOne(e => e.User)
                .WithOne(u => u.BankAccount)
                .HasForeignKey<BankAccount>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── AdminAuthorizedMachine ──
        modelBuilder.Entity<AdminAuthorizedMachine>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.AdminUserId, e.MachineFingerprintHash })
                .IsUnique()
                .HasDatabaseName("IX_AdminMachines_User_Fingerprint")
                .HasFilter("\"IsDeleted\" = false");

            entity.HasIndex(e => e.AdminUserId)
                .HasDatabaseName("IX_AdminMachines_AdminUserId");

            entity.Property(e => e.MachineFingerprintHash).IsRequired().HasMaxLength(100);
            entity.Property(e => e.MachineName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.MachineDetails).HasColumnType("text");

            entity.HasOne(e => e.AdminUser)
                .WithMany(u => u.AuthorizedMachines)
                .HasForeignKey(e => e.AdminUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.AuthorizedByUser)
                .WithMany()
                .HasForeignKey(e => e.AuthorizedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── ScreenVerification (QR-based physical verification) ──
        modelBuilder.Entity<ScreenVerification>(entity =>
        {
            entity.HasKey(e => e.Id);

            // Admin queue: filter by status, sort by date
            entity.HasIndex(e => new { e.Status, e.CreatedAt })
                .HasDatabaseName("IX_ScreenVerifications_Status_CreatedAt");

            // Screen history: all verifications for a screen
            entity.HasIndex(e => new { e.ScreenId, e.Status })
                .HasDatabaseName("IX_ScreenVerifications_Screen_Status");

            entity.Property(e => e.QrChallengeCode).IsRequired().HasMaxLength(64);
            entity.Property(e => e.VideoUrl).HasMaxLength(1000);
            entity.Property(e => e.DeviceFingerprintHash).HasMaxLength(100);
            entity.Property(e => e.DeviceType).HasMaxLength(20);
            entity.Property(e => e.PlayerIpAddress).HasMaxLength(45); // IPv6 max length
            entity.Property(e => e.RejectionReason).HasMaxLength(500);

            entity.Property(e => e.ScanGpsLatitude)
                .HasColumnType("decimal(9,6)")
                .HasPrecision(9, 6);

            entity.Property(e => e.ScanGpsLongitude)
                .HasColumnType("decimal(9,6)")
                .HasPrecision(9, 6);

            entity.HasOne(e => e.Screen)
                .WithMany(s => s.Verifications)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.RequestedByUser)
                .WithMany()
                .HasForeignKey(e => e.RequestedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.AdminReviewedByUser)
                .WithMany()
                .HasForeignKey(e => e.AdminReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Screen verification fields index ──
        modelBuilder.Entity<Screen>(entity =>
        {
            entity.HasIndex(e => e.VerificationStatus)
                .HasDatabaseName("IX_Screens_VerificationStatus");

            entity.HasOne(e => e.LastVerification)
                .WithMany()
                .HasForeignKey(e => e.LastVerificationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── VisibilityChangeRequest (Private→Public approval workflow) ──
        modelBuilder.Entity<VisibilityChangeRequest>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_VisibilityChangeRequests_UserId");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_VisibilityChangeRequests_Status");

            entity.Property(e => e.RequestMessage).HasMaxLength(1000);
            entity.Property(e => e.RejectionReason).HasMaxLength(500);

            entity.HasOne(e => e.User)
                .WithMany(u => u.VisibilityChangeRequests)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.AdminReviewedByUser)
                .WithMany()
                .HasForeignKey(e => e.AdminReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── CMS mode: MediaAsset ──────────────────────────────────────────
        modelBuilder.Entity<MediaAsset>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Sha256).IsRequired().HasMaxLength(64);
            entity.Property(e => e.OriginalName).IsRequired().HasMaxLength(500);
            entity.Property(e => e.MimeType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.FileUrl).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.ThumbnailUrl).HasMaxLength(1000);

            // Dedupe: same owner cannot have two rows for the same file content.
            entity.HasIndex(e => new { e.OwnerId, e.Sha256 })
                .IsUnique()
                .HasDatabaseName("IX_MediaAssets_Owner_Sha256");

            entity.HasOne(e => e.Owner)
                .WithMany()
                .HasForeignKey(e => e.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── CMS mode: Playlist ────────────────────────────────────────────
        modelBuilder.Entity<Playlist>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.PlaylistType).HasConversion<int>();

            entity.HasIndex(e => e.ScreenId).HasDatabaseName("IX_Playlists_ScreenId");

            entity.HasOne(e => e.Screen)
                .WithMany(s => s.Playlists)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── CMS mode: PlaylistItem ────────────────────────────────────────
        modelBuilder.Entity<PlaylistItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ItemType).HasConversion<int>();

            entity.HasIndex(e => new { e.PlaylistId, e.Order })
                .HasDatabaseName("IX_PlaylistItems_Playlist_Order");

            entity.HasOne(e => e.Playlist)
                .WithMany(p => p.Items)
                .HasForeignKey(e => e.PlaylistId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.MediaAsset)
                .WithMany(m => m.PlaylistItems)
                .HasForeignKey(e => e.MediaAssetId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── CMS mode: PairingCode ─────────────────────────────────────────
        modelBuilder.Entity<PairingCode>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(12);
            entity.Property(e => e.PlayerFingerprint).HasMaxLength(256);

            entity.HasIndex(e => e.Code)
                .IsUnique()
                .HasDatabaseName("IX_PairingCodes_Code");
            entity.HasIndex(e => e.CreatedByUserId)
                .HasDatabaseName("IX_PairingCodes_CreatedByUserId");

            entity.HasOne(e => e.CreatedByUser)
                .WithMany()
                .HasForeignKey(e => e.CreatedByUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Screen)
                .WithMany()
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── CMS mode: RemoteCommand ───────────────────────────────────────
        modelBuilder.Entity<RemoteCommand>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CommandType).HasConversion<int>();
            entity.Property(e => e.Status).HasConversion<int>();
            entity.Property(e => e.ErrorMessage).HasMaxLength(1000);

            entity.HasIndex(e => new { e.ScreenId, e.IssuedAt })
                .HasDatabaseName("IX_RemoteCommands_Screen_IssuedAt");
            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_RemoteCommands_Status");

            entity.HasOne(e => e.Screen)
                .WithMany(s => s.RemoteCommands)
                .HasForeignKey(e => e.ScreenId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.IssuedByUser)
                .WithMany()
                .HasForeignKey(e => e.IssuedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ── CMS mode: Screen.DefaultPlaylist ──────────────────────────────
        modelBuilder.Entity<Screen>(entity =>
        {
            entity.Property(e => e.DisplayType).HasConversion<int>();
            entity.Property(e => e.LocationTag).HasMaxLength(200);

            entity.HasOne(e => e.DefaultPlaylist)
                .WithMany()
                .HasForeignKey(e => e.DefaultPlaylistId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── CMS mode: User.AccountType ────────────────────────────────────
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(e => e.AccountType).HasConversion<int>();
            entity.HasIndex(e => e.AccountType).HasDatabaseName("IX_Users_AccountType");
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
