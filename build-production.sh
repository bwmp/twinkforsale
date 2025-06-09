#!/bin/bash
set -e

echo "🚀 Building Twink For Sale for production..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/ server/ .qwik/

# Install dependencies (in case they're missing)
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Build the application
echo "🔨 Building client..."
npm run build.client

echo "🔨 Building server..."
npm run build.server

echo "✅ Build complete!"
echo ""
echo "📋 To deploy:"
echo "1. Copy the following files/folders to your VPS:"
echo "   - server/"
echo "   - dist/"
echo "   - package.json"
echo "   - prisma/"
echo "   - .env (production environment variables)"
echo ""
echo "2. On your VPS, run:"
echo "   npm ci --production"
echo "   npx prisma generate"
echo "   npx prisma migrate deploy"
echo "   npm run deploy:start"
