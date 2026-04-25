using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using CCMS.Api.Extensions;
using CCMS.Api.Hubs;
using CCMS.Api.Services;
using CCMS.Application.Interfaces;
using CCMS.Application.Mappings;
using CCMS.Application.Services;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Infrastructure.Repositories;
using CCMS.Infrastructure.Services;
using Swashbuckle.AspNetCore.SwaggerGen;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// API Versioning
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new Asp.Versioning.ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new Asp.Versioning.UrlSegmentApiVersionReader();
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// Add SignalR for real-time connectivity
builder.Services.AddSignalR();

// Swagger/OpenAPI configuration
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "CCMS API", 
        Version = "v1",
        Description = "Content and Campaign Management System API"
    });
    
    // JWT Authentication in Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
    
    // Handle file upload parameters (commented out temporarily - access API directly instead of Swagger for file uploads)
    // c.OperationFilter<FileUploadOperationFilter>();
});

// Database - Support both SQL Server and PostgreSQL
var databaseProvider = builder.Configuration["Database:Provider"] ?? "SqlServer";
Console.WriteLine($"[CONFIG] Database:Provider = '{databaseProvider}'");

if (databaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(
            builder.Configuration.GetConnectionString("PostgresConnection"),
            npgsqlOptions => {
                npgsqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(30),
                    errorCodesToAdd: null
                );
                // Use split queries by default to avoid Cartesian explosion with multiple Includes
                npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            }
        ));
    Console.WriteLine("Using PostgreSQL database with SplitQuery optimization");
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sqlOptions => sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null
            )
        ));
    Console.WriteLine("Using SQL Server database");
}



// CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:3000", "http://localhost:5173", "http://localhost:5174" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// JWT Authentication
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"] 
    ?? throw new InvalidOperationException("JWT Secret Key not configured");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
    
    // SignalR JWT support
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            
            if (!string.IsNullOrEmpty(accessToken) && 
                (path.StartsWithSegments("/hubs") || path.StartsWithSegments("/playerhub")))
            {
                context.Token = accessToken;
            }
            
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR();

// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfiles));

// MediatR
builder.Services.AddMediatR(cfg => 
    cfg.RegisterServicesFromAssembly(typeof(MappingProfiles).Assembly));

// Repository and Unit of Work
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();


// Application Services
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICmsPairingService, CmsPairingService>();
builder.Services.AddScoped<ICmsMediaService, CmsMediaService>();
builder.Services.AddScoped<ICmsPlaylistService, CmsPlaylistService>();
builder.Services.AddScoped<IRemoteCommandService, RemoteCommandService>();

// Player API-key auth helper (used by CmsControlHub to gate SubscribePlayer).
builder.Services.AddSingleton<CCMS.Api.Security.PlayerAuthenticationService>();

// Email & SMS Services for verification
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ISmsService, SmsService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IRazorpayService, RazorpayService>();
builder.Services.AddScoped<INotificationService, CCMS.Api.Services.NotificationService>();
builder.Services.AddHttpClient("ComBirds"); // HttpClient for SMS API

// File Storage Service - configurable via appsettings
// Supports: "Local", "AzureBlob", "R2" (Cloudflare)
var fileStorageProvider = builder.Configuration["FileStorage:Provider"] ?? "Local";
Console.WriteLine($"[CONFIG] FileStorage:Provider value read from config: '{fileStorageProvider}'");

