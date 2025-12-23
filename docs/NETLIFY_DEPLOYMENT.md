# Netlify Deployment Checklist

## Overview

This comprehensive checklist ensures successful deployment of the J_kube Rummikub application to Netlify, covering both static site hosting and serverless functions for the multiplayer game backend.

## Pre-Deployment Preparation

### 1. Repository Setup

**GitHub Repository Checklist**:
- [ ] Repository is public or Netlify has access
- [ ] All code committed and pushed to main branch
- [ ] `.gitignore` includes sensitive files:
  ```gitignore
  # Environment variables
  .env
  .env.local
  .env.*.local
  
  # Dependencies
  node_modules/
  
  # Build outputs
  dist/
  build/
  .netlify/
  
  # Logs
  *.log
  npm-debug.log*
  ```

**Branch Strategy**:
- [ ] `main` branch for production deployments
- [ ] `develop` branch for staging (optional)
- [ ] Feature branches for development

### 2. Build Configuration

**Package.json Scripts**:
```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:functions",
    "build:client": "webpack --mode=production",
    "build:functions": "netlify-lambda build functions",
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:functions\"",
    "dev:client": "webpack serve --mode=development",
    "dev:functions": "netlify-lambda serve functions",
    "test": "jest",
    "test:e2e": "cypress run"
  }
}
```

**Build Dependencies**:
- [ ] All production dependencies in `dependencies`
- [ ] Build tools in `devDependencies`
- [ ] Node.js version specified in `.nvmrc` or `package.json`:
  ```json
  {
    "engines": {
      "node": ">=16.0.0",
      "npm": ">=8.0.0"
    }
  }
  ```

### 3. Netlify Configuration

**netlify.toml Configuration**:
```toml
[build]
  publish = "netlify-build"
  command = "npm run build"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "16"
  NPM_VERSION = "8"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[dev]
  command = "npm run dev"
  port = 8000
  publish = "netlify-build"
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization"
```

## Netlify Site Setup

### 1. Create New Site

