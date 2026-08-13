# CCMS Backend Dockerfile
# Multi-stage build for .NET 8.0 ASP.NET Core API

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files first (for better caching)
COPY CCMS.Api/CCMS.Api.csproj CCMS.Api/
COPY CCMS.Application/CCMS.Application.csproj CCMS.Application/
COPY CCMS.Domain/CCMS.Domain.csproj CCMS.Domain/
COPY CCMS.Infrastructure/CCMS.Infrastructure.csproj CCMS.Infrastructure/
COPY CCMS.Shared/CCMS.Shared.csproj CCMS.Shared/

# Restore dependencies
RUN dotnet restore CCMS.Api/CCMS.Api.csproj

# Copy all source code
COPY . .

# Build the application
WORKDIR /src/CCMS.Api
RUN dotnet build -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for healthchecks, font libraries for QuestPDF/SkiaSharp,
# and ffmpeg so the app never downloads binaries from the internet at boot
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libfontconfig1 \
    libfreetype6 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r ccms && useradd -r -g ccms ccms

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs && chown -R ccms:ccms /app

# Copy published application
COPY --from=publish /app/publish .

# Change ownership of application files
RUN chown -R ccms:ccms /app

# Switch to non-root user
USER ccms

# Expose port
EXPOSE 8080

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check — readiness endpoint (verifies DB connectivity)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health/ready || exit 1

# Start the application
ENTRYPOINT ["dotnet", "CCMS.Api.dll"]
