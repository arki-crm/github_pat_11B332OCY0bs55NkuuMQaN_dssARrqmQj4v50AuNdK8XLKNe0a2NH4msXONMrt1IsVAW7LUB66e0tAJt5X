# ============================================
# ARKIFLO FRONTEND - Production Dockerfile
# ============================================

# -------- Stage 1: Build React App --------
FROM node:18-bullseye-slim AS builder

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# IMPORTANT: work inside frontend directory
WORKDIR /app
# Build argument
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Increase memory (important for VPS)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy ONLY frontend package.json
COPY frontend/package.json ./frontend/  # Fix path if needed
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build
# Install deps (safe for missing lock file)
#RUN npm install --legacy-peer-deps

# Copy frontend source only
#COPY . .
# Build React app
#RUN npm run build


# -------- Stage 2: Serve with Nginx --------
FROM nginx:alpine

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf

# React build output
COPY --from=builder /app/frontend/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
