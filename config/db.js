const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Enhanced error handling with specific guidance
const handleConnectionError = (error) => {
  console.error('❌ MongoDB Connection Failed:', error.message);
  
  if (error.message.includes('authentication failed')) {
    console.error(`
    🔐 AUTHENTICATION ERROR
    
    Your MongoDB credentials are incorrect. Please check:
    1. Username and password in MONGODB_URI
    2. Database user permissions in MongoDB Atlas
    3. IP whitelist settings (add 0.0.0.0/0 for Netlify)
    
    Current MONGODB_URI format should be:
    mongodb+srv://username:password@cluster.mongodb.net/jkube
    `);
  } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
    console.error(`
    🌐 NETWORK ERROR
    
    Cannot reach MongoDB Atlas. Please check:
    1. Internet connectivity
    2. MongoDB Atlas cluster status
    3. Firewall settings
    4. DNS resolution
    5. Cluster URL is correct
    `);
  } else if (error.message.includes('timeout')) {
    console.error(`
    ⏰ CONNECTION TIMEOUT
    
    Connection to MongoDB timed out. Please check:
    1. Network stability
    2. MongoDB Atlas cluster availability
    3. Connection string parameters
    `);
  } else {
    console.error(`
    ❓ UNKNOWN CONNECTION ERROR
    
    Please check:
    1. MONGODB_URI environment variable is set
    2. Connection string format is correct
    3. MongoDB Atlas cluster is running
    
    Error details: ${error.message}
    `);
  }
  
  return { connected: false, error: error.message };
};

// Validate environment configuration
const validateConfiguration = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.error(`
    ⚠️  MISSING ENVIRONMENT VARIABLES
    
    The following required environment variables are missing:
    ${missing.map(v => `- ${v}`).join('\n    ')}
    
    Please create a .env file with:
    MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jkube
    JWT_SECRET=your_jwt_secret_key_here
    NODE_ENV=development
    PORT=3000
    `);
    return false;
  }
  
  // Validate MONGODB_URI format
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    console.error(`
    ❌ INVALID MONGODB_URI FORMAT
    
    MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'
    Current value: ${mongoUri.substring(0, 20)}...
    
    Correct format: mongodb+srv://username:password@cluster.mongodb.net/jkube
    `);
    return false;
  }
  
  return true;
};

// Get connection status
const getConnectionStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[state] || 'unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    port: mongoose.connection.port
  };
};

// Test database connectivity
const validateConnection = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    console.log('✅ Database connectivity test passed');
    return true;
  } catch (error) {
    console.error('❌ Database connectivity test failed:', error.message);
    return false;
  }
};

// Enhanced connect function with retry logic
const connectDB = async (retries = 3) => {
  // Validate configuration first
  if (!validateConfiguration()) {
    process.exit(1);
  }
  
  let attempt = 0;
  
  while (attempt < retries) {
    try {
      attempt++;
      console.log(`🔄 Attempting MongoDB connection (${attempt}/${retries})...`);
      
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // 10 second timeout
        socketTimeoutMS: 45000, // 45 second socket timeout
        maxPoolSize: 10, // Maintain up to 10 socket connections
      });
      
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      
      // Test the connection
      const isValid = await validateConnection();
      if (!isValid) {
        throw new Error('Connection validation failed');
      }
      
      // Log connection details
      const status = getConnectionStatus();
      console.log(`📊 Connection Status: ${status.state}`);
      console.log(`🏠 Database: ${status.name}`);
      
      // Set up connection event listeners
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error.message);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });
      
      return { connected: true, host: conn.connection.host };
      
    } catch (error) {
      const errorInfo = handleConnectionError(error);
      
      if (attempt < retries) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ Failed to connect after ${retries} attempts`);
        
        // In development, continue without database for debugging
        if (process.env.NODE_ENV === 'development') {
          console.warn(`
          ⚠️  DEVELOPMENT MODE: Continuing without database
          
          The application will start but database features will not work.
          Please fix the MongoDB connection to enable full functionality.
          `);
          return { connected: false, fallback: true };
        } else {
          process.exit(1);
        }
      }
    }
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  connectDB,
  validateConfiguration,
  getConnectionStatus,
  validateConnection,
  gracefulShutdown
};
