# CCMS Quick Start Guide

Welcome to the Content and Campaign Management System (CCMS)! This guide will help you get started quickly.

## 🚀 Quick Start (5 Minutes)

### Step 1: Initial Setup
```powershell
# Navigate to the project directory
cd practice

# Run the setup script (one-time setup)
.\setup.ps1
```

This will:
- Install EF Core tools
- Restore backend dependencies
- Apply database migrations (creates the CCMS database)
- Install frontend dependencies
- Create the dummy user for testing

### Step 2: Start the Application
```powershell
# Start both backend and frontend
.\start-all.ps1
```

This opens two terminal windows:
- **Backend**: ASP.NET Core API on http://localhost:5257
- **Frontend**: React app on http://localhost:5173

### Step 3: Login
1. Open your browser to http://localhost:5173
2. You'll see the login page
3. Use these credentials:
   - **Email**: `dummy@example.com`
   - **Password**: `Password123!`

### Step 4: Explore
- **Swagger API Docs**: http://localhost:5257/swagger
- **Frontend Dashboard**: http://localhost:5173/dashboard (after login)

## 📱 What Can You Do?

### As an Advertiser (Dummy User)
1. **Create Campaigns**
   - Go to Campaigns → Create New
   - Set budget, dates, and description

2. **Upload Creatives**
   - Select a campaign
   - Upload video/image content
   - Preview your creative

3. **Book Screens**
   - Browse available screens
   - Select time slots
   - Submit booking request
   - Wait for screen owner approval

4. **Track Performance**
   - View impression counts
   - Monitor campaign progress
   - Check booking status

### Using the API Directly
1. Open http://localhost:5257/swagger
2. Click "Authorize" button
3. Login to get a token
4. Use the token to test API endpoints

## 🔧 Common Tasks

### Reset the Database
```powershell
# Delete the database
# In SQL Server Management Studio or Azure Data Studio:
# DROP DATABASE CCMS;

# Then run setup again
.\setup.ps1
```

### Stop the Application
```powershell
# Press Ctrl+C in both terminal windows
# Or close the terminal windows
```

### View Logs
- **Backend**: Check the terminal running the API
- **Frontend**: Check browser console (F12)

### Update Dependencies
```powershell
# Backend
cd backend
dotnet restore

# Frontend
cd frontend
npm install
```

## 🎯 Next Steps

### For Developers
1. **Explore the Code**
   - Backend: `backend/CCMS.Api/Controllers/`
   - Frontend: `frontend/src/pages/`
   - Database: `backend/CCMS.Infrastructure/Data/`

2. **Add New Features**
   - Create new API endpoints
   - Build new frontend pages
   - Add business logic in Application layer

3. **Test the API**
   - Use Swagger UI
   - Use Postman
   - Write unit tests

### For Testing
1. **Create Test Data**
   - Register new users
   - Create multiple campaigns
   - Add various screens
   - Make bookings

2. **Test Workflows**
   - Complete advertiser journey
   - Test screen owner approval flow
   - Verify impression tracking

3. **Test Real-time Features**
   - Connect Raspberry Pi player
   - Monitor live playback
   - Track impressions in real-time

## 🐛 Troubleshooting

### "Port already in use"
```powershell
# Find and kill the process using the port
netstat -ano | findstr :5257
taskkill /PID <process_id> /F
```

### "Database connection failed"
- Ensure SQL Server LocalDB is installed
- Check connection string in `appsettings.json`
- Run `.\setup.ps1` to create the database

### "Frontend won't start"
```powershell
cd frontend
rm -rf node_modules
npm install
npm run dev
```

### "Migration errors"
```powershell
# Reset migrations
cd backend
dotnet ef database drop --project CCMS.Infrastructure --startup-project CCMS.Api
dotnet ef database update --project CCMS.Infrastructure --startup-project CCMS.Api
```

## 📚 Additional Resources

- **Full Documentation**: See `README.md`
- **Completion Status**: See `COMPLETION_STATUS.md`
- **API Reference**: http://localhost:5257/swagger
- **Architecture Diagram**: See `README.md`

## 🎓 Learning Path

### Week 1: Basics
- [ ] Understand the project structure
- [ ] Explore the database schema
- [ ] Test all API endpoints
- [ ] Complete the advertiser workflow

### Week 2: Development
- [ ] Add a new API endpoint
- [ ] Create a new frontend page
- [ ] Implement a new feature
- [ ] Write tests

### Week 3: Advanced
- [ ] Set up Raspberry Pi player
- [ ] Implement real-time features
- [ ] Add analytics dashboard
- [ ] Deploy to production

## 💡 Pro Tips

1. **Use Swagger**: It's the fastest way to test API endpoints
2. **Check Browser Console**: Most frontend errors appear here
3. **Use React DevTools**: Install the browser extension for debugging
4. **Hot Reload**: Both backend and frontend support hot reload
5. **Database Viewer**: Use Azure Data Studio to view database contents

## 🤝 Need Help?

1. Check the `COMPLETION_STATUS.md` for known issues
2. Review the `README.md` for detailed documentation
3. Check the code comments for inline documentation
4. Use the browser's developer tools for debugging

---

**Happy Coding! 🚀**

Last Updated: December 4, 2024
