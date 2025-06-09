# Ubuntu VPS Deployment with Bun

## Common Rollup/Build Issues on Ubuntu with Bun

### 1. "Attempted to assign to readonly property" Error with Bun

This usually happens due to:
- Bun's different bundling behavior compared to Node.js
- Stricter ES module handling in Bun
- Different dependency resolution

**Solution for Bun:**
```bash
# On your Ubuntu VPS with Bun:
# 1. Clear all caches
rm -rf node_modules bun.lockb .qwik dist server
bun install --force

# 2. Build step by step with Bun
bun run build.client
bun run build.server

# 3. If still failing, try with Node.js compatibility
BUN_RUNTIME=node bun run build.server
```

### 2. Bun vs Node.js Runtime Issues

**Solution:**
```bash
# Option 1: Run with Bun runtime
bun server/entry.node-server.js

# Option 2: Run with Node.js runtime (if you have it)
node server/entry.node-server.js

# Option 3: Force Bun to use Node.js compatibility
BUN_RUNTIME=node bun server/entry.node-server.js
```

### 3. ESM Import Issues with Bun

Bun is stricter about ES modules. Make sure:
- All imports use `.js` extensions for local files
- package.json has `"type": "module"`
- No CommonJS syntax mixed with ESM

### 4. Prisma with Bun

**Solution:**
```bash
# Bun handles Prisma differently
bun add @prisma/client prisma
bun prisma generate
bun prisma migrate deploy
```

## Quick Deploy Script for Ubuntu VPS with Bun

```bash
#!/bin/bash
# deploy-bun-vps.sh

set -e

echo "🚀 Setting up Twink For Sale on Ubuntu with Bun..."

# Install Bun if not present
if ! command -v bun &> /dev/null; then
    echo "📦 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
fi

# Install dependencies
echo "📦 Installing dependencies with Bun..."
bun install

# Generate Prisma client
echo "🗄️ Setting up database..."
bun prisma generate
bun prisma migrate deploy

# Build the project
echo "🔨 Building project..."
bun run build && bun run build.server

# Create systemd service for Bun
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/twinkforsale.service > /dev/null <<EOF
[Unit]
Description=Twink For Sale Bun App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which bun) server/entry.node-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3004

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable twinkforsale
sudo systemctl start twinkforsale

echo "✅ Deployment complete!"
echo "🌐 Your app should be running on port 3004"
echo "📊 Check status: sudo systemctl status twinkforsale"
echo "📝 View logs: sudo journalctl -u twinkforsale -f"
```

## File Transfer from Windows to Ubuntu

### Option 1: Using SCP
```bash
# On Windows (in Git Bash or WSL)
scp -r dist/ server/ package.json prisma/ user@your-vps-ip:~/twinkforsale/
```

### Option 2: Using rsync
```bash
# On Windows (in WSL)
rsync -avz --progress dist/ server/ package.json prisma/ user@your-vps-ip:~/twinkforsale/
```

### Option 3: GitHub Deploy
```bash
# Push to GitHub then pull on VPS
git add .
git commit -m "Production build"
git push

# On VPS:
git pull
npm run build:prod
```

## Environment Variables

Create `.env.production` on your VPS:
```env
NODE_ENV=production
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="your-secret-here"
AUTH_TRUST_HOST=true
BASE_URL="https://your-domain.com"
UPLOAD_DIR="./uploads"
```
