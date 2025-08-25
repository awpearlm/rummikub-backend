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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js to run the tests.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install npm to run the tests.${NC}"
    exit 1
fi

# Function to check if a port is in use
is_port_in_use() {
    if command -v lsof &> /dev/null; then
        lsof -i:$1 &> /dev/null
        return $?
    elif command -v netstat &> /dev/null; then
        netstat -tuln | grep $1 &> /dev/null
        return $?
    else
        # Fall back to a simple check with nc if available
        if command -v nc &> /dev/null; then
            nc -z localhost $1 &> /dev/null
            return $?
        else
            echo -e "${YELLOW}Warning: Cannot check if port $1 is in use. Proceeding anyway.${NC}"
            return 1
        fi
    fi
}

# Check for running server
if is_port_in_use 3000; then
    echo -e "${YELLOW}Warning: It seems a server is already running on port 3000.${NC}"
    read -p "Do you want to continue with the existing server? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Please stop the existing server and try again.${NC}"
        exit 1
    fi
    SERVER_ALREADY_RUNNING=true
else
    SERVER_ALREADY_RUNNING=false
fi

# Check for existing dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Node modules not found. Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies. Please check your npm configuration.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Dependencies installed successfully.${NC}"
else
    echo -e "${GREEN}Dependencies already installed.${NC}"
fi

# Check if Cypress is installed
if [ ! -d "node_modules/cypress" ]; then
    echo -e "${YELLOW}Cypress not found. Installing Cypress...${NC}"
    npm install cypress --save-dev
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install Cypress. Please check your npm configuration.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Cypress installed successfully.${NC}"
else
    echo -e "${GREEN}Cypress already installed.${NC}"
fi

# Create reports directory if it doesn't exist
if [ ! -d "test-reports" ]; then
    mkdir -p test-reports
    echo -e "${GREEN}Created test-reports directory.${NC}"
fi

# Start the server if not already running
if [ "$SERVER_ALREADY_RUNNING" = false ]; then
    echo -e "${YELLOW}Starting J_kube server...${NC}"
    node server.js > test-reports/server.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start (up to 10 seconds)
    echo -e "${YELLOW}Waiting for server to start...${NC}"
    MAX_WAIT=10
    WAIT_COUNT=0
    while ! is_port_in_use 3000 && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        sleep 1
        ((WAIT_COUNT++))
        echo -ne "${YELLOW}Waiting for server to start... ${WAIT_COUNT}/${MAX_WAIT}${NC}\r"
    done
    
    if ! is_port_in_use 3000; then
        echo -e "${RED}Server failed to start within ${MAX_WAIT} seconds. Check server.log for details.${NC}"
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
    
    echo -e "${GREEN}Server started successfully on port 3000.${NC}"
else
    echo -e "${GREEN}Using existing server on port 3000.${NC}"
fi

# Function to run tests with proper output
run_tests() {
    TEST_TYPE=$1
    TEST_COMMAND=$2
    
    echo
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE}   Running $TEST_TYPE tests...${NC}"
    echo -e "${BLUE}===============================================${NC}"
    
    # Run the test
    eval "$TEST_COMMAND" | tee "test-reports/${TEST_TYPE}-output.log"
    TEST_EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ $TEST_TYPE tests passed successfully!${NC}"
        return 0
    else
        echo -e "${RED}✗ $TEST_TYPE tests failed. See logs for details.${NC}"
        return 1
    fi
}

# Main testing sequence
echo
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   Starting Test Execution                    ${NC}"
echo -e "${BLUE}===============================================${NC}"

# Record start time
START_TIME=$(date +%s)

# Run basic reconnection tests
run_tests "Basic-Reconnection" "npx cypress run --spec 'cypress/e2e/reconnection.cy.js'"
BASIC_RESULT=$?

# Run multiplayer reconnection tests
run_tests "Multiplayer-Reconnection" "npx cypress run --spec 'cypress/e2e/multiplayer-reconnection.cy.js'"
MULTIPLAYER_RESULT=$?

# Run edge case tests
run_tests "Edge-Cases" "npx cypress run --spec 'cypress/e2e/reconnection-edge-cases.cy.js'"
EDGE_RESULT=$?

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Generate test summary
echo
echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}   Test Summary                               ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "Test Duration: ${DURATION} seconds"
echo

# Show results table
echo -e "Test Type                  | Result"
echo -e "---------------------------|-------"
if [ $BASIC_RESULT -eq 0 ]; then
    echo -e "Basic Reconnection         | ${GREEN}PASSED${NC}"
else
    echo -e "Basic Reconnection         | ${RED}FAILED${NC}"
fi

if [ $MULTIPLAYER_RESULT -eq 0 ]; then
    echo -e "Multiplayer Reconnection   | ${GREEN}PASSED${NC}"
