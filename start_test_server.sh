#!/bin/bash
# Script to start a simple HTTP server for joker testing

echo "Starting HTTP server for Joker Test Client..."
echo "The test client will be available at: http://localhost:8000/cypress/e2e/joker-tests/joker_test_client.html"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "Using Python 3 SimpleHTTPServer..."
    python3 -m http.server
# Check if Python 2 is available
elif command -v python &> /dev/null; then
    echo "Using Python 2 SimpleHTTPServer..."
    python -m SimpleHTTPServer
# Use Node.js as fallback
else
    echo "Python not found, using Node.js HTTP server..."
    npx http-server -p 8000
fi

echo "Server stopped."
