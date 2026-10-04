# ====================================================
# KAYDO BOT - PRODUCTION DOCKERFILE (24/7 RUNTIME)
# ====================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Add build tools for native dependencies (node-gyp)
RUN apk add --no-cache python3 make g++

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build Vite frontend and bundled CommonJS server (dist/server.cjs)
RUN npm run build

# Lean production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install wget for container health checks
RUN apk add --no-cache wget

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/metadata.json ./

# Persistent storage directories for sessions
RUN mkdir -p /app/sessions /app/sessions_backup

EXPOSE 3000

# Automated container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]
