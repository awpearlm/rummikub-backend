#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   J_kube Docker-based Automated Testing      ${NC}"
echo -e "${BLUE}===============================================${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker to run the tests.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed. Please install Docker Compose to run the tests.${NC}"
    exit 1
fi

# Create reports directory if it doesn't exist
if [ ! -d "test-reports" ]; then
    mkdir -p test-reports
    echo -e "${GREEN}Created test-reports directory.${NC}"
fi

# Record start time
START_TIME=$(date +%s)

echo -e "${YELLOW}Building Docker test environment...${NC}"
docker-compose -f docker-compose.test.yml build

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker build failed. Please check Docker configuration.${NC}"
    exit 1
fi

echo -e "${GREEN}Docker build successful.${NC}"
echo -e "${YELLOW}Running tests in Docker container...${NC}"

# Run tests in Docker
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

TEST_EXIT_CODE=$?

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   Test Summary                               ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "Test Duration: ${DURATION} seconds"
echo

# Copy videos and screenshots from container if they exist
echo -e "${YELLOW}Copying test artifacts from container...${NC}"
docker cp $(docker-compose -f docker-compose.test.yml ps -q j_kube_test):/app/cypress/videos ./test-reports/videos 2>/dev/null || true
docker cp $(docker-compose -f docker-compose.test.yml ps -q j_kube_test):/app/cypress/screenshots ./test-reports/screenshots 2>/dev/null || true

# Stop and remove containers
echo -e "${YELLOW}Cleaning up Docker containers...${NC}"
docker-compose -f docker-compose.test.yml down

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All tests completed successfully!${NC}"
    echo -e "${GREEN}Test artifacts saved to ./test-reports directory.${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the test artifacts in ./test-reports for details.${NC}"
    exit 1
fi