// Use Singleton for storage services to reuse connections and avoid repeated initialization
if (fileStorageProvider.Equals("AzureBlob", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IFileStorageService, AzureBlobStorageService>();
    Console.WriteLine("Using Azure Blob Storage for file uploads");
}
else if (fileStorageProvider.Equals("R2", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<R2StorageService>();
    builder.Services.AddSingleton<IFileStorageService>(sp => sp.GetRequiredService<R2StorageService>());
    builder.Services.AddSingleton<IPresignedUploadService>(sp => sp.GetRequiredService<R2StorageService>());
    Console.WriteLine("Using Cloudflare R2 Storage for file uploads (S3-compatible, zero egress)");
}
else
{
    builder.Services.AddSingleton<IFileStorageService, LocalFileStorageService>();
    Console.WriteLine("Using Local File System for file uploads");
}

builder.Services.AddScoped<IPlaylistService, PlaylistService>();
builder.Services.AddScoped<BookingCalculationService>();
builder.Services.AddScoped<IRevenueCalculationService, RevenueCalculationService>();
builder.Services.AddScoped<SlotAvailabilityService>();
builder.Services.AddScoped<PlaylistGeneratorService>();
builder.Services.AddScoped<CreativeValidationService>();

// Set up FFmpeg - download in background to avoid blocking
var ffmpegPath = Path.Combine(Path.GetTempPath(), "ffmpeg");
Directory.CreateDirectory(ffmpegPath);

// Download FFmpeg in background, don't block startup
_ = Task.Run(async () =>
{
    try
    {
        if (!File.Exists(Path.Combine(ffmpegPath, "ffmpeg.exe")))
        {
            Console.WriteLine("⏬ Downloading FFmpeg binaries in background (~100MB, may take 1-2 minutes)...");
            await Xabe.FFmpeg.Downloader.FFmpegDownloader.GetLatestVersion(
                Xabe.FFmpeg.Downloader.FFmpegVersion.Official, 
                ffmpegPath);
            Console.WriteLine("✅ FFmpeg downloaded successfully!");
        }
        else
        {
            Console.WriteLine("✅ FFmpeg already available at: " + ffmpegPath);
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ FFmpeg download failed: {ex.Message}");
        Console.WriteLine("Video uploads will fail until FFmpeg is available.");
    }
});

Xabe.FFmpeg.FFmpeg.SetExecutablesPath(ffmpegPath);

builder.Services.AddScoped<VideoMetadataService>();
builder.Services.AddScoped<BookingStatusUpdateService>();
builder.Services.AddScoped<IStreamAccessService, StreamAccessService>();
builder.Services.AddScoped<ScreenVerificationService>();

// Report export service
builder.Services.AddScoped<ReportExportService>();

// Memory cache for caching (used by Google Places Service)
builder.Services.AddMemoryCache();

// Google Places Service for screen tagging (Singleton to reuse HTTP client and cache)
builder.Services.AddHttpClient("GooglePlaces");
builder.Services.AddSingleton<IGooglePlacesService, GooglePlacesService>();

// Screen Tagging Service
builder.Services.AddScoped<ScreenTaggingService>();

// Screen Image Service
builder.Services.AddScoped<IScreenImageService, ScreenImageService>();

// Security services for access control
builder.Services.AddScoped<AdvertiserScreenAccessService>();
builder.Services.AddSingleton<ScreenViewerManager>();
builder.Services.AddScoped<PlayerDeviceManager>();

// Real-time notification services
builder.Services.AddScoped<CCMS.Application.Interfaces.IPlaylistNotificationService, CCMS.Api.Services.PlaylistNotificationService>();
builder.Services.AddScoped<CCMS.Application.Interfaces.IBookingNotificationService, CCMS.Api.Services.BookingNotificationService>();

// TimeZone Service (Singleton for performance)
builder.Services.AddSingleton<ITimeZoneService, TimeZoneService>();

// Background Services
builder.Services.AddHostedService<CCMS.Api.Services.ScreenStatusMonitor>();

// Add impression flush service (background timer-based flush)
builder.Services.AddHostedService<CCMS.Api.Services.ImpressionFlushService>();

// Add stream expiry service (auto-cleanup stale streams)
builder.Services.AddHostedService<CCMS.Api.Services.StreamExpiryService>();

// Add access revocation service (auto-disconnect when booking ends)
builder.Services.AddHostedService<CCMS.Api.Services.AccessRevocationBackgroundService>();

// Add refresh token cleanup service (security - removes expired tokens daily)
builder.Services.AddHostedService<CCMS.Api.Services.RefreshTokenCleanupService>();

// Add orphaned blob cleanup service (storage - removes old files after 160 days)
builder.Services.AddHostedService<CCMS.Api.Services.OrphanedBlobCleanupService>();

// Add Booking status monitor (in development only)
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddHostedService<BookingStatusBackgroundService>();
}


// Azure Blob Storage
builder.Services.AddSingleton(x =>
{
    var connectionString = builder.Configuration.GetValue<string>("AzureStorage:ConnectionString");
    return new Azure.Storage.Blobs.BlobServiceClient(connectionString);
});
builder.Services.AddScoped<IBlobStorageService, BlobStorageService>();

// Rate Limiting policies
builder.Services.AddRateLimitingPolicies();

// Static Files (for uploads)
builder.Services.AddDirectoryBrowser();

var app = builder.Build();

// Eagerly resolve the storage singleton so its constructor-side background
// tasks (e.g. R2 bucket CORS configuration) run at startup instead of lazily
// on the first upload. Fixes a race where the browser's presigned PUT beats
// the CORS-setup call to R2.
if (fileStorageProvider.Equals("R2", StringComparison.OrdinalIgnoreCase))
{
    _ = app.Services.GetRequiredService<R2StorageService>();
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "CCMS API V1");
    });
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

// Rate limiting - must be before authentication
app.UseRateLimiter();

// Static files for uploads
var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

// Static files for demo videos
var demoVideosPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "demo-videos");
if (!Directory.Exists(demoVideosPath))
{
    Directory.CreateDirectory(demoVideosPath);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(demoVideosPath),
    RequestPath = "/demo-videos",
    ServeUnknownFileTypes = true,
    DefaultContentType = "video/mp4"
});

// SignalR Hub - Map BEFORE authentication to allow negotiate endpoint
// Authentication is skipped for negotiate, then enforced in hub methods if needed
app.MapHub<PlaybackHub>("/hubs/playback").AllowAnonymous();
app.MapHub<PlayerHub>("/playerhub").AllowAnonymous();
app.MapHub<StreamingHub>("/hubs/streaming"); // WebRTC signaling hub (requires auth)
app.MapHub<NotificationHub>("/hubs/notifications"); // Notification push (requires auth)
// CmsControlHub accepts both dashboards (JWT) and players (API key).
// Auth is enforced inside each hub method, not at the connection level.
app.MapHub<CmsControlHub>("/hubs/cms").AllowAnonymous();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Auto-apply migrations
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        context.Database.Migrate();
        Console.WriteLine("Database migration applied successfully.");
        
        // Seed data in development mode
        var env = services.GetRequiredService<IWebHostEnvironment>();
        if (env.IsDevelopment())
        {
            await DataSeeder.SeedAsync(context);
            Console.WriteLine("Seed data applied successfully.");
        }
        
        // Always seed screen tags (master data)
        await ScreenTagSeeder.SeedTagsAsync(context);
        Console.WriteLine("Screen tags seeded successfully.");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating the database.");
    }
}

app.Run();
