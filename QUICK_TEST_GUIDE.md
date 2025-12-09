# 🚀 Quick Test Guide

This guide helps you test all new features in under 10 minutes!

## Prerequisites ✅
- Backend running on http://localhost:5257
- Frontend running on http://localhost:5173
- Logged in as `dummy@example.com` / `Password123!`

---

## 🧪 5-Minute Test Checklist

### 1. Test Campaign Management (2 min)

**Create Campaign:**
1. Go to http://localhost:5173/campaigns
2. Click "Create Campaign"
3. Fill in:
   - Name: "Test Campaign"
   - Description: "Testing campaign features"
   - Budget: 5000
   - Currency: USD
   - Start/End dates: Select any range
   - Status: Active
4. Click "Create Campaign"
5. ✅ Should redirect to campaign list

**View Campaign Details:**
1. Click on the newly created campaign
2. ✅ Should see campaign info, stats, and tabs
3. Click "Creatives" tab
4. ✅ Should see empty state with upload button
5. Click "Bookings" tab
6. ✅ Should see empty state with booking button

### 2. Test Creative Upload (1 min)

1. In Campaign Details → Creatives tab
2. Click "Upload Creative"
3. Fill in:
   - Name: "Test Creative"
   - Type: Image
   - Duration: 10 seconds
   - File: Select any image
4. Click "Upload Creative"
5. ✅ Should return to campaign and show creative

### 3. Test Screen Discovery (1 min)

1. Go to http://localhost:5173/screens
2. ✅ Should see list of screens
3. Use search box to filter
4. Click on any screen
5. ✅ Should see screen details with specifications
6. ✅ "Book This Screen" button should be visible

### 4. Test Booking Creation (2 min)

**From Screen Detail:**
1. Click "Book This Screen" on an active screen
2. Form should pre-fill screen

**OR From Campaign:**
1. Go to Campaign Details → Bookings tab
2. Click "New Booking"

**Fill Booking Form:**
1. Select Campaign
2. Select Creative (from that campaign)
3. Select Screen
4. Choose dates
5. Enter slot count (e.g., 3)
6. ✅ Watch price calculate automatically
7. Click "Create Booking"
8. ✅ Should redirect to bookings list

### 5. Test Booking Management (1 min)

1. Go to http://localhost:5173/bookings
2. ✅ Should see your new booking with "Pending" status
3. Click "Approve" (if you're screen owner)
4. ✅ Status should change to "Approved"

---

## 🎯 Quick API Test (Using Swagger)

1. Go to http://localhost:5257/swagger
2. Click "Authorize" → Login
3. Test these endpoints:

### Campaigns
```
GET /api/campaigns - Get all campaigns
POST /api/campaigns - Create campaign
GET /api/campaigns/{id} - Get campaign details
GET /api/campaigns/{id}/creatives - Get creatives
```

### Bookings
```
GET /api/bookings - Get all bookings
POST /api/bookings - Create booking
PUT /api/bookings/{id}/approve - Approve booking
```

---

## 🔍 What to Look For

### ✅ Success Indicators
- Forms validate before submission
- Success messages appear (green snackbar)
- Data appears in lists immediately
- Navigation works smoothly
- Price calculations are correct
- Status badges show correct colors

### ❌ Common Issues (If Any)
- **401 Unauthorized**: Re-login
- **404 Not Found**: Check backend is running
- **500 Server Error**: Check backend logs
- **Network Error**: Check URLs match

---

## 📊 Expected Behavior

### Dashboard
- Shows campaign count
- Shows booking count  
- Shows recent items
- Quick action buttons work

### Campaigns
- List shows all campaigns
- Create form validates
- Details page has tabs
- Delete shows confirmation

### Screens
- List is filterable
- Details show specs
- Book button navigates correctly
- Inactive screens can't be booked

### Bookings
- Shows all bookings
- Status colors are correct
- Approve/Reject updates immediately
- Price displays correctly

### Creatives
- Upload accepts files
- Name is required
- Shows in campaign list
- Preview works for images

---

## 🐛 Troubleshooting

### Backend Not Responding
```powershell
# Check if running
netstat -ano | findstr :5257

# Restart if needed
cd backend
dotnet run --project CCMS.Api
```

### Frontend Not Loading
```powershell
# Check if running
netstat -ano | findstr :5173

# Restart if needed
cd frontend
npm run dev
```

### Database Issues
```powershell
# Reset database
cd backend
dotnet ef database drop --project CCMS.Infrastructure --startup-project CCMS.Api
dotnet ef database update --project CCMS.Infrastructure --startup-project CCMS.Api
```

### Still Having Issues?
1. Check browser console (F12)
2. Check backend terminal for errors
3. Verify you're logged in
4. Try clearing browser cache
5. Check network tab for failed requests

---

## ✨ Pro Tips

1. **Use Tab Key**: Navigate forms faster
2. **Check Network Tab**: See API calls in real-time
3. **Use React DevTools**: Debug state issues
4. **Check Swagger**: Test backend directly
5. **Use Ctrl+Shift+R**: Hard refresh if caching issues

---

## 📝 Test Data Suggestions

### Campaigns
- Summer Sale 2024
- Black Friday Campaign
- New Product Launch
- Holiday Promotion

### Creatives
- Upload various image formats (PNG, JPG)
- Upload different video formats (MP4)
- Try different durations (5s, 10s, 15s, 30s)

### Bookings
- Book for 1 week
- Book for 1 month
- Try different slot counts (1, 3, 5, 10)
- Test with different screens

---

## 🎉 Success!

If you can complete all 5 tests above without errors, **the application is fully functional!**

**Time to complete**: ~5-10 minutes  
**Difficulty**: Easy  
**Requirements**: Basic navigation skills

---

**Happy Testing! 🚀**
