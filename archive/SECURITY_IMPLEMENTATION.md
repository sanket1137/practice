# CCMS Security Implementation

## Overview

This document describes the security measures implemented in the CCMS (Content and Campaign Management System) to protect against unauthorized access, API abuse, and ensure secure communication between components.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Dashboard     │     │    Backend      │     │    Player       │
│   (React)       │◄───►│    (.NET 8)     │◄───►│    (Python)     │
│   JWT Auth      │     │    PostgreSQL   │     │    API Key      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Security Layers

### 1. Authentication

#### Dashboard Users (JWT)
- **Type**: JWT Bearer tokens
- **Expiry**: 60 minutes (configurable)
- **Refresh**: Refresh tokens valid for 7 days
- **Claims**: User ID, Email, Role

#### Players (API Key + Device Binding)
- **Type**: BCrypt-hashed API keys
- **Device Binding**: SHA-256 fingerprint hash
- **Session**: 24-hour session tokens with HMAC verification

### 2. Device Binding (Players)

Each player device is bound to a screen using a unique fingerprint derived from:
- CPU Serial Number
- MAC Address
- Disk Serial Number
- Hostname

#### Device States
| State | Description |
|-------|-------------|
| `new_binding` | First connection, device is being bound |
| `bound` | Device is verified and bound to screen |
| `override` | Device override applied (new device) |
| `mismatch` | Different device attempted connection |

#### Device Override Process
1. Screen owner requests override via API
2. 30-minute window opens for new device
3. Any device with valid API key can connect during window
4. Previous device fingerprint is saved for audit

### 3. Rate Limiting

Policy-based rate limiting protects against abuse:

| Policy | Limit | Window | Use Case |
|--------|-------|--------|----------|
| `auth` | 10 requests | 5 minutes | Login, registration |
| `player` | 30 requests | 1 minute | Handshake, playlist sync |
| `api` | 100 requests | 1 minute | Dashboard API calls |
| `streaming` | 200 requests | 1 minute | WebRTC, impressions |

### 4. Access Control

#### Screen Owners
- Full access to their own screens
- Can generate API keys
- Can request device overrides
- Can manage owner content

#### Advertisers
- Access to approved bookings only
- 24-hour preview access before campaign start
- Revoked when booking ends

#### Admin
- Full system access
- Can clear device bindings
- Can override any access control

## API Endpoints

### Authentication
```
POST /api/auth/login          - User login (rate limited: 10/5min)
POST /api/auth/register       - User registration
POST /api/auth/refresh-token  - Refresh access token
```

### Player API
```
POST /api/player/handshake    - Initial handshake (rate limited: 30/min)
GET  /api/player/playlist     - Get current playlist
POST /api/player/impression   - Report impression
POST /api/player/heartbeat    - Keep-alive signal
```

### Screen Management
```
POST /api/screens/{id}/generate-api-key       - Generate new API key
POST /api/screens/{id}/request-device-override - Request device change
GET  /api/screens/{id}/device-status          - Get binding status
POST /api/screens/{id}/clear-device-binding   - Admin only
```

## Handshake Flow

```
Player                          Server
  │                               │
  ├──────── Handshake Request ───►│
  │   {screenId, apiKey,          │
  │    deviceFingerprint, nonce,  │
  │    timestamp}                 │
  │                               │
  │◄─────── Verify API Key ───────┤
  │       (BCrypt.Verify)         │
  │                               │
  │◄────── Validate Device ───────┤
  │       (Compare fingerprint)   │
  │                               │
  │◄──────── Response ────────────│
  │   {sessionToken, playlist,    │
  │    deviceBindingStatus}       │
  └───────────────────────────────┘
```

## Security Headers

All responses include:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## Configuration

### appsettings.json
```json
{
  "Jwt": {
    "SecretKey": "minimum-32-characters-secret-key",
    "Issuer": "PixelCCMS",
    "Audience": "PixelCCMSUsers",
    "ExpiryMinutes": 60
  }
}
```

### Player config.json
```json
{
  "screen_id": "guid",
  "api_key": "base64-encoded-key",
  "server_url": "https://api.example.com"
}
```

## Services

### PlayerDeviceManager
- Manages device fingerprint binding
- Handles device override requests
- 30-minute override window for device changes

### AdvertiserScreenAccessService
- Manages advertiser preview access
- 24-hour window before booking starts
- Auto-revokes when booking ends

### ScreenViewerManager
- Tracks concurrent stream viewers
- Limits viewers per screen (max 10)
- Real-time viewer count

### AccessRevocationBackgroundService
- Runs every 60 seconds
- Disconnects viewers when booking ends
- Cleans up stale sessions

## Testing

### Generate API Key
```powershell
$token = "your-jwt-token"
$headers = @{Authorization="Bearer $token"}
Invoke-RestMethod -Uri "http://localhost:5257/api/screens/{screenId}/generate-api-key" `
  -Method POST -Headers $headers
```

### Test Handshake
```powershell
$body = @{
  screenId = "guid"
  apiKey = "api-key"
  deviceFingerprint = "unique-fingerprint"
  nonce = [guid]::NewGuid().ToString()
  timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5257/api/player/handshake" `
  -Method POST -Body $body -ContentType "application/json"
```

### Request Device Override
```powershell
Invoke-RestMethod -Uri "http://localhost:5257/api/screens/{screenId}/request-device-override" `
  -Method POST -Headers @{Authorization="Bearer $token"} `
  -Body '{"reason":"Replacing Raspberry Pi"}' -ContentType "application/json"
```

## Security Best Practices

1. **Never expose API keys** in version control
2. **Rotate API keys** periodically or after suspected compromise
3. **Monitor rate limit** responses for abuse patterns
4. **Use HTTPS** in production
5. **Keep JWT secret** secure and different per environment

## Audit Trail

Device binding changes are logged:
- Previous fingerprint saved
- Override reason recorded
- User who requested override
- Timestamp of change

## Future Enhancements

- [ ] IP-based geo-blocking
- [ ] Webhook notifications for security events
- [ ] Hardware security module (HSM) for key storage
- [ ] Two-factor authentication for screen owners
- [ ] Anomaly detection for unusual access patterns
