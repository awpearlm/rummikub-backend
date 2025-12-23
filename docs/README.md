# J_kube Rummikub Documentation

## Overview

This documentation provides comprehensive guides for setting up, configuring, testing, and deploying the J_kube Rummikub multiplayer game application. The application is built with Node.js, Socket.IO, and MongoDB, designed to run on Netlify with serverless functions.

## Quick Start

### For Developers
1. [MongoDB Atlas Setup](./MONGODB_SETUP.md) - Set up your database
2. [Environment Configuration](./ENVIRONMENT_SETUP.md) - Configure local development
3. [Netlify Deployment](./NETLIFY_DEPLOYMENT.md) - Deploy to production

### For Testers
1. [Mobile Testing Guidelines](./MOBILE_TESTING.md) - Test mobile compatibility

## Documentation Index

### Setup and Configuration

#### [MongoDB Atlas Setup Guide](./MONGODB_SETUP.md)
Complete guide for setting up MongoDB Atlas database hosting:
- Account creation and cluster setup
- Database user and network configuration
- Connection string generation
- Troubleshooting common connection issues
- Security best practices

#### [Environment Variable Configuration](./ENVIRONMENT_SETUP.md)
Comprehensive environment setup for all deployment scenarios:
- Required and optional environment variables
- Local development configuration
- Production environment setup
- Environment validation and troubleshooting
- Security considerations

### Testing and Quality Assurance

#### [Mobile Testing Guidelines](./MOBILE_TESTING.md)
Complete mobile testing strategy and procedures:
- Device and browser testing matrix
- Touch interaction testing
- Responsive design validation
- Performance testing on mobile
- Cross-device compatibility
- Automated mobile testing setup

### Deployment and Operations

#### [Netlify Deployment Checklist](./NETLIFY_DEPLOYMENT.md)
Step-by-step deployment guide for Netlify:
- Pre-deployment preparation
- Site configuration and setup
- Serverless function deployment
- Environment variable configuration
- Performance optimization
- Security configuration
- Troubleshooting and monitoring

## Architecture Overview

```mermaid
graph TB
    Client[Web Browser Client] --> Netlify[Netlify CDN]
    Netlify --> Functions[Netlify Functions]
    Functions --> MongoDB[(MongoDB Atlas)]
    Functions --> SocketIO[Socket.IO Real-time]
    SocketIO --> Client
    
    subgraph "Netlify Functions"
        Functions --> Auth[Authentication]
        Functions --> Game[Game Logic]
        Functions --> DB[Database Operations]
    end
    
    subgraph "MongoDB Collections"
        MongoDB --> Users[Users]
        MongoDB --> Games[Games]
        MongoDB --> Stats[Statistics]
    end
```

## Technology Stack

### Frontend
- **HTML5/CSS3**: Responsive web interface
- **JavaScript (ES6+)**: Client-side game logic
- **Socket.IO Client**: Real-time communication
- **CSS Grid/Flexbox**: Mobile-responsive layouts

### Backend
- **Node.js**: Server runtime
- **Express.js**: Web framework
- **Socket.IO**: WebSocket communication
- **MongoDB**: Database storage
- **Mongoose**: MongoDB object modeling

### Deployment
- **Netlify**: Static site hosting and serverless functions
- **MongoDB Atlas**: Cloud database hosting
- **GitHub**: Version control and CI/CD

## Key Features

### Core Gameplay
- **Multiplayer Support**: Real-time multiplayer Rummikub gameplay
- **Drag & Drop Interface**: Intuitive tile manipulation
- **Game State Persistence**: Automatic save and restore
- **Bot Players**: AI opponents for single-player practice

### Technical Features
- **Mobile Responsive**: Touch-friendly interface for all devices
- **Connection Recovery**: Automatic reconnection and state restoration
- **Real-time Sync**: Instant game state synchronization
- **Serverless Architecture**: Scalable deployment on Netlify

## Development Workflow

### Local Development
```bash
# 1. Clone repository
git clone https://github.com/your-username/jkube-rummikub.git
cd jkube-rummikub

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your MongoDB Atlas connection string

# 4. Start development server
npm run dev
```

### Testing
```bash
# Run unit tests
npm test

# Run mobile tests
npm run test:mobile

# Run end-to-end tests
npm run test:e2e

# Run all tests
npm run test:all
```

### Deployment
```bash
# Deploy to staging
netlify deploy

# Deploy to production
netlify deploy --prod
```

## Configuration Reference

### Required Environment Variables
```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jkube
JWT_SECRET=your-secret-key-minimum-32-characters
NODE_ENV=production
```

### Optional Configuration
```bash
LOG_LEVEL=info
SESSION_TIMEOUT=60
GAME_CLEANUP_INTERVAL=30
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
- Verify MongoDB Atlas connection string
- Check network access configuration
- Ensure database user has proper permissions

#### Functions Not Deploying
- Check build command in netlify.toml
- Verify all dependencies are in package.json
- Review function timeout and memory limits

#### Mobile Touch Issues
- Test on actual devices, not just browser simulation
- Verify touch event handlers are properly registered
- Check viewport meta tag configuration

### Getting Help

1. **Check Documentation**: Review relevant guide above
2. **Search Issues**: Look for similar problems in GitHub issues
3. **Create Issue**: Report bugs with detailed reproduction steps
4. **Contact Support**: Reach out to the development team

## Contributing

### Development Setup
1. Follow local development setup above
2. Create feature branch from `develop`
3. Make changes and add tests
4. Run full test suite
5. Submit pull request

### Documentation Updates
- Update relevant documentation files
- Test all procedures on clean environment
- Include screenshots for UI changes
- Update this README if adding new guides

## Maintenance and Updates

### Regular Tasks
- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Performance optimization and capacity planning

### Monitoring
- **Uptime**: Netlify provides built-in monitoring
- **Performance**: Use Lighthouse audits
- **Errors**: Monitor function logs and user reports
- **Security**: Regular dependency vulnerability scans

## License and Support

This project is part of the J_kube Rummikub application. For support, please refer to the project repository or contact the development team.

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintained By**: J_kube Development Team