# Stage 1: build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: production
FROM oven/bun:1-alpine AS runner
# Create non-root user
RUN addgroup -S phavo && adduser -S phavo -G phavo
WORKDIR /app
# Copy only what's needed
COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/node_modules ./node_modules
# Copy Drizzle migration SQL files to a stable path so they are resolvable
# at runtime regardless of Vite bundle chunk names.
COPY --from=builder /app/packages/db/src/migrations /app/migrations
# Set permissions
RUN chown -R phavo:phavo /app
USER phavo
# Data volume for database and config
VOLUME ["/data"]
EXPOSE 3000 3443
# PHAVO_MIGRATIONS_DIR tells runMigrations() where to find the SQL files.
ENV PHAVO_MIGRATIONS_DIR=/app/migrations
CMD ["bun", "run", "./build/index.js"]
