// Ultra minimal debug server to check deployment environment
console.log('=== ENVIRONMENT DEBUG ===');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Current working directory:', process.cwd());
console.log('Process arguments:', process.argv);

try {
    const express = require('express');
    console.log('Express loaded successfully');
    
    const app = express();
    const port = process.env.PORT || 3000;
    
    app.get('/', (req, res) => {
        console.log('Root endpoint hit');
        res.json({ 
            status: 'alive',
            timestamp: new Date().toISOString(),
            node: process.version,
            port: port
        });
    });
    
    app.get('/health', (req, res) => {
        console.log('Health endpoint hit');
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    console.log(`Starting server on port ${port}...`);
    app.listen(port, '0.0.0.0', () => {
        console.log(`Debug server running on port ${port}`);
        console.log('Server startup complete');
    });
    
} catch (error) {
    console.error('Fatal error during startup:', error);
    process.exit(1);
}

// Keep process alive and log periodically
setInterval(() => {
    console.log('Server still alive at', new Date().toISOString());
}, 30000);

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
