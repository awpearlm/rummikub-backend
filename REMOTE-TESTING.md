# Testing Deployed Environments for J_kube

This guide explains how to run tests against both local development and deployed (production) environments of the J_kube game.

## Architecture Overview

J_kube uses a split architecture:
- **Backend**: Hosted on Render.com
- **Frontend**: Hosted on Netlify

## Test Configuration

The Cypress configuration supports testing against both environments:

```javascript
// cypress.config.js
module.exports = defineConfig({
  e2e: {
    env: {
      // For testing with locally running server
      local: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:3000',
      },
      // For testing against deployed environments
      production: {
        frontendUrl: 'https://j-kube.netlify.app', // Your Netlify URL
        backendUrl: 'https://rummikub-backend.onrender.com', // Your Render backend URL
      },
    },
  },
})
```

## Running Tests

### Test the Local Environment

To test against the local development environment:

```bash
# Run with the local environment (starts a local server)
./run-tests.sh --environment local --spec reconnection --local-server

# Run specific test suites
npm run test:local
npm run test:reconnection
```

### Test the Production Environment

To test against the deployed production environment:

```bash
# Run against the production environment
./run-tests.sh --environment production --spec reconnection

# Run all test suites against production
./run-tests.sh --environment production --spec all

# Using npm scripts
npm run test:prod
npm run test:reconnection:prod
```

## Command Line Options

The `run-tests.sh` script accepts the following options:

```
Usage: ./run-tests.sh [options]

Options:
  -e, --environment ENV   Specify environment to test against (local or production)
  -s, --spec SPEC         Specify test spec to run (reconnection, multiplayer, edge, or all)
  -l, --local-server      Start a local server for testing
  -h, --help              Show this help message
```

## Troubleshooting

### Common Issues

1. **Connection Timeouts**:
   - Increase the timeout values in cypress.config.js
   - Check if your Render backend is in a "sleep" state (free tier)

2. **Authentication Issues**:
   - Ensure your backend allows CORS from your testing environment

3. **Missing Elements**:
   - The frontend may have UI differences between environments
   - Update selectors in the test files if needed

### Viewing Test Results

Test reports are saved in the `test-reports` directory, including:

- Screenshots of test failures
- Video recordings of test runs
- Console logs

## CI/CD Integration

The tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
jobs:
  test-production:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:prod
```

## Advanced Usage

### Testing with Custom URLs

You can override the URLs with environment variables:

```bash
CYPRESS_BASE_URL=https://your-custom-url.com npm run test:prod
```

### Running Tests in Docker

For consistent testing environments, use the Docker-based tests:

```bash
./run-docker-tests.sh
```

This runs tests in a containerized environment for maximum consistency.
