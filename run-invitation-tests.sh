#!/bin/bash

# Invitation System E2E Test Runner
# This script runs the invitation system tests in different configurations

echo "🧪 J_kube Invitation System E2E Tests"
echo "======================================"

# Function to run tests with specific environment
run_invitation_tests() {
    local env=$1
    local description=$2
    
    echo ""
    echo "🚀 Running invitation tests against $description..."
    echo "Environment: $env"
    
    if [ "$env" = "local" ]; then
        echo "Frontend: http://localhost:3000"
        echo "Backend: http://localhost:3000"
    else
        echo "Frontend: https://jkube.netlify.app"
        echo "Backend: https://rummikub-backend.onrender.com"
    fi
    
    # Set environment and run specific invitation tests
    CYPRESS_ENVIRONMENT=$env npx cypress run \
        --spec "cypress/e2e/invitation-*.cy.js" \
        --browser chrome \
        --reporter spec
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ Invitation tests passed for $description"
    else
        echo "❌ Invitation tests failed for $description"
        return $exit_code
    fi
}

# Function to run individual test suites
run_individual_suite() {
    local test_file=$1
    local description=$2
    local env=${3:-local}
    
    echo ""
    echo "🎯 Running $description..."
    
    CYPRESS_ENVIRONMENT=$env npx cypress run \
        --spec "cypress/e2e/$test_file" \
        --browser chrome \
        --reporter spec
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ $description passed"
    else
        echo "❌ $description failed"
        return $exit_code
    fi
}

# Check if Cypress is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm"
    exit 1
fi

if [ ! -d "node_modules/cypress" ]; then
    echo "❌ Cypress not found. Installing..."
    npm install cypress --save-dev
fi

# Parse command line arguments
case "$1" in
    "local")
        echo "Running tests against local development server..."
        echo "⚠️  Make sure your local server is running on http://localhost:3000"
        read -p "Press Enter to continue..."
        run_invitation_tests "local" "Local Development Server"
        ;;
    "production")
        echo "Running tests against production environment..."
        run_invitation_tests "production" "Production Environment"
        ;;
    "api")
        echo "Running API-only tests..."
        run_individual_suite "invitation-api.cy.js" "Invitation API Tests" "local"
        ;;
    "signup")
        echo "Running signup page tests..."
        run_individual_suite "signup-page.cy.js" "Signup Page Tests" "local"
        ;;
    "admin")
        echo "Running admin dashboard tests..."
        run_individual_suite "admin-invitation-management.cy.js" "Admin Dashboard Tests" "local"
        ;;
    "full")
        echo "Running complete invitation system test suite..."
        run_individual_suite "invitation-system.cy.js" "Complete Invitation System" "local"
        ;;
    "all")
        echo "Running ALL invitation tests..."
        run_invitation_tests "local" "Local Development Server"
        ;;
    "headless")
        echo "Running tests in headless mode..."
        CYPRESS_ENVIRONMENT=local npx cypress run \
            --spec "cypress/e2e/invitation-*.cy.js" \
            --headless \
            --reporter json \
            --reporter-options "output=cypress/results/invitation-test-results.json"
        ;;
    "interactive")
        echo "Opening Cypress Test Runner in interactive mode..."
        CYPRESS_ENVIRONMENT=local npx cypress open
        ;;
    "help"|"-h"|"--help"|"")
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  local       Run tests against local development server (http://localhost:3000)"
        echo "  production  Run tests against production environment"
        echo "  api         Run only API endpoint tests"
        echo "  signup      Run only signup page tests"
        echo "  admin       Run only admin dashboard tests"
        echo "  full        Run complete invitation system test"
        echo "  all         Run all invitation tests (same as local)"
        echo "  headless    Run tests in headless mode with JSON output"
        echo "  interactive Open Cypress Test Runner GUI"
        echo "  help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 local                    # Test against local server"
        echo "  $0 production               # Test against production"
        echo "  $0 api                      # Test only API endpoints"
        echo "  $0 interactive              # Open GUI test runner"
        echo ""
        echo "Test Files Created:"
        echo "  📄 invitation-system.cy.js          - Complete E2E invitation workflow"
        echo "  📄 invitation-api.cy.js             - API endpoint testing"
        echo "  📄 signup-page.cy.js                - Signup page functionality"
        echo "  📄 admin-invitation-management.cy.js - Admin dashboard features"
        echo ""
        echo "Prerequisites:"
        echo "  - Node.js and npm installed"
        echo "  - For local tests: J_kube server running on localhost:3000"
        echo "  - For production tests: Deployed app accessible"
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

echo ""
echo "📊 Test Summary"
echo "==============="
echo "Invitation system E2E tests completed!"
echo ""
echo "📁 Test Files Location: cypress/e2e/"
echo "📁 Test Results: cypress/results/ (if headless mode)"
echo "📁 Screenshots: cypress/screenshots/ (on failures)"
echo "📁 Videos: cypress/videos/ (if enabled)"
echo ""
echo "🔧 To run individual tests:"
echo "npx cypress run --spec 'cypress/e2e/invitation-system.cy.js'"
echo ""
echo "🎯 To open interactive test runner:"
echo "npx cypress open"
