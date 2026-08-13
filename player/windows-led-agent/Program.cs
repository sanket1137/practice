using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting.WindowsServices;
using PixelSpot.LedAgent;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "PixelSpot LED Agent");
builder.Services.AddHostedService<LedAgentWorker>();
var host = builder.Build();
host.Run();
