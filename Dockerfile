FROM oven/bun:1.2.15

WORKDIR /app
# Install system dependencies required for sharp and other native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install

RUN bun run deploy

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV UPLOADS_DIR=/app/uploads
ENV DATABASE_URL=/app/data/prod.db

# Set entrypoint and command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "server/entry.node-server.js"]