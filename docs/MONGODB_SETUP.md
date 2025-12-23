# MongoDB Atlas Setup Guide

## Overview

This guide walks you through setting up MongoDB Atlas for the J_kube Rummikub application. MongoDB Atlas is a cloud-hosted MongoDB service that provides reliable database hosting for the game's user authentication and game state persistence.

## Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click "Try Free" or "Sign Up"
3. Create your account using email or Google/GitHub authentication
4. Verify your email address if required

## Step 2: Create a New Cluster

1. After logging in, click "Create a New Cluster" or "Build a Database"
2. Choose the **FREE** tier (M0 Sandbox)
3. Select your preferred cloud provider and region (AWS, Google Cloud, or Azure)
4. Name your cluster (e.g., "jkube-cluster")
5. Click "Create Cluster"

**Note**: Cluster creation takes 3-7 minutes. You'll see a progress indicator.

## Step 3: Configure Database Access

### Create Database User

1. In the Atlas dashboard, click "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication method
4. Enter a username (e.g., "jkube-user")
5. Generate a secure password or create your own
6. **IMPORTANT**: Save these credentials securely - you'll need them for the connection string
7. Under "Database User Privileges", select "Read and write to any database"
8. Click "Add User"

### Configure Network Access

1. Click "Network Access" in the left sidebar
2. Click "Add IP Address"
3. For development: Click "Allow Access from Anywhere" (adds 0.0.0.0/0)
4. For production: Add your specific IP addresses
5. **For Netlify deployment**: You MUST use "Allow Access from Anywhere" since Netlify uses dynamic IPs
6. Click "Confirm"

## Step 4: Get Connection String

1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" as the driver and version 4.1 or later
5. Copy the connection string - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 5: Configure Connection String

1. Replace `<username>` with your database username
2. Replace `<password>` with your database password
3. Add the database name after `.net/` - use `jkube`:
   ```
   mongodb+srv://jkube-user:yourpassword@cluster0.xxxxx.mongodb.net/jkube?retryWrites=true&w=majority
   ```

## Step 6: Test Connection

### Local Testing

1. Create a `.env` file in your project root:
   ```bash
   MONGODB_URI=mongodb+srv://jkube-user:yourpassword@cluster0.xxxxx.mongodb.net/jkube?retryWrites=true&w=majority
   JWT_SECRET=your-super-secret-jwt-key-here
   NODE_ENV=development
   PORT=8000
   ```

2. Test the connection by running your application locally:
   ```bash
   npm start
   ```

3. Look for connection success messages in the console:
   ```
   ✅ MongoDB Connected Successfully
   🎮 Server running on port 8000
   ```

### Troubleshooting Connection Issues

#### Authentication Failed
```
❌ AUTHENTICATION ERROR

Your MongoDB credentials are incorrect. Please check:
1. Username and password in MONGODB_URI
2. Database user permissions in MongoDB Atlas
3. IP whitelist settings (add 0.0.0.0/0 for Netlify)
```

**Solution**: 
- Verify username/password in Atlas Database Access
- Ensure user has "Read and write to any database" privileges
- Check Network Access allows your IP

#### Network Timeout
```
❌ NETWORK ERROR

Cannot reach MongoDB Atlas. Please check:
1. Internet connectivity
2. MongoDB Atlas cluster status
3. Firewall settings
4. DNS resolution
```

**Solution**:
- Check your internet connection
- Verify cluster is running (not paused)
- Add 0.0.0.0/0 to Network Access for broad compatibility

#### Invalid Database Name
```
❌ DATABASE ERROR

Database name 'jkube' not accessible
```

**Solution**:
- Ensure database name is included in connection string
- Verify user has access to the specified database

## Step 7: Production Deployment

### For Netlify Functions

1. In Netlify dashboard, go to Site Settings → Environment Variables
2. Add the following variables:
   ```
   MONGODB_URI = mongodb+srv://jkube-user:yourpassword@cluster0.xxxxx.mongodb.net/jkube?retryWrites=true&w=majority
   JWT_SECRET = your-super-secret-jwt-key-here
   NODE_ENV = production
   ```

3. **Security Note**: Never commit `.env` files to version control

### Connection String Security

- Use environment variables for all sensitive data
- Rotate passwords regularly
- Use different credentials for development and production
- Monitor Atlas access logs for suspicious activity

## Database Collections

The application will automatically create these collections:

- **users**: User authentication and profile data
- **games**: Game state and player information  
- **stats**: Game statistics and leaderboards

Indexes are created automatically for optimal performance.

## Monitoring and Maintenance

### Atlas Dashboard Features

1. **Metrics**: Monitor database performance and usage
2. **Profiler**: Analyze slow queries
3. **Alerts**: Set up notifications for issues
4. **Backup**: Automatic backups are included in free tier

### Best Practices

- Monitor connection count (free tier has 500 connection limit)
- Use connection pooling in production
- Implement proper error handling for database operations
- Regular backup verification (Atlas handles automatic backups)

## Support and Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Node.js Driver Documentation](https://mongodb.github.io/node-mongodb-native/)
- [Connection String Format](https://docs.mongodb.com/manual/reference/connection-string/)

## Quick Reference

### Required Environment Variables
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jkube
JWT_SECRET=your-secret-key
NODE_ENV=production
PORT=8000
```

### Connection Test Command
```bash
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connection successful'))
  .catch(err => console.error('❌ Connection failed:', err.message));
"
```