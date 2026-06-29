#!/bin/bash

# Post-create script - runs when container is created for the first time
# This script is called from postCreateCommand in devcontainer.json

set -euo pipefail

echo "Running post-create setup..."

# User specific setup
# Add your custom setup commands here to install any dependencies or tools needed for your project

# 1. apt update
# NOTE: The apt / NodeSource path below assumes a Debian/apt base image. It is
# guarded by `command -v node`/`npm`, so it is skipped on the hermetic Nix image
# (Node is baked in). Full removal of the apt path is tracked separately under
# the devcontainer bump (vig-os/commit-action#29) and node-24 work (#14/#28).
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

# Ensure tsx is available (required by @github/local-action).
# tsx is also pinned as a local devDependency, so `npx tsx` works once
# dependencies are installed; the global install is a convenience for invoking
# `tsx` directly on PATH.
if ! command -v tsx &> /dev/null; then
    echo "Installing tsx (required by local-action)..."
    # Do not swallow output/exit status: a failed install must surface here.
    if ! npm install -g tsx; then
        echo "ERROR: 'npm install -g tsx' failed." >&2
        exit 1
    fi
fi

# Verify tsx is actually reachable. On some images a global npm prefix lands
# off-PATH (see vig-os/devcontainer#728), so fall back to the local
# devDependency via npx before failing loudly.
if command -v tsx &> /dev/null; then
    TSX_VERSION=$(tsx --version | head -n1 | tr -d '\n')
elif npx --no-install tsx --version &> /dev/null; then
    TSX_VERSION="$(npx --no-install tsx --version | head -n1 | tr -d '\n') (via npx)"
else
    echo "ERROR: tsx is not available on PATH and 'npx tsx' cannot find it." >&2
    echo "Install dependencies with 'npm ci' (local devDependency) or run 'npm install -g tsx'." >&2
    exit 1
fi
echo "tsx installed (${TSX_VERSION})"

echo "Post-create setup complete"
