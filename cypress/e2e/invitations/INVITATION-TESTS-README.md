# Invitation System E2E Tests

This directory contains comprehensive end-to-end tests for the J_kube invitation system, covering the complete workflow from invitation creation to user registration.

## 📋 Test Coverage

### 🎯 Core Test Suites

#### 1. **invitation-system.cy.js** - Complete E2E Workflow
- **Admin Invitation Creation**: Creating invitations through admin dashboard
- **Invitation Validation**: Testing token validation endpoints
- **Signup Page Flow**: Complete user registration workflow
- **Admin Management**: Invitation tracking and cancellation
- **Integration Testing**: User stats creation and invitation status updates

#### 2. **invitation-api.cy.js** - API Endpoint Testing
- **POST /api/admin/invitations**: Invitation creation with validation
- **GET /api/admin/invitations**: Invitation listing and filtering
- **GET /api/auth/invitation/:token**: Token validation
- **POST /api/auth/register-invitation**: User registration with tokens
- **DELETE /api/admin/invitations/:id**: Invitation cancellation
- **Error handling**: Network errors, malformed data, edge cases

#### 3. **signup-page.cy.js** - Frontend Signup Testing
- **Page Loading**: Initial states and token validation
- **Form Validation**: Username, password, and confirmation checks
- **User Experience**: Loading states, error messages, success flows
- **Responsive Design**: Mobile and tablet compatibility
- **Accessibility**: Keyboard navigation and ARIA compliance

#### 4. **admin-invitation-management.cy.js** - Admin Dashboard
- **Interface Testing**: Table display and responsive design
- **Invitation Creation**: Form validation and link generation
- **Management Features**: Copy links, cancel invitations
- **Statistics Integration**: Dashboard updates and activity tracking
- **Error Handling**: Network failures and edge cases

## 🚀 Running Tests

### Quick Start
```bash
# Run all invitation tests against local server
./run-invitation-tests.sh local

# Run against production
./run-invitation-tests.sh production

# Open interactive test runner
./run-invitation-tests.sh interactive
```

### Individual Test Suites
```bash
# API tests only
./run-invitation-tests.sh api

# Signup page tests only
./run-invitation-tests.sh signup

# Admin dashboard tests only
./run-invitation-tests.sh admin

# Complete workflow test
./run-invitation-tests.sh full
```

### Manual Cypress Commands
```bash
# Run specific test file
npx cypress run --spec "cypress/e2e/invitation-system.cy.js"

# Run with specific browser
CYPRESS_ENVIRONMENT=local npx cypress run --browser chrome

# Open Cypress GUI
CYPRESS_ENVIRONMENT=local npx cypress open
```

## 🔧 Configuration

### Environment Variables
- **CYPRESS_ENVIRONMENT**: `local` or `production`
- **CYPRESS_BASE_URL**: Override base URL

### Cypress Config
```javascript
// cypress.config.js
env: {
  local: {
    frontendUrl: 'http://localhost:3000',
    backendUrl: 'http://localhost:3000'
  },
  production: {
    frontendUrl: 'https://jkube.netlify.app',
    backendUrl: 'https://rummikub-backend.onrender.com'
  }
}
```

## 🛠️ Custom Commands

The invitation tests use custom Cypress commands for reusable functionality:

### Admin Commands
```javascript
cy.createAdminUser(username, email, password)  // Create admin user
cy.loginAsAdmin(authToken, username)           // Setup admin session
cy.goToInvitationsTab()                        // Navigate to invitations
```

### Invitation Commands
```javascript
cy.createInvitation(authToken, email, message) // Create via API
cy.sendInvitationViaUI(email, message)         // Create via UI
cy.validateInvitationToken(token)              // Validate token
cy.cancelInvitationViaUI(email)                // Cancel invitation
```

### Signup Commands
```javascript
cy.registerWithInvitation(username, password, token)  // Register via API
cy.completeSignup(token, username, password)          // Complete signup flow
cy.extractTokenFromLink(invitationLink)               // Extract token from URL
```

