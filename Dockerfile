FROM oven/bun:1.2.15

WORKDIR /app

# Install system dependencies required for sharp and other native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package.json bun.lock* ./

COPY . .

# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile


# Set environment variables needed for Prisma during build
ENV UPLOADS_DIR=/app/uploads
ENV DATABASE_URL=file:/app/data/prod.db

# Increase memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run deployment with more verbose output
RUN bun run deploy --verbose

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set entrypoint and command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "server/entry.node-server.js"]