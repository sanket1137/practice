using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using CCMS.Api.Extensions;
using CCMS.Api.Hubs;
using CCMS.Api.Middleware;
using CCMS.Api.Services;
using CCMS.Application.Behaviors;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.HttpOverrides;
using CCMS.Application.Interfaces;
using CCMS.Application.Mappings;
using CCMS.Application.Services;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Infrastructure.Repositories;
using CCMS.Infrastructure.Services;
using Swashbuckle.AspNetCore.SwaggerGen;
using Npgsql;
using Serilog;
using Serilog.Events;
using QuestPDF.Infrastructure;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Text.Json;

// QuestPDF community license
QuestPDF.Settings.License = LicenseType.Community;

// Bootstrap Serilog early so startup errors are captured
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

var builder = WebApplication.CreateBuilder(args);

// Replace default logging with Serilog
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(
        path: Path.Combine("logs", "ccms-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        fileSizeLimitBytes: 50 * 1024 * 1024,
        rollOnFileSizeLimit: true));

// Sentry error tracking
var sentryDsn = builder.Configuration["Sentry:Dsn"];
if (!string.IsNullOrWhiteSpace(sentryDsn))
{
    builder.WebHost.UseSentry(options =>
    {
        options.Dsn = sentryDsn;
        options.TracesSampleRate = builder.Environment.IsProduction() ? 0.1 : 0.0;
        options.SendDefaultPii = false;
        options.Environment = builder.Environment.EnvironmentName;
        options.MaxBreadcrumbs = 50;
    });
}

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Global exception handling — RFC 7807 ProblemDetails, no internal detail leakage
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Behind nginx: trust forwarded headers so rate limiting and logging see real client IPs
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

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
Log.Information("[CONFIG] Database:Provider = {DatabaseProvider}", databaseProvider);

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
    Log.Information("Using PostgreSQL database with SplitQuery optimization");
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
    Log.Information("Using SQL Server database");
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

// JWT Authentication — refuse to boot on a missing, short, or placeholder key.
// A weak signing key means anyone can forge tokens, so this must fail loudly.
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"];
if (string.IsNullOrWhiteSpace(jwtSecretKey)
    || jwtSecretKey.Length < 32
    || jwtSecretKey.Contains("${")
    || jwtSecretKey.Contains("your-super-secret-key"))
{
    throw new InvalidOperationException(
        "Jwt:SecretKey is missing, a placeholder, or shorter than 32 characters. " +
        "Set a cryptographically random key via the Jwt__SecretKey environment variable.");
}

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

// AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfiles));

// MediatR with validation pipeline — every command/query runs its FluentValidation
// validators before the handler executes.
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(MappingProfiles).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
});
builder.Services.AddValidatorsFromAssembly(typeof(MappingProfiles).Assembly);

// Repository and Unit of Work
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();


// Application Services
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICmsPairingService, CmsPairingService>();
builder.Services.AddScoped<IPlayerPairingService, PlayerPairingService>();
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
Log.Information("[CONFIG] FileStorage:Provider = {FileStorageProvider}", fileStorageProvider);

// Use Singleton for storage services to reuse connections and avoid repeated initialization
var localFileService = new LocalFileStorageService(builder.Configuration);

if (fileStorageProvider.Equals("AzureBlob", StringComparison.OrdinalIgnoreCase))
{
    var azureService = new AzureBlobStorageService(builder.Configuration);
    builder.Services.AddSingleton<IFileStorageService>(sp =>
        new FallbackFileStorageService(azureService, localFileService, sp.GetRequiredService<ILogger<FallbackFileStorageService>>()));
    Log.Information("Using Azure Blob Storage for file uploads (with Local fallback)");
}
else if (fileStorageProvider.Equals("R2", StringComparison.OrdinalIgnoreCase))
{
    var r2Service = new R2StorageService(builder.Configuration);
    builder.Services.AddSingleton(r2Service);
    builder.Services.AddSingleton<IPresignedUploadService>(r2Service);
    builder.Services.AddSingleton<IFileStorageService>(sp =>
        new FallbackFileStorageService(r2Service, localFileService, sp.GetRequiredService<ILogger<FallbackFileStorageService>>()));
    Log.Information("Using Cloudflare R2 Storage for file uploads (with Local fallback)");
}
else
{
    builder.Services.AddSingleton<IFileStorageService>(localFileService);
    Log.Information("Using Local File System for file uploads");
}

builder.Services.AddScoped<IPlaylistService, PlaylistService>();
builder.Services.AddScoped<BookingCalculationService>();
builder.Services.AddScoped<IRevenueCalculationService, RevenueCalculationService>();
builder.Services.AddScoped<SlotAvailabilityService>();
builder.Services.AddScoped<PlaylistGeneratorService>();
builder.Services.AddScoped<CreativeValidationService>();

// Set up FFmpeg. Prefer a system-installed binary (the Docker image installs
// ffmpeg via apt); only fall back to a background download for bare-metal dev
// machines. Downloading executables at boot is a supply-chain risk in prod.
var systemFfmpeg = new[] { "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg" }
    .FirstOrDefault(File.Exists);

