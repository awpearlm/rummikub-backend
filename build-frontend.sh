#!/bin/bash

# Build script for Netlify deployment
# This copies the frontend files to the netlify-build directory

echo "🔄 Preparing frontend files for Netlify deployment..."

# Create netlify-build directory if it doesn't exist
mkdir -p netlify-build

# Copy all public files to netlify-build
echo "📁 Copying frontend files..."
cp -r public/* netlify-build/

echo "✅ Frontend build complete!"
echo "📂 Files ready in netlify-build/ directory"
echo "🚀 Ready for Netlify deployment!"
