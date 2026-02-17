# 🔒 CCMS Security Architecture

## Overview

This document outlines the security measures implemented in the CCMS (Creative Content Management System) to protect:
- **Player ↔ Server** communication
- **Client ↔ Server** communication
- **Data integrity** (impressions, playlists)
- **Access control** (who can control what)

---

## 🏗️ Security Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────┐        TLS 1.3/HTTPS           ┌──────────────┐          │
│   │  Player  │◄──────────────────────────────►│    Server    │          │
│   │(Rasp Pi) │    + HMAC Signed Requests      │  (.NET API)  │          │
│   └──────────┘    + Session Tokens            └──────────────┘          │
│        │                                              ▲                  │
│        │ Device                                       │ JWT              │
│        │ Fingerprint                                  │ Tokens           │
│        ▼                                              │                  │
│   ┌──────────┐                                ┌──────────────┐          │
│   │  Local   │                                │   Client     │          │
│   │ Config   │                                │ (Dashboard)  │          │
│   └──────────┘                                └──────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Measures by Component

### 1. Transport Layer Security (TLS)

| Requirement | Implementation |
|-------------|----------------|
| **Protocol** | TLS 1.3 only (TLS 1.2 minimum) |
| **Certificate** | Let's Encrypt with auto-renewal |
| **HSTS** | Strict-Transport-Security header |
| **Certificate Pinning** | Optional for high-security deployments |

**Nginx Configuration:**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

### 2. Player Authentication

#### Handshake Flow
```
Player                              Server
  │                                    │
  │  1. Handshake Request              │
  │  ─────────────────────────────────►│
  │  {screenId, apiKeyHash,            │
  │   nonce, deviceFingerprint,        │
  │   timestamp}                       │
  │                                    │
  │  2. Handshake Response             │
  │  ◄─────────────────────────────────│
  │  {sessionToken, serverSalt,        │
  │   expiresAt, signature}            │
  │                                    │
  │  3. All Subsequent Requests        │
  │  ─────────────────────────────────►│
  │  Headers:                          │
  │  - X-Screen-Id                     │
  │  - X-Session-Token                 │
  │  - X-Timestamp                     │
  │  - X-Signature (HMAC-SHA256)       │
  │                                    │
```

#### Security Headers
| Header | Purpose |
|--------|---------|
| `X-Screen-Id` | Identifies the player device |
| `X-Session-Token` | Proves authenticated session |
| `X-Timestamp` | Prevents replay attacks (±5 min window) |
| `X-Signature` | HMAC-SHA256 of payload + timestamp + token |

#### API Key Storage
- **Server**: BCrypt hash (work factor 12)
- **Player**: Environment variable or encrypted config
- **Never**: Plain text in version control

---

### 3. Impression Integrity

Each impression includes a tamper-proof hash:

```python
def create_impression_hash(impression_data, screen_id, session_token, api_key):
    data = {
        **impression_data,
        "screenId": screen_id,
        "sessionToken": session_token[:16]  # First 16 chars only
    }
    canonical = json.dumps(data, sort_keys=True)
    return hmac.new(api_key, canonical, hashlib.sha256).hexdigest()[:32]
```

**Server validates:**
1. Hash matches recalculation
2. Timestamp within valid window
3. Session token is active
4. Screen ID matches session

---

### 4. Dashboard/Client Authentication

| Feature | Implementation |
|---------|----------------|
| **Auth Method** | JWT (JSON Web Tokens) |
| **Token Expiry** | 60 minutes |
| **Refresh** | Sliding window |
| **Claims** | userId, role, email |
| **Storage** | HttpOnly cookie (preferred) or localStorage |

**JWT Security:**
- RS256 or HS256 with strong secret
- Include `iat`, `exp`, `iss`, `aud` claims
- Validate on every request

---

### 5. SignalR Hub Security

#### PlayerHub
```csharp
// Dashboard users must be authenticated
if (Context.User?.Identity?.IsAuthenticated != true)
{
    Context.Abort();
    return;
}

// Players identified by clientType=player query param
// and must complete handshake with valid API key
```

#### StreamingHub
- Rate limiting (1 request/second)
- Role-based access (Admin, ScreenOwner, Advertiser)
- Screen ownership validation
- Connection timeout management

---

