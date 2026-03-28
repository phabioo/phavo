# Stage 1: build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
# NODE_ENV=production is required so that SvelteKit's vite plugin builds the
# server bundle without SSR module evaluation (which would execute module-level
# DB code and potentially call process.exit() under QEMU arm64 emulation).
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
# Generate .svelte-kit/ (tsconfig.json + ambient types) before the build.
RUN cd apps/web && bunx svelte-kit sync
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
HEALTHCHECK --interval=30s --timeout=5s \
	--start-period=10s --retries=3 \
	CMD bun -e "fetch('http://localhost:' + (process.env.PHAVO_PORT || 3000) + '/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "run", "./build/index.js"]
