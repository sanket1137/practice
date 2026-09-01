using CCMS.Application.Interfaces;
using CCMS.Application.Services;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;
using CCMS.Infrastructure.Repositories;
using CCMS.Infrastructure.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((context, services) =>
    {
        var configuration = context.Configuration;

        // Database - read from ConnectionStrings__DefaultConnection in local.settings.json
        var connectionString = configuration["ConnectionStrings__DefaultConnection"] 
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string not found");
            
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(
                connectionString,
                sqlOptions => sqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(30),
                    errorNumbersToAdd: null
                )
            ));

        // Repository and Unit of Work
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Application Services
        services.AddScoped<BookingStatusUpdateService>();

        // BookingStatusUpdateService dependencies this host was silently missing —
        // resolving the service previously THREW at runtime (IRazorpayService was
        // never registered here), so the serverless status job has been dead
        // since refund polling was added. Notifications become log lines in this
        // host (no SignalR infrastructure); Razorpay uses the real client.
        services.AddScoped<CCMS.Application.Interfaces.IRazorpayService, CCMS.Infrastructure.Services.RazorpayService>();
        services.AddScoped<CCMS.Application.Interfaces.INotificationService, CCMS.Application.Services.NullNotificationService>();

        // Infrastructure services used by jobs
        services.AddScoped<IEmailService, EmailService>();

        // HttpClient (required by EmailService / external services)
        services.AddHttpClient();

        // IConfiguration for EmailService
        services.AddSingleton(configuration);

        // Logging (Application Insights - optional, commented out for local dev)
        // services.AddApplicationInsightsTelemetryWorkerService();
        // services.ConfigureFunctionsApplicationInsights();
    })
    .Build();

host.Run();
