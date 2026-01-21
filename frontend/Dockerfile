# ============================================
# ARKIFLO FRONTEND - Production Dockerfile
# Multi-stage build: Build React + Serve with Nginx
# ============================================

# -------- Stage 1: Build React App --------
# Use full Node image (not Alpine) to avoid native module issues with AJV
FROM node:18-bullseye-slim AS builder

# Install build essentials for any native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Accept build argument for backend URL
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Increase Node memory for large builds (critical for low-memory VPS)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./

# Install dependencies with yarn (matching packageManager in package.json)
# --network-timeout: Prevent timeout on slow VPS connections
#RUN yarn install --frozen-lockfile --network-timeout 600000

# Build production bundle
RUN npm ci
# Copy source code
COPY . .
RUN npm run build

# -------- Stage 2: Serve with Nginx --------
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
