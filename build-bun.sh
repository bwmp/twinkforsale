#!/bin/bash
# Bun-specific build script for Ubuntu VPS
set -e

echo "🚀 Building Twink For Sale with Bun..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/ server/ .qwik/

# Install dependencies with Bun
echo "📦 Installing dependencies with Bun..."
bun install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
bun prisma generate

# Build the application with Bun
echo "🔨 Building client..."
bun run build.client

echo "🔨 Building server..."
bun run build.server

echo "✅ Build complete!"
echo ""
echo "🏃 To start the server:"
echo "   bun server/entry.node-server.js"
echo ""
echo "🔧 Or use the deploy script:"
echo "   bun run deploy:bun"
