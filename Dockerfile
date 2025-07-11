# Use the official Bun image as the base
FROM oven/bun:1.1-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies required for sharp and other native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    vips-dev

# Copy package files
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build the application
RUN bun run build && bun run build.server

# Production stage
FROM oven/bun:1.1-alpine AS production

# Install system dependencies for runtime including build tools for native modules
RUN apk add --no-cache \
    vips \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Copy package files and install production dependencies only
COPY package.json ./
COPY prisma ./prisma/

# Install production dependencies
RUN bun install --production --frozen-lockfile

# Generate Prisma client
RUN bunx prisma generate

# Copy built application from build stage
COPY --from=base /app/server ./server
COPY --from=base /app/dist ./dist
COPY --from=base /app/public ./public

# Copy other necessary files
COPY --from=base /app/prisma ./prisma

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "server/entry.node-server.js"]
