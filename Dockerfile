# Build stage
FROM node:23-alpine AS base

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install system dependencies required for sharp and other native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    vips-dev

# Copy package files
COPY package.json ./
# Copy pnpm-lock.yaml if it exists
COPY pnpm-lock.yaml* ./
COPY .pnpmrc ./
COPY prisma ./prisma/

# Install dependencies with pnpm
RUN pnpm install

# Copy source code
COPY . .

# Generate Prisma client explicitly
RUN pnpm exec prisma generate

# Build the application
RUN pnpm run build && pnpm run build.server

# Production stage
FROM node:23-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Install system dependencies for runtime including build tools for native modules
RUN apk add --no-cache \
    vips \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

# Create uploads and data directories with proper permissions
RUN mkdir -p /app/uploads && chmod 755 /app/uploads
RUN mkdir -p /app/data && chmod 755 /app/data

# Copy package files and install all dependencies
COPY package.json ./
# Copy pnpm-lock.yaml if it exists
COPY pnpm-lock.yaml* ./
COPY .pnpmrc ./
COPY prisma ./prisma/

# Install all dependencies with pnpm
RUN pnpm install

# Generate Prisma client explicitly in production stage
RUN pnpm exec prisma generate

# Copy built application from build stage
COPY --from=base /app/server ./server
COPY --from=base /app/dist ./dist
COPY --from=base /app/public ./public

# Copy other necessary files including custom Prisma client location
COPY --from=base /app/prisma ./prisma

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3004
ENV UPLOAD_DIR=/app/uploads
ENV DATABASE_URL=file:/app/data/prod.db

# Expose the port the app runs on
EXPOSE 3004

# Set entrypoint and command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/entry.node-server.js"]
