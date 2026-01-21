# ============================================
# ARKIFLO FRONTEND - Production Dockerfile
# ============================================

# -------- Stage 1: Build React App --------
# We name this stage "builder" so the next stage can find it
FROM node:20-alpine AS builder

# Alpine uses 'apk' instead of 'apt-get'
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Build arguments
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV NODE_OPTIONS="--max-old-space-size=4096"

# If your Dockerfile is INSIDE the frontend folder:
COPY package.json package-lock.json* ./
RUN npm install

COPY . ./
RUN npm run build

# -------- Stage 2: Serve with Nginx --------
FROM nginx:alpine

RUN apk add --no-cache curl

# Ensure your nginx.conf exists in the same folder as this Dockerfile
COPY nginx.conf /etc/nginx/conf.d/default.conf

# We copy from "builder" (the name we gave Stage 1)
# React build output is usually in 'build' (CRA) or 'dist' (Vite)
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
