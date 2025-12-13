# AUTHENTICATION FIX - Quick Resolution Guide

## Problem
- Users can't login - getting 401 Unauthorized
- Previously registered users not working

## Root Cause
The RegisterRequest expects `firstName` and `lastName` (separate fields), not `fullName`.

## Solution

### Step 1: Register User Correctly via Swagger

1. **Open Swagger**: http://localhost:5257/swagger

2. **Find POST /api/auth/register**

3. **Click "Try it out"**

4. **Use this EXACT request body**:
```json
{
  "email": "sanketdhole109@gmail.com",
  "password": "Sanket@123",
  "firstName": "Sanket",
  "lastName": "Dhole",
  "phoneNumber": "",
  "role": "Admin"
}
```

5. **Click "Execute"**

6. **If you get "User already exists" error**, that's OK! Use a slightly different email or reset the database (see below).

### Step 2: Login

**Via Frontend**:
1. Go to http://localhost:5173
2. Login with:
   - Email: `sanketdhole109@gmail.com`
   - Password: `Sanket@123`

**Via Swagger** (to test):
1. Find `POST /api/auth/login`
2. Click "Try it out"
3. Body:
```json
{
  "email": "sanketdhole109@gmail.com",
  "password": "Sanket@123"
}
```
4. Should return `accessToken` and `refreshToken`

---

## Alternative: Reset Database & Re-register

If the user still won't login after proper registration:

### Option A: Delete Old User Records (SQL)

1. **Connect to database**: `(localdb)\mssqllocaldb`, Database: `PracticePixelCCMSDb`

2. **Run this SQL**:
```sql
DELETE FROM RefreshTokens WHERE UserId IN (SELECT Id FROM Users WHERE Email = 'sanketdhole109@gmail.com');
DELETE FROM Users WHERE Email = 'sanketdhole109@gmail.com';
```

3. **Re-register** using Step 1 above

### Option B: Use Different Email

Just register with a fresh email:
```json
{
  "email": "sanket.test@gmail.com",
  "password": "Sanket@123",
  "firstName": "Sanket",
  "lastName": "Test",
  "role": "Admin"
}
```

---

## Verify It Works

After successful registration/login, you should see:

**In Swagger response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "expiresAt": "...",
    "user": {
      "id": "...",
      "email": "sanketdhole109@gmail.com",
      "firstName": "Sanket",
      "lastName": "Dhole",
      "role": "Admin"
    }
  }
}
```

**In Frontend**:
- You'll be logged in
- Can access Dashboard
- Can view Campaigns, Bookings, Screens

---

## For Second User

Repeat the same process:
```json
{
  "email": "sanketdhole595@gmail.com",
  "password": "Sanket@123",
  "firstName": "Sanket",
  "lastName": "Dhole 2",
  "role": "Advertiser"
}
```

---

## Current System Status

✅ **Backend**: Running on http://localhost:5257  
✅ **Frontend**: Running on http://localhost:5173  
✅ **Azure Function**: Running locally (updating bookings every 1 minute)  
✅ **Database**: PracticePixelCCMSDb  

The system is fully operational - just need to register/login correctly!
