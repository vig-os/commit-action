#!/bin/bash

# Post-create script - runs when container is created for the first time
# This script is called from postCreateCommand in devcontainer.json

set -euo pipefail

echo "Running post-create setup..."

# User specific setup
# Add your custom setup commands here to install any dependencies or tools needed for your project

# 1. apt update
APT_CLEAN=false
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "Updating package lists..."
    apt-get update -qq
    APT_CLEAN=true
fi

# 2. Install Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
NODE_VERSION=$(node --version)
echo -e "Node.js installed (${NODE_VERSION})"

# 3. Install npm
if ! command -v npm &> /dev/null; then
    echo "Installing npm..."
    apt-get install -y npm
fi
NPM_VERSION=$(npm --version)
echo -e "npm installed (${NPM_VERSION})"

# 4. Clean apt
if [ "$APT_CLEAN" = true ]; then
    apt-get clean
fi

# Check if tsx is installed
if ! command -v tsx &> /dev/null; then
    echo -e "Installing tsx (required by local-action)..."
    npm install -g tsx >/dev/null 2>&1
fi
TSX_VERSION=$(tsx --version 2>/dev/null | head -n1 | tr -d '\n' || echo "")
echo -e "tsx installed (${TSX_VERSION})"

echo "Post-create setup complete"
