# Render Environment Variable Fix

## Problem
The backend deployment is failing because the `MONGODB_URI` environment variable is missing, causing CORS errors on the frontend.

## Solution
You need to add the missing environment variable in your Render dashboard:

### Step 1: Access Render Dashboard
1. Go to https://dashboard.render.com
2. Find your `rummikub-backend` service
3. Click on it to open the service details

### Step 2: Add Environment Variables
1. Click on "Environment" in the left sidebar
2. Add the following environment variables:

```
MONGODB_URI = mongodb+srv://your-username:your-password@your-cluster.mongodb.net/jkube
JWT_SECRET = your-jwt-secret-key
NODE_ENV = production
PORT = 10000
```

### Step 3: Check Current Variables
If you already have environment variables set, make sure they are named exactly as shown above. Common issues:
- `MONGO_URI` instead of `MONGODB_URI` (incorrect)
- Missing `MONGODB_URI` entirely
- Incorrect MongoDB connection string format

### Step 4: Redeploy
After adding/fixing the environment variables:
1. The service should automatically redeploy
2. Check the logs to confirm it starts successfully
3. Test the login at https://jkube.netlify.app

## Expected Success
When fixed, you should see in the Render logs:
```
✅ MongoDB connected successfully
🚀 Server running on port 10000
```

Instead of:
```
⚠️ MISSING ENVIRONMENT VARIABLES
- MONGODB_URI
```

## Test the Fix
Once deployed, test the admin login:
- Email: `pearlman.aaron@gmail.com`
- Password: `j1ll14nm3`