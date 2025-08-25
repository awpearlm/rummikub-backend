#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   J_kube Automated Reconnection Testing      ${NC}"
echo -e "${BLUE}===============================================${NC}"

# Function to show usage
show_usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -e, --environment ENV   Specify environment to test against (local or production)"
  echo "  -s, --spec SPEC         Specify test spec to run (reconnection, multiplayer, edge, or all)"
  echo "  -l, --local-server      Start a local server for testing"
  echo "  -h, --help              Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 --environment local --spec reconnection --local-server"
  echo "  $0 --environment production --spec all"
  echo ""
}

# Default values
ENVIRONMENT="local"
SPEC="reconnection"
START_LOCAL_SERVER=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -s|--spec)
      SPEC="$2"
      shift 2
      ;;
    -l|--local-server)
      START_LOCAL_SERVER=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_usage
      exit 1
      ;;
  esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "local" && "$ENVIRONMENT" != "production" ]]; then
  echo -e "${RED}Invalid environment: $ENVIRONMENT. Must be 'local' or 'production'.${NC}"
  exit 1
fi

# Validate spec
if [[ "$SPEC" != "reconnection" && "$SPEC" != "multiplayer" && "$SPEC" != "edge" && "$SPEC" != "all" ]]; then
  echo -e "${RED}Invalid spec: $SPEC. Must be 'reconnection', 'multiplayer', 'edge', or 'all'.${NC}"
  exit 1
fi

echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Test spec: ${SPEC}${NC}"
echo -e "${YELLOW}Start local server: ${START_LOCAL_SERVER}${NC}"
echo ""

# Create reports directory if it doesn't exist
if [ ! -d "test-reports" ]; then
  mkdir -p test-reports
  echo -e "${GREEN}Created test-reports directory.${NC}"
fi

# Function to run tests
run_tests() {
  local test_spec=$1
  local env_var="CYPRESS_ENVIRONMENT=$ENVIRONMENT"
  
  echo -e "${BLUE}Running tests: ${test_spec} in ${ENVIRONMENT} environment${NC}"
  
  if [ "$test_spec" == "all" ]; then
    # Run all tests
    if [ "$START_LOCAL_SERVER" = true ]; then
      npx npm-run-all --parallel start --race "cypress:run --env $env_var"
    else
      npx cypress run --env "$env_var"
    fi
  else
    # Run specific test spec
    if [ "$START_LOCAL_SERVER" = true ]; then
      npx npm-run-all --parallel start --race "cypress:run --spec 'cypress/e2e/${test_spec}*.cy.js' --env $env_var"
    else
      npx cypress run --spec "cypress/e2e/${test_spec}*.cy.js" --env "$env_var"
    fi
  fi
  
  return $?
}

# Record start time
START_TIME=$(date +%s)

# Run the tests
if [ "$SPEC" == "all" ]; then
  echo -e "${BLUE}Running all test specs...${NC}"
  run_tests "all"
  TEST_EXIT_CODE=$?
else
  echo -e "${BLUE}Running ${SPEC} tests...${NC}"
  run_tests "$SPEC"
  TEST_EXIT_CODE=$?
fi

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Generate test summary
echo
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   Test Summary                               ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "Test Duration: ${DURATION} seconds"
echo -e "Environment: ${ENVIRONMENT}"
echo -e "Spec: ${SPEC}"
echo

# Final message
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All tests completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Please check the test artifacts for details.${NC}"
  exit 1
fi
