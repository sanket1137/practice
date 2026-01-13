# Email & Phone Verification Implementation

## Overview
This document summarizes the implementation of mandatory email and phone verification for user registration.

## Implementation Details

### Option A: Block Login Until Both Verified
- Users cannot login until both email AND phone are verified
- Registration flow: Register → Verify Email (via link) → Verify Phone (via OTP) → Login

### OTP Storage: Database
- OTPs are stored in the `PhoneVerificationOtps` table (not Redis)
- Each OTP has a 10-minute validity window
- Maximum 3 verification attempts per OTP

### Rate Limiting
- Maximum 5 OTPs per phone number per hour
- Enforced at database level by counting recent OTP records

## Files Created/Modified

### Backend - Domain Layer
- `CCMS.Domain/Entities/EmailVerificationToken.cs` - Token entity for email verification
- `CCMS.Domain/Entities/PhoneVerificationOtp.cs` - OTP entity for phone verification  
- `CCMS.Domain/Entities/User.cs` - Added `IsPhoneVerified` field and navigation properties

### Backend - Application Layer
- `CCMS.Application/Interfaces/IEmailService.cs` - Email service interface
- `CCMS.Application/Interfaces/ISmsService.cs` - SMS service interface
- `CCMS.Application/Features/Auth/Commands/SendEmailVerificationCommand.cs`
- `CCMS.Application/Features/Auth/Commands/SendEmailVerificationCommandHandler.cs`
- `CCMS.Application/Features/Auth/Commands/VerifyEmailCommand.cs`
- `CCMS.Application/Features/Auth/Commands/VerifyEmailCommandHandler.cs`
- `CCMS.Application/Features/Auth/Commands/SendPhoneOtpCommand.cs`
- `CCMS.Application/Features/Auth/Commands/SendPhoneOtpCommandHandler.cs`
- `CCMS.Application/Features/Auth/Commands/VerifyPhoneOtpCommand.cs`
- `CCMS.Application/Features/Auth/Commands/VerifyPhoneOtpCommandHandler.cs`

### Backend - Infrastructure Layer
- `CCMS.Infrastructure/Services/EmailService.cs` - AWS SES email implementation
- `CCMS.Infrastructure/Services/SmsService.cs` - ComBirds SMS API implementation
- `CCMS.Infrastructure/Data/ApplicationDbContext.cs` - Added DbSets and entity configurations
- `CCMS.Infrastructure/CCMS.Infrastructure.csproj` - Added AWSSDK.SimpleEmail package

### Backend - API Layer  
- `CCMS.Api/Controllers/AuthController.cs` - Added 5 verification endpoints
- `CCMS.Api/Program.cs` - Registered services
- `appsettings.json` - Added AWS SES and ComBirds configuration

### Frontend
- `frontend/src/pages/auth/VerifyEmailPage.tsx` - Email verification page
- `frontend/src/pages/auth/VerifyPhonePage.tsx` - Phone OTP verification (3-step flow)
- `frontend/src/pages/auth/ResendVerificationPage.tsx` - Resend verification email
- `frontend/src/pages/auth/RegisterPage.tsx` - Added phone number field
- `frontend/src/types/auth.ts` - Updated types
- `frontend/src/App.tsx` - Added routes for verification pages

## API Endpoints

### POST /api/auth/send-email-verification
```json
{
  "email": "user@example.com"
}
```
Response: `{ success: true, message: "...", expiresAt: "..." }`

### POST /api/auth/verify-email
```json
{
  "token": "verification-token-from-email"
}
```
Response: `{ success: true, email: "verified@example.com" }`

### POST /api/auth/send-phone-otp
```json
{
  "email": "user@example.com",
  "phoneNumber": "9876543210"
}
```
Response: `{ success: true, expiresAt: "...", remainingAttempts: 4 }`

### POST /api/auth/verify-phone
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```
Response: `{ success: true, isFullyVerified: true }`

### GET /api/auth/verification-status/{email}
Response: `{ isEmailVerified: true, isPhoneVerified: false, isFullyVerified: false }`

## Configuration Required

### appsettings.json
```json
{
  "AWS": {
    "SES": {
      "AccessKeyId": "YOUR_ACCESS_KEY",
      "SecretAccessKey": "YOUR_SECRET_KEY",
      "Region": "ap-south-1",
      "FromEmail": "noreply@pixelspot.in"
    }
  },
  "ComBirds": {
    "ApiKey": "YOUR_API_KEY",
    "UserId": "YOUR_USER_ID",
    "Password": "YOUR_PASSWORD",
    "Header": "YOUR_DLT_HEADER",
    "BaseUrl": "https://api.combirds.in/api"
  },
  "App": {
    "BaseUrl": "https://your-domain.com"
  }
}
```

## Registration Flow

1. User fills registration form (including phone number)
2. Backend creates user with `IsEmailVerified = false`, `IsPhoneVerified = false`
3. Backend sends verification email via AWS SES
4. User clicks email verification link → `VerifyEmailPage` handles it
5. After email verified, user is redirected to phone verification
6. User enters phone number → receives OTP via ComBirds SMS
7. User enters OTP → phone is verified
8. User can now login

## Database Migration

A new migration `AddEmailPhoneVerification` has been created. Run:
```bash
dotnet ef database update --project CCMS.Infrastructure --startup-project CCMS.Api
```

## Testing

### Email Verification
1. Register a new user
2. Check email for verification link
3. Click link → should verify email
4. Try login → should fail (phone not verified)

### Phone Verification
1. After email verification, navigate to `/verify-phone`
2. Enter phone number (10-digit Indian mobile)
3. Receive OTP via SMS
4. Enter OTP
5. Phone verified → can now login

### Rate Limiting
- Request 6+ OTPs for same phone → should get rate limit error
- Enter wrong OTP 3 times → OTP invalidated, request new one