### 6. Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| API General | 10 requests/second |
| Login | 5 requests/minute |
| Streaming | 1 request/second per connection |

**Implementation:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
```

---

### 7. Device Fingerprinting (Optional)

Players can generate a unique fingerprint to detect config theft:

```python
components = [
    platform.node(),           # Hostname
    platform.machine(),        # Hardware type
    uuid.getnode(),           # MAC address
    # Raspberry Pi specific:
    '/sys/firmware/devicetree/base/serial-number',
    '/proc/cpuinfo Serial'
]
fingerprint = sha256("|".join(components))
```

**Enforcement:**
- Fingerprint checked at handshake
- Alert if fingerprint changes
- Optional: block mismatched fingerprints

---

## 🛡️ Attack Mitigation

| Attack | Mitigation |
|--------|------------|
| **Man-in-the-Middle** | TLS 1.3, certificate pinning |
| **Replay Attack** | Timestamp validation (±5 min) |
| **API Key Theft** | BCrypt hashing, device fingerprint |
| **Session Hijacking** | Short-lived tokens, IP binding |
| **Impression Fraud** | HMAC signatures, timestamp validation |
| **Brute Force** | Rate limiting, account lockout |
| **XSS** | Content Security Policy headers |
| **CSRF** | SameSite cookies, CSRF tokens |

---

## 📋 Security Checklist

### Before Production Deployment

- [ ] **TLS/HTTPS enabled** on all endpoints
- [ ] **API keys hashed** with BCrypt (not plain text)
- [ ] **JWT secret** is strong (32+ characters)
- [ ] **Rate limiting** configured in nginx
- [ ] **Security headers** added (HSTS, X-Frame-Options, etc.)
- [ ] **CORS** restricted to known origins
- [ ] **Database credentials** in environment variables
- [ ] **Secrets removed** from version control
- [ ] **Logs** don't contain sensitive data
- [ ] **Error messages** don't leak implementation details

### Player Security

- [ ] **HTTPS URL** in player config
- [ ] **API key** stored securely (env var preferred)
- [ ] **Device fingerprint** enabled
- [ ] **Session validation** implemented
- [ ] **Offline queue** encrypted at rest

### Monitoring

- [ ] **Failed auth attempts** logged and alerted
- [ ] **Anomaly detection** for impression patterns
- [ ] **Certificate expiry** monitored
- [ ] **Rate limit violations** tracked

---

## 🔑 Secret Management

### Development
```bash
# Use .NET User Secrets
dotnet user-secrets set "Jwt:SecretKey" "your-32-char-secret"
dotnet user-secrets set "AWS:SES:AccessKeyId" "your-key"
```

### Production
```yaml
# Use environment variables or secrets manager
environment:
  - JWT__SecretKey=${JWT_SECRET}
  - AWS__SES__AccessKeyId=${AWS_ACCESS_KEY}
```

### Never
- Commit secrets to git
- Log secrets
- Include secrets in error messages
- Use default/weak secrets

---

## 📚 Implementation Files

| File | Purpose |
|------|---------|
| [player/security_manager.py](player/security_manager.py) | Player-side security implementation |
| [backend/CCMS.Api/Security/PlayerAuthenticationService.cs](backend/CCMS.Api/Security/PlayerAuthenticationService.cs) | Server-side auth validation |
| [nginx/nginx.production.conf](nginx/nginx.production.conf) | TLS and rate limiting config |

---

## 🚀 Quick Start

### 1. Enable HTTPS on Player
```json
// player/config.json
{
    "server_url": "https://api.yourdomain.com",
    ...
}
```

### 2. Generate Secure API Key
```python
import secrets
api_key = secrets.token_urlsafe(32)
print(f"Player API Key: {api_key}")
```

### 3. Hash and Store API Key
```csharp
var hash = BCrypt.Net.BCrypt.HashPassword(apiKey, workFactor: 12);
screen.ApiKeyHash = hash;
await _screenRepository.UpdateAsync(screen);
```

### 4. Configure Player with API Key
```bash
# On Raspberry Pi
export CCMS_PLAYER_API_KEY="your-generated-api-key"
```

---

## 📞 Security Incident Response

If you suspect a security breach:

1. **Rotate** all API keys immediately
2. **Invalidate** all active sessions
3. **Review** access logs
4. **Update** TLS certificates if compromised
5. **Notify** affected users if data was exposed