if (systemFfmpeg is not null)
{
    Xabe.FFmpeg.FFmpeg.SetExecutablesPath(Path.GetDirectoryName(systemFfmpeg)!);
    Log.Information("Using system FFmpeg at {FfmpegPath}", systemFfmpeg);
}
else
{
    var ffmpegPath = Path.Combine(Path.GetTempPath(), "ffmpeg");
    Directory.CreateDirectory(ffmpegPath);
    var ffmpegBinary = OperatingSystem.IsWindows() ? "ffmpeg.exe" : "ffmpeg";

    _ = Task.Run(async () =>
    {
        try
        {
            if (!File.Exists(Path.Combine(ffmpegPath, ffmpegBinary)))
            {
                Log.Information("Downloading FFmpeg binaries in background (~100MB)...");
                await Xabe.FFmpeg.Downloader.FFmpegDownloader.GetLatestVersion(
                    Xabe.FFmpeg.Downloader.FFmpegVersion.Official,
                    ffmpegPath);
                Log.Information("FFmpeg downloaded successfully.");
            }
            else
            {
                Log.Information("FFmpeg already available at {FfmpegPath}", ffmpegPath);
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "FFmpeg download failed; video uploads will fail until FFmpeg is available.");
        }
    });

    Xabe.FFmpeg.FFmpeg.SetExecutablesPath(ffmpegPath);
}

builder.Services.AddScoped<VideoMetadataService>();
builder.Services.AddScoped<BookingStatusUpdateService>();
builder.Services.AddScoped<IStreamAccessService, StreamAccessService>();
builder.Services.AddScoped<ScreenVerificationService>();

// Report export service
builder.Services.AddScoped<ReportExportService>();

// Memory cache for caching (used by Google Places Service)
builder.Services.AddMemoryCache();

// -- Phase 2: Distributed cache (Redis in production, in-memory fallback in dev) --
var redisConnection = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnection;
        options.InstanceName = "PixelCCMS:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

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

// Health Checks — Postgres connectivity
var pgConnectionString = builder.Configuration.GetConnectionString("PostgresConnection");
builder.Services.AddHealthChecks()
    .AddNpgSql(
        connectionString: pgConnectionString ?? string.Empty,
        name: "postgresql",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "db", "postgresql" });

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();

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

// Liveness: process is up — never touches dependencies, so a transient DB blip
// doesn't get healthy pods killed by the orchestrator.
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false
}).AllowAnonymous();

// Readiness: dependencies (Postgres) are reachable.
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("db")
}).AllowAnonymous();

// Health check endpoint — returns JSON with postgres status
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var result = JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            timestamp = DateTime.UtcNow,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration.TotalMilliseconds
            })
        });
        await context.Response.WriteAsync(result);
    }
}).AllowAnonymous();

app.MapControllers();

// Auto-apply migrations
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var seedLogger = services.GetRequiredService<ILogger<Program>>();
        context.Database.Migrate();
        seedLogger.LogInformation("Database migration applied successfully.");

        // Seed data in development mode — isolated so a partial failure here
        // does not block subsequent independent seeders (tags, India screens...).
        var env = services.GetRequiredService<IWebHostEnvironment>();
        if (env.IsDevelopment())
        {
            try
            {
                await DataSeeder.SeedAsync(context);
                Log.Information("Seed data applied successfully.");
            }
            catch (Exception seedEx)
            {
                seedLogger.LogWarning(seedEx, "DataSeeder skipped/failed (likely partial existing data); continuing with other seeders.");
                // Critical: discard any tracked-but-unsaved entities from the failed seeder
                // so subsequent seeders don't retry/clash with them on their next SaveChanges.
                context.ChangeTracker.Clear();
            }
        }

        // Demo marketplace screens are development/staging data — never write them
        // into a production database. Opt in explicitly via Seeding:DemoScreens.
        var seedDemoScreens = env.IsDevelopment()
            || app.Configuration.GetValue<bool>("Seeding:DemoScreens");
        if (seedDemoScreens)
        {
            try
            {
                await IndianScreensSeeder.SeedAsync(context);
                seedLogger.LogInformation("Indian marketplace demo screens seeded successfully.");
            }
            catch (Exception seedEx)
            {
                seedLogger.LogWarning(seedEx, "IndianScreensSeeder failed.");
            }
        }

        // Master data (idempotent): screen tags and festival calendar.
        try
        {
            await ScreenTagSeeder.SeedTagsAsync(context);
            seedLogger.LogInformation("Screen tags seeded successfully.");
        }
        catch (Exception seedEx)
        {
            seedLogger.LogWarning(seedEx, "ScreenTagSeeder failed.");
        }

        try
        {
            await FestivalSeeder.SeedAsync(context);
            seedLogger.LogInformation("Festival calendar seeded successfully.");
        }
        catch (Exception seedEx)
        {
            seedLogger.LogWarning(seedEx, "FestivalSeeder failed.");
        }
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating the database.");
        // A half-migrated schema must never serve production traffic.
        if (app.Environment.IsProduction())
        {
            throw;
        }
    }
}

app.Run();
