# 🔑 Test User Accounts

## Seeded Test Users

### Advertisers:
1. **advertiser1@example.com**
   - Password: `Password123!`
   - Role: Advertiser
   - Name: John Advertiser
   - Has 2 campaigns

2. **advertiser2@example.com**
   - Password: `Password123!`
   - Role: Advertiser
   - Name: Jane Marketing
   - Has 2 campaigns

### Screen Owners:
1. **owner1@example.com** ⭐
   - Password: `Password123!`
   - Role: ScreenOwner
   - Name: Mike ScreenOwner
   - Owns: Times Square LED Wall, Downtown Mall Display, Stadium Jumbotron
   - **Has 2 pending bookings to approve**

2. **owner2@example.com**
   - Password: `Password123!`
   - Role: ScreenOwner
   - Name: Sarah Media
   - Owns: Airport Terminal Screen, Subway Station Display
   - Has 1 completed booking

### Admin:
- **admin@example.com**
   - Password: `Password123!`
   - Role: Admin
   - Name: Admin User
   - Can see everything

---

## Existing Bookings

### For owner1@example.com screens:
1. **Booking 1** - APPROVED
   - Screen: Times Square LED Wall
   - Campaign: Summer Sale 2024
   - Status: Approved ✅

2. **Booking 2** - PENDING ⏳
   - Screen: Downtown Mall Display
   - Campaign: Summer Sale 2024
   - Creative: Products Showcase Video
   - Status: **Pending Approval**

3. **Booking 4** - REJECTED ❌
   - Screen: Times Square LED Wall
   - Campaign: New Product Launch
   - Status: Rejected
   - Reason: Time slots already booked

### For owner2@example.com screens:
1. **Booking 3** - COMPLETED
   - Screen: Airport Terminal Screen
   - Campaign: Brand Awareness Q4
   - Status: Completed ✅

---

## How to Test Screen Owner Approval

1. **Login as Screen Owner**:
   ```
   Email: owner1@example.com
   Password: Password123!
   ```

2. **Go to Bookings Page**:
   - You should see 1 pending booking
   - Click **Approve** to review
   - See the creative preview
   - Approve or reject

3. **Create More Bookings**:
   - Login as advertiser1@example.com
   - Create booking for owner1's screens
   - Logout and login as owner1@example.com
   - Approve the booking

---

## Note About Custom Users

If you created **screenowner1@example.com** manually:
- This account is NOT in the seed data
- It has no screens assigned
- Create screens for this account to see bookings

To use the account with existing test data:
- Use **owner1@example.com** instead

---

## Quick Test Flow

### Test Booking Approval:
1. Login: `owner1@example.com` / `Password123!`
2. Go to Bookings → Pending tab
3. Should see 1 pending booking
4. Click Approve → See creative  
5. Approve or Reject

### Test Creating Booking:
1. Login: `advertiser1@example.com` / `Password123!`
2. Go to Campaigns → Summer Sale 2024
3. Create new booking for any screen
4. Logout, login as owner1@example.com
5. Approve the new booking

---

All test accounts use password: **Password123!**
