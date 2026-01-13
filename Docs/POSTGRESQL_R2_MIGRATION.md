# PostgreSQL & Cloudflare R2 Migration Guide

This guide covers migrating CCMS from SQL Server + Azure Blob to PostgreSQL + Cloudflare R2.

## Overview

| Component | Development | Production |
|-----------|-------------|------------|
| Database | SQL Server LocalDB | PostgreSQL (Neon/Supabase) |
| Storage | Azurite (local) | Cloudflare R2 |
| Server | localhost | Hetzner VPS |

## Step 1: Set Up PostgreSQL

### Option A: Neon (Recommended for Serverless)
1. Go to [neon.tech](https://neon.tech) and create an account
2. Create a new project named "ccms-production"
3. Copy the connection string from the dashboard
4. Format: `Host=YOUR_HOST.neon.tech;Port=5432;Database=ccms;Username=YOUR_USER;Password=YOUR_PASS;SSL Mode=Require;Trust Server Certificate=true`

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Go to Settings > Database > Connection string
4. Use the "URI" connection string

### Option C: Self-hosted on Hetzner
```bash
# On your Hetzner VPS
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb ccms
sudo -u postgres createuser -P ccms_user
# Set strong password when prompted
```

## Step 2: Set Up Cloudflare R2

### Create R2 Bucket
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 > Create bucket
3. Name: `ccms-creatives`
4. Location hint: Choose nearest to your users (e.g., APAC for India)

### Create API Token
1. Go to R2 > Manage R2 API Tokens
2. Create new token with:
   - Permissions: Object Read & Write
   - Specify bucket: `ccms-creatives`
3. Save the Access Key ID and Secret Access Key

### Enable Public Access (Optional)
For direct public URLs without signed URLs:
1. Go to your bucket settings
2. Enable "R2.dev subdomain" for testing
3. For production: Set up a custom domain in R2 settings

## Step 3: Configure Application

### Environment Variables (Recommended)
Create a `.env` file or set in your deployment platform:

```bash
# Database
DATABASE_PROVIDER=PostgreSQL
POSTGRES_CONNECTION_STRING=Host=your-host.neon.tech;Port=5432;Database=ccms;Username=your_user;Password=your_pass;SSL Mode=Require;Trust Server Certificate=true

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=ccms-creatives
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# JWT
JWT_SECRET_KEY=your-super-secret-key-minimum-32-characters-long

# Email (AWS SES)
AWS_SES_ACCESS_KEY_ID=AKIAXXXXXXXX
AWS_SES_SECRET_ACCESS_KEY=xxxxxxxxxxxxxx
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# SMS (ComBirds)
COMBIRDS_API_KEY=your_api_key
COMBIRDS_SENDER_ID=CCMS
COMBIRDS_TEMPLATE_ID=your_template_id
```

### Update appsettings.Production.json
The file has been updated with placeholder values. In production, these should be overridden by environment variables.

## Step 4: Generate PostgreSQL Migrations

### Option A: Fresh Migration (Recommended for new deployments)
```bash
cd backend/CCMS.Infrastructure

# Delete existing SQL Server migrations
rm -rf Migrations/

# Update appsettings to use PostgreSQL
# Set Database:Provider to "PostgreSQL"

# Generate new migration
dotnet ef migrations add InitialPostgres -s ../CCMS.Api -c ApplicationDbContext

# Apply migration
dotnet ef database update -s ../CCMS.Api -c ApplicationDbContext
```

### Option B: Convert Existing Data
If you have existing data in SQL Server:

1. Export data from SQL Server:
```sql
-- Use SQL Server Management Studio to export to CSV
-- Or use bcp command line tool
```

2. Import to PostgreSQL:
```sql
-- Use psql \copy command or pgAdmin
```

## Step 5: Migrate Files to R2

If you have existing files in Azure Blob:

```python
# scripts/migrate_to_r2.py
import boto3
from azure.storage.blob import BlobServiceClient

# Azure source
azure_conn_str = "your_azure_connection_string"
azure_container = "creatives"

# R2 destination  
r2_account_id = "your_account_id"
r2_access_key = "your_access_key"
r2_secret_key = "your_secret_key"
r2_bucket = "ccms-creatives"

# Connect to Azure
azure_client = BlobServiceClient.from_connection_string(azure_conn_str)
container_client = azure_client.get_container_client(azure_container)

# Connect to R2 (S3-compatible)
r2_client = boto3.client(
    's3',
    endpoint_url=f'https://{r2_account_id}.r2.cloudflarestorage.com',
    aws_access_key_id=r2_access_key,
    aws_secret_access_key=r2_secret_key
)

# Migrate each blob
for blob in container_client.list_blobs():
    print(f"Migrating: {blob.name}")
    data = container_client.download_blob(blob.name).readall()
    r2_client.put_object(Bucket=r2_bucket, Key=blob.name, Body=data)
```

## Step 6: Update Database URLs

After migrating files, update the URLs in the database:

```sql
-- PostgreSQL
UPDATE "Creatives" 
SET "FileUrl" = REPLACE("FileUrl", 
    'https://your-old-azure-url.blob.core.windows.net/creatives/', 
    'https://your-r2-domain.r2.dev/')
WHERE "FileUrl" LIKE '%blob.core.windows.net%';

UPDATE "OwnerContent" 
SET "MediaUrl" = REPLACE("MediaUrl", 
    'https://your-old-azure-url.blob.core.windows.net/creatives/', 
    'https://your-r2-domain.r2.dev/')
WHERE "MediaUrl" LIKE '%blob.core.windows.net%';
```

## Step 7: Deploy to Hetzner

### Docker Compose for Production

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - Database__Provider=PostgreSQL
      - ConnectionStrings__PostgresConnection=${POSTGRES_CONNECTION_STRING}
      - FileStorage__Provider=R2
      - R2__AccountId=${R2_ACCOUNT_ID}
      - R2__AccessKeyId=${R2_ACCESS_KEY_ID}
      - R2__SecretAccessKey=${R2_SECRET_ACCESS_KEY}
      - R2__BucketName=ccms-creatives
      - R2__PublicUrlBase=${R2_PUBLIC_URL}
      - Jwt__SecretKey=${JWT_SECRET_KEY}
    ports:
      - "5257:80"
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_URL=https://api.yourdomain.com
    ports:
      - "3000:80"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
```

### Deploy Commands
```bash
# On Hetzner VPS
git pull origin main
docker-compose -f docker-compose.production.yml up -d --build
```

## Verification Checklist

- [ ] PostgreSQL connection successful
- [ ] R2 bucket accessible
- [ ] File uploads work
- [ ] File downloads work
- [ ] Database migrations applied
- [ ] CORS configured correctly
- [ ] HTTPS working
- [ ] SignalR connections working
- [ ] Email verification working
- [ ] SMS verification working

## Rollback Plan

If issues occur:

1. **Database**: Keep SQL Server LocalDB as backup
2. **Storage**: Keep Azure Blob files until R2 is verified
3. **Config**: Toggle `Database:Provider` and `FileStorage:Provider` back

## Cost Comparison

| Service | Monthly Cost (Est.) |
|---------|-------------------|
| Neon Free Tier | $0 (0.5GB storage) |
| Neon Pro | $19+ |
| Supabase Free | $0 (500MB) |
| Supabase Pro | $25+ |
| R2 | $0.015/GB storage, $0 egress |
| Hetzner CX22 | €4.35/mo |

**Total estimated: ~€5-25/month** vs $50-100+ for Azure equivalents

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Test connection
psql "host=your-host.neon.tech port=5432 dbname=ccms user=your_user sslmode=require"
```

### R2 Access Issues
```python
# Test R2 access
import boto3
client = boto3.client('s3', endpoint_url='https://ACCOUNT_ID.r2.cloudflarestorage.com', ...)
client.list_buckets()
```

### Migration Issues
```bash
# Check EF Core tools
dotnet tool list -g
dotnet tool install -g dotnet-ef

# Verbose migration
dotnet ef migrations add Test -s ../CCMS.Api -v
```
