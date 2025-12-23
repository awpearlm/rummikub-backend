# Environment Variable Configuration Guide

## Overview

This guide covers all environment variables required for the J_kube Rummikub application, including setup for local development and production deployment on Netlify.

## Required Environment Variables

### Core Application Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGODB_URI` | ✅ Yes | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/jkube` |
| `JWT_SECRET` | ✅ Yes | Secret key for JWT token signing | `your-super-secret-jwt-key-minimum-32-chars` |
| `NODE_ENV` | ✅ Yes | Environment indicator | `development` or `production` |
| `PORT` | ⚠️ Optional | Server port (Netlify ignores this) | `8000` |

### Optional Configuration Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DB_NAME` | ❌ No | Database name override | `jkube` |
| `SESSION_TIMEOUT` | ❌ No | User session timeout (minutes) | `60` |
| `GAME_CLEANUP_INTERVAL` | ❌ No | Game cleanup interval (minutes) | `30` |
| `LOG_LEVEL` | ❌ No | Logging verbosity | `info` |

## Local Development Setup

### Step 1: Create .env File

Create a `.env` file in your project root directory:

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/jkube?retryWrites=true&w=majority

# Authentication
JWT_SECRET=your-super-secret-jwt-key-that-should-be-at-least-32-characters-long

# Environment
NODE_ENV=development

# Server Configuration
PORT=8000

# Optional: Debugging
LOG_LEVEL=debug
```

### Step 2: Environment File Security

**IMPORTANT**: Never commit `.env` files to version control!

1. Ensure `.env` is in your `.gitignore`:
   ```gitignore
   # Environment variables
   .env
   .env.local
   .env.*.local
   ```

2. Create `.env.example` for team reference:
   ```bash
   # Copy this file to .env and fill in your values
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jkube
   JWT_SECRET=your-secret-key-here
   NODE_ENV=development
   PORT=8000
   ```

### Step 3: Validate Configuration

Run the configuration validator:

```bash
npm run validate-env
```

Or manually test with Node.js:

```javascript
// test-env.js
require('dotenv').config();

const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
const missing = requiredVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing);
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
}
```

## Production Deployment (Netlify)

### Step 1: Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site Settings** → **Environment Variables**
3. Click **Add Variable** for each required variable:

```bash
# Production Environment Variables
MONGODB_URI = mongodb+srv://prod-user:secure-password@prod-cluster.mongodb.net/jkube?retryWrites=true&w=majority
JWT_SECRET = production-jwt-secret-key-minimum-32-characters-long
NODE_ENV = production
```

### Step 2: Netlify-Specific Considerations

**Serverless Functions**: Netlify Functions have specific requirements:

- Environment variables are automatically available in functions
- No need to set `PORT` (Netlify manages this)
- Functions timeout after 10 seconds (free tier) or 15 minutes (pro)

**Build Environment**: Variables needed during build vs runtime:

```bash
# Build-time variables (if needed)
REACT_APP_API_URL = /.netlify/functions

# Runtime variables (for functions)
MONGODB_URI = your-connection-string
JWT_SECRET = your-secret-key
```

### Step 3: Environment Variable Security

**Production Security Checklist**:

- ✅ Use different MongoDB credentials for production
- ✅ Generate new JWT secret for production (minimum 32 characters)
- ✅ Enable IP whitelisting in MongoDB Atlas (0.0.0.0/0 for Netlify)
- ✅ Rotate secrets regularly
- ✅ Monitor access logs

## Environment-Specific Configuration

### Development Environment

```bash
# .env.development
MONGODB_URI=mongodb+srv://dev-user:dev-pass@dev-cluster.mongodb.net/jkube-dev
JWT_SECRET=development-secret-key-for-testing-only
NODE_ENV=development
PORT=8000
LOG_LEVEL=debug
```

**Development Features**:
- Detailed error messages
- Debug logging enabled
- Hot reloading
- Development database

### Production Environment

```bash
# Netlify Environment Variables
MONGODB_URI=mongodb+srv://prod-user:secure-pass@prod-cluster.mongodb.net/jkube
JWT_SECRET=production-secret-minimum-32-characters-long
NODE_ENV=production
LOG_LEVEL=error
```

**Production Features**:
- Minimal error messages to users
- Error logging only
- Optimized performance
- Production database

### Testing Environment

```bash
# .env.test
MONGODB_URI=mongodb://localhost:27017/jkube-test
JWT_SECRET=test-secret-key-for-automated-tests
NODE_ENV=test
LOG_LEVEL=silent
```

## Configuration Validation

### Automatic Validation

The application includes built-in environment validation:

```javascript
// config/validateEnv.js
const validateEnvironment = () => {
  const required = {
    MONGODB_URI: 'MongoDB connection string',
    JWT_SECRET: 'JWT signing secret (minimum 32 characters)',
    NODE_ENV: 'Environment (development/production/test)'
  };

  const errors = [];
  
  Object.entries(required).forEach(([key, description]) => {
    if (!process.env[key]) {
      errors.push(`❌ ${key}: ${description}`);
    }
  });

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('❌ JWT_SECRET: Must be at least 32 characters long');
  }

  // Validate MONGODB_URI format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
    errors.push('❌ MONGODB_URI: Must be a valid MongoDB connection string');
  }

  if (errors.length > 0) {
    console.error('\n🚨 Environment Configuration Errors:\n');
    errors.forEach(error => console.error(error));
    console.error('\nPlease check your .env file or environment variables.\n');
    process.exit(1);
  }

  console.log('✅ Environment configuration validated successfully');
};
```

### Manual Validation Commands

```bash
# Check if all variables are set
npm run check-env

# Test database connection
npm run test-db

# Validate JWT secret strength
npm run validate-jwt
```

## Troubleshooting

### Common Issues

#### Missing Environment Variables
```
Error: Missing required environment variable: MONGODB_URI
```
**Solution**: Check your `.env` file or Netlify environment variables

#### Invalid MongoDB URI
```
Error: Invalid connection string format
```
**Solution**: Verify your MongoDB Atlas connection string format

#### JWT Secret Too Short
```
Error: JWT secret must be at least 32 characters
```
**Solution**: Generate a longer secret key

#### Environment File Not Loaded
```
Error: Cannot read property 'MONGODB_URI' of undefined
```
**Solution**: Ensure `require('dotenv').config()` is called early in your application

### Debug Commands

```bash
# Print all environment variables (be careful with secrets!)
node -e "console.log(process.env)"

# Check specific variables
node -e "console.log('MONGODB_URI:', !!process.env.MONGODB_URI)"
node -e "console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length)"

# Test MongoDB connection
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connection successful'))
  .catch(err => console.error('❌ MongoDB connection failed:', err.message));
"
```

## Best Practices

### Security
- Never log sensitive environment variables
- Use different secrets for each environment
- Rotate secrets regularly
- Use strong, random JWT secrets
- Implement proper secret management in production

### Organization
- Group related variables together
- Use descriptive variable names
- Document all variables in `.env.example`
- Validate configuration on application startup

### Deployment
- Use CI/CD environment-specific configurations
- Test environment variables before deployment
- Monitor for configuration drift
- Implement configuration backup and recovery

## Quick Reference

### Minimum Required .env File
```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jkube
JWT_SECRET=minimum-32-character-secret-key-here
NODE_ENV=development
```

### Environment Variable Checklist
- [ ] `.env` file created and configured
- [ ] All required variables set
- [ ] JWT secret is at least 32 characters
- [ ] MongoDB URI is valid and accessible
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` created for team reference
- [ ] Production variables set in Netlify
- [ ] Configuration validation passes