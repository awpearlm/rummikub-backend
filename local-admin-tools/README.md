# Local Admin Tools

**⚠️ IMPORTANT: This folder is excluded from git commits for security.**

These scripts are for local development and admin tasks only. They directly access the database and should never be committed to the public repository.

## Scripts

### Password Management
- `quick-password-reset.js` - Reset admin password quickly
- `test-password-verification.js` - Test if a password matches the stored hash

### User Management  
- `create-admin-local.js` - Create a new admin user
- `check-users.js` - List all users in the database

### Database Tools
- `debug-db-connection.js` - Check database connection and inspect data

## Usage

All scripts connect to the database specified in your `.env` file.

**Examples:**
```bash
# Reset admin password
node local-admin-tools/quick-password-reset.js

# Check what users exist
node local-admin-tools/check-users.js

# Create new admin user (if none exists)
node local-admin-tools/create-admin-local.js
```

## Security Notes

- These scripts use production database credentials
- They bypass normal authentication
- Never commit this folder to version control
- Only use on trusted local machines
- Delete scripts when no longer needed

## Environment Requirements

Requires `.env` file with:
```
MONGODB_URI=your_production_database_uri
```