**Via Netlify Dashboard**:
1. Log in to [Netlify](https://app.netlify.com)
2. Click "New site from Git"
3. Choose GitHub (or your Git provider)
4. Select your repository
5. Configure build settings:
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `netlify-build`

**Via Netlify CLI**:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

### 2. Environment Variables Configuration

**Required Environment Variables**:
```bash
# Database
MONGODB_URI = mongodb+srv://prod-user:secure-password@prod-cluster.mongodb.net/jkube?retryWrites=true&w=majority

# Authentication
JWT_SECRET = production-jwt-secret-minimum-32-characters-long

# Environment
NODE_ENV = production

# Optional: Debugging
LOG_LEVEL = error
```

**Setting Environment Variables**:
1. Go to Site Settings → Environment Variables
2. Click "Add Variable"
3. Enter key-value pairs
4. **Never** include quotes around values
5. Click "Save"

**Environment Variable Security**:
- [ ] Different credentials from development
- [ ] Strong JWT secret (32+ characters)
- [ ] MongoDB Atlas configured for production
- [ ] No sensitive data in repository

### 3. Domain Configuration

**Custom Domain Setup**:
1. Go to Site Settings → Domain Management
2. Click "Add custom domain"
3. Enter your domain (e.g., `jkube-rummikub.com`)
4. Configure DNS records:
   ```
   Type: CNAME
   Name: www
   Value: your-site-name.netlify.app
   
   Type: A
   Name: @
   Value: 75.2.60.5
   ```

**SSL Certificate**:
- [ ] Let's Encrypt SSL automatically enabled
- [ ] Force HTTPS enabled
- [ ] Certificate renewal automatic

## Function Deployment

### 1. Serverless Functions Structure

**Directory Structure**:
```
netlify/
└── functions/
    ├── auth.js          # Authentication endpoints
    ├── game.js          # Game management
    ├── socket.js        # WebSocket handling
    └── utils/
        ├── db.js        # Database utilities
        └── auth.js      # Auth utilities
```

**Function Template**:
```javascript
// netlify/functions/example.js
const { connectDB } = require('./utils/db');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Connect to database
    await connectDB();
    
    // Your function logic here
    const result = await processRequest(event);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      })
    };
  }
};
```

### 2. Function Limitations

**Netlify Function Constraints**:
- **Timeout**: 10 seconds (free), 15 minutes (pro)
- **Memory**: 1008 MB
- **Payload**: 6 MB request, 6 MB response
- **Concurrent executions**: 1000 (free), higher (pro)

**Optimization Strategies**:
- [ ] Keep functions lightweight
- [ ] Use connection pooling for database
- [ ] Implement proper error handling
- [ ] Cache frequently accessed data
- [ ] Minimize cold start time

### 3. WebSocket Handling

**Socket.IO with Netlify Functions**:
```javascript
// netlify/functions/socket.js
const { Server } = require('socket.io');
const { createServer } = require('http');

let io;

exports.handler = async (event, context) => {
  if (!io) {
    const server = createServer();
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Socket event handlers
    io.on('connection', (socket) => {
      console.log('Player connected:', socket.id);
      
      socket.on('join-game', (gameId) => {
        socket.join(gameId);
        socket.to(gameId).emit('player-joined', socket.id);
      });
      
      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
      });
    });
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Socket server running' })
  };
};
```

## Deployment Process

### 1. Pre-Deployment Testing

**Local Testing**:
```bash
# Test build process
npm run build

# Test functions locally
netlify dev

# Run test suite
npm test

# Run E2E tests
npm run test:e2e
```

**Staging Deployment**:
```bash
# Deploy to staging branch
netlify deploy --alias=staging

# Test staging environment
npm run test:staging
```

### 2. Production Deployment

**Automatic Deployment**:
- [ ] Push to main branch triggers deployment
- [ ] Build process completes successfully
- [ ] All tests pass
- [ ] Functions deploy without errors

**Manual Deployment**:
```bash
# Deploy to production
netlify deploy --prod

# Monitor deployment
netlify open --site
```

**Deployment Verification**:
- [ ] Site loads correctly
- [ ] All pages accessible
- [ ] Functions responding
- [ ] Database connections working
- [ ] Environment variables loaded
- [ ] SSL certificate active

### 3. Post-Deployment Monitoring

**Health Checks**:
```bash
# Check site status
curl -I https://your-site.netlify.app

# Test API endpoints
curl https://your-site.netlify.app/.netlify/functions/health

# Monitor function logs
netlify functions:log
```

**Performance Monitoring**:
- [ ] Lighthouse audit scores
- [ ] Function execution times
- [ ] Database query performance
- [ ] Error rates and logs

## Troubleshooting

### Common Deployment Issues

#### Build Failures

**Node.js Version Mismatch**:
```bash
# Error: Node version not supported
# Solution: Specify Node version in netlify.toml
[build.environment]
  NODE_VERSION = "16"
```

**Missing Dependencies**:
```bash
# Error: Module not found
# Solution: Ensure all dependencies in package.json
npm install --save missing-package
```

**Build Command Fails**:
```bash
# Error: Build command failed
# Solution: Test build locally first
npm run build
```

#### Function Errors

**Timeout Errors**:
```javascript
// Error: Function timeout
// Solution: Optimize function performance
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  // Your optimized code here
};
```

**Memory Errors**:
```javascript
// Error: Function out of memory
// Solution: Optimize memory usage
const processInChunks = (data) => {
  // Process data in smaller chunks
};
```

**Database Connection Issues**:
```javascript
// Error: Cannot connect to database
// Solution: Check environment variables and connection string
const mongoose = require('mongoose');

const connectDB = async () => {
  if (mongoose.connections[0].readyState) {
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 1 // Limit connections for serverless
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};
```

#### Environment Variable Issues

**Variables Not Loading**:
```bash
# Check if variables are set
netlify env:list

# Test variable access
netlify functions:invoke test-env
```

**Variable Formatting**:
```bash
# Incorrect: MONGODB_URI="mongodb://..."
# Correct: MONGODB_URI=mongodb://...
```

### Debug Commands

```bash
# View build logs
netlify logs

# Test functions locally
netlify functions:serve

# Check site status
netlify status

# View environment variables
netlify env:list

# Deploy with debug info
netlify deploy --debug
```

## Performance Optimization

### 1. Build Optimization

**Webpack Configuration**:
```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  performance: {
    maxAssetSize: 250000,
    maxEntrypointSize: 250000,
  },
};
```

**Asset Optimization**:
- [ ] Images compressed and optimized
- [ ] CSS minified and purged
- [ ] JavaScript bundled and minified
- [ ] Fonts subset and optimized

### 2. Function Optimization

**Cold Start Reduction**:
```javascript
// Keep database connection alive
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    return cachedDb;
  }
  
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  cachedDb = client.db();
  return cachedDb;
};
```

**Response Caching**:
```javascript
// Cache responses when appropriate
const cache = new Map();

exports.handler = async (event, context) => {
  const cacheKey = event.path + JSON.stringify(event.queryStringParameters);
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const result = await processRequest(event);
  cache.set(cacheKey, result);
  
  return result;
};
```

## Security Checklist

### 1. Environment Security

- [ ] Environment variables secured
- [ ] No secrets in repository
- [ ] Strong JWT secrets
- [ ] Database access restricted
- [ ] HTTPS enforced
- [ ] Security headers configured

### 2. Function Security

```javascript
// Input validation
const validateInput = (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid input data');
  }
  
  // Sanitize inputs
  Object.keys(data).forEach(key => {
    if (typeof data[key] === 'string') {
      data[key] = data[key].trim();
    }
  });
  
  return data;
};

// Rate limiting (basic)
const rateLimiter = new Map();

const checkRateLimit = (ip) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;
  
  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const limit = rateLimiter.get(ip);
  
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + windowMs;
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
};
```

## Final Deployment Checklist

### Pre-Launch Verification

- [ ] All environment variables configured
- [ ] Database connections working
- [ ] Functions deploying successfully
- [ ] SSL certificate active
- [ ] Custom domain configured (if applicable)
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security headers configured
- [ ] Error monitoring setup
- [ ] Backup and recovery plan in place

### Launch Day Tasks

- [ ] Final deployment to production
- [ ] Smoke tests on live site
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify all functionality
- [ ] Update DNS if needed
- [ ] Notify team of successful deployment

### Post-Launch Monitoring

- [ ] Set up uptime monitoring
- [ ] Configure error alerting
- [ ] Monitor function performance
- [ ] Track user analytics
- [ ] Review security logs
- [ ] Plan regular updates and maintenance

## Quick Reference

### Essential Netlify Commands

```bash
# Deploy to production
netlify deploy --prod

# View site in browser
netlify open

# Check build status
netlify status

# View function logs
netlify functions:log

# Test functions locally
netlify dev
```

### Emergency Rollback

```bash
# List previous deployments
netlify api listSiteDeploys --data='{"site_id":"YOUR_SITE_ID"}'

# Rollback to previous deployment
netlify api restoreSiteDeploy --data='{"site_id":"YOUR_SITE_ID","deploy_id":"PREVIOUS_DEPLOY_ID"}'
```