### Verification Commands
```javascript
cy.checkInvitationStatus(email, status)        // Check status in table
cy.verifyInvitationTableRow(email, invitedBy)  // Verify table data
cy.waitForInvitationInTable(email)             // Wait for invitation
```

## 📊 Test Scenarios

### ✅ Happy Path Tests
1. **Admin creates invitation** → **User receives link** → **User signs up** → **User is logged in**
2. **Multiple invitations** → **All appear in admin table** → **Can be managed individually**
3. **Invitation validation** → **Shows correct invitation details** → **Form pre-populated**

### ❌ Error Handling Tests
1. **Invalid tokens** → **Proper error messages** → **Graceful degradation**
2. **Expired invitations** → **Rejection with explanation** → **Link to login**
3. **Network errors** → **Retry mechanisms** → **User-friendly messages**
4. **Duplicate usernames** → **Clear validation errors** → **Form remains usable**

### 🔒 Security Tests
1. **Token reuse prevention** → **One-time use enforcement**
2. **Admin privilege validation** → **Unauthorized access blocked**
3. **Input sanitization** → **XSS prevention** → **SQL injection protection**

### 📱 Responsive Tests
1. **Mobile signup flow** → **Touch-friendly interface** → **Proper scaling**
2. **Tablet admin dashboard** → **Table responsiveness** → **Button accessibility**
3. **Desktop optimization** → **Full feature access** → **Keyboard navigation**

## 🐛 Debugging Tests

### Common Issues
```bash
# Server not running
Error: connect ECONNREFUSED 127.0.0.1:3000
Solution: Start your local server with npm start

# Wrong environment
Error: 404 Not Found
Solution: Check CYPRESS_ENVIRONMENT variable

# Database state
Error: User already exists
Solution: Clear test data or use unique identifiers
```

### Debug Mode
```bash
# Run with debug output
DEBUG=cypress:* npx cypress run

# Run single test with browser open
npx cypress run --spec "cypress/e2e/invitation-system.cy.js" --headed --no-exit
```

### Test Data Cleanup
```javascript
// Add to beforeEach for clean state
beforeEach(() => {
  cy.clearLocalStorage()
  cy.clearCookies()
  // Clear test users from database if needed
})
```

## 📈 Test Reports

### JSON Output
```bash
# Generate JSON report
./run-invitation-tests.sh headless

# View results
cat cypress/results/invitation-test-results.json
```

### Screenshots and Videos
- **Screenshots**: `cypress/screenshots/` (on test failures)
- **Videos**: `cypress/videos/` (if enabled in config)
- **Test artifacts**: Automatically captured for debugging

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Invitation System E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Start server
        run: npm start &
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      - name: Run invitation tests
        run: ./run-invitation-tests.sh local
```

## 📚 Best Practices

### Test Structure
- **Arrange**: Set up test data and admin users
- **Act**: Perform the invitation workflow actions
- **Assert**: Verify expected outcomes and state changes

### Data Management
- Use unique identifiers (timestamps) for test data
- Clean up test users and invitations after tests
- Mock external dependencies where appropriate

### Assertions
- Test both positive and negative scenarios
- Verify UI state changes and backend data updates
- Check for proper error handling and user feedback

### Maintainability
- Use custom commands for repeated actions
- Keep tests focused and independent
- Document complex test logic and edge cases

## 🎯 Coverage Goals

- ✅ **Functional Coverage**: All invitation features tested
- ✅ **UI Coverage**: All interface elements and interactions
- ✅ **API Coverage**: All endpoints with various inputs
- ✅ **Error Coverage**: All error scenarios and edge cases
- ✅ **Security Coverage**: Authentication and authorization
- ✅ **Performance Coverage**: Loading times and responsiveness

## 📞 Support

For issues with invitation system tests:

1. **Check test logs**: Look for specific error messages
2. **Verify environment**: Ensure correct URLs and credentials
3. **Review screenshots**: Check captured failure images
4. **Run individual tests**: Isolate specific failing scenarios
5. **Update test data**: Clear stale data that might cause conflicts

---

*These tests ensure the invitation system works reliably across all user journeys and edge cases, providing confidence in the feature's robustness and user experience.*