else
    echo -e "Multiplayer Reconnection   | ${RED}FAILED${NC}"
fi

if [ $EDGE_RESULT -eq 0 ]; then
    echo -e "Edge Cases                 | ${GREEN}PASSED${NC}"
else
    echo -e "Edge Cases                 | ${RED}FAILED${NC}"
fi

# Check if we started the server, and if so, stop it
if [ "$SERVER_ALREADY_RUNNING" = false ] && [ -n "$SERVER_PID" ]; then
    echo
    echo -e "${YELLOW}Stopping J_kube server...${NC}"
    kill $SERVER_PID
    wait $SERVER_PID 2>/dev/null
    echo -e "${GREEN}Server stopped.${NC}"
fi

# Generate HTML report
echo
echo -e "${YELLOW}Generating HTML test report...${NC}"

# Create an HTML report
cat > test-reports/test-report.html << EOL
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>J_kube Reconnection Test Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .summary-table th, .summary-table td {
            padding: 12px;
            border: 1px solid #ddd;
            text-align: left;
        }
        .summary-table th {
            background-color: #f8f9fa;
        }
        .pass {
            color: #28a745;
            font-weight: bold;
        }
        .fail {
            color: #dc3545;
            font-weight: bold;
        }
        .info-box {
            background-color: #f8f9fa;
            border-left: 4px solid #17a2b8;
            padding: 15px;
            margin: 20px 0;
        }
        .links-section {
            margin-top: 30px;
        }
        .links-section a {
            display: block;
            margin: 10px 0;
            color: #007bff;
            text-decoration: none;
        }
        .links-section a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>J_kube Reconnection Test Report</h1>
        <p>Generated on $(date)</p>
    </div>
    
    <div class="info-box">
        <h3>Test Information</h3>
        <p><strong>Duration:</strong> ${DURATION} seconds</p>
        <p><strong>Test Date:</strong> $(date)</p>
    </div>
    
    <h2>Test Results</h2>
    <table class="summary-table">
        <thead>
            <tr>
                <th>Test Suite</th>
                <th>Status</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Basic Reconnection</td>
                <td class="$([ $BASIC_RESULT -eq 0 ] && echo 'pass' || echo 'fail')">
                    $([ $BASIC_RESULT -eq 0 ] && echo 'PASSED' || echo 'FAILED')
                </td>
                <td>Tests for game state preservation and reconnection UI</td>
            </tr>
            <tr>
                <td>Multiplayer Reconnection</td>
                <td class="$([ $MULTIPLAYER_RESULT -eq 0 ] && echo 'pass' || echo 'fail')">
                    $([ $MULTIPLAYER_RESULT -eq 0 ] && echo 'PASSED' || echo 'FAILED')
                </td>
                <td>Tests for reconnection in multiplayer game scenarios</td>
            </tr>
            <tr>
                <td>Edge Cases</td>
                <td class="$([ $EDGE_RESULT -eq 0 ] && echo 'pass' || echo 'fail')">
                    $([ $EDGE_RESULT -eq 0 ] && echo 'PASSED' || echo 'FAILED')
                </td>
                <td>Tests for handling expired sessions and other edge cases</td>
            </tr>
        </tbody>
    </table>
    
    <h2>Test Details</h2>
    <p>The test suite verifies the J_kube game's reconnection functionality, ensuring that players can reconnect to their games after a disconnection without losing game state.</p>
    
    <div class="links-section">
        <h3>Test Logs</h3>
        <a href="Basic-Reconnection-output.log">Basic Reconnection Test Log</a>
        <a href="Multiplayer-Reconnection-output.log">Multiplayer Reconnection Test Log</a>
        <a href="Edge-Cases-output.log">Edge Cases Test Log</a>
        <a href="server.log">Server Log</a>
    </div>
    
    <h3>Video Recordings</h3>
    <p>Video recordings of the test runs can be found in the cypress/videos directory.</p>
    
    <div class="info-box">
        <h3>Next Steps</h3>
        <p>If any tests failed, review the logs and video recordings to identify the issues. Common issues include:</p>
        <ul>
            <li>Socket connection timeouts</li>
            <li>UI elements not appearing in time</li>
            <li>Game state not properly persisting</li>
        </ul>
    </div>
</body>
</html>
EOL

echo -e "${GREEN}HTML report generated at test-reports/test-report.html${NC}"

# Final message
echo
if [ $BASIC_RESULT -eq 0 ] && [ $MULTIPLAYER_RESULT -eq 0 ] && [ $EDGE_RESULT -eq 0 ]; then
    echo -e "${GREEN}All tests completed successfully!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the test report for details.${NC}"
    exit 1
fi
