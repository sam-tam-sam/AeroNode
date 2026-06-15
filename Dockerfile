FROM node:20-alpine

# Install SQLite dependencies if needed (better-sqlite3 may need python/make, but prebuilds usually work on Alpine if not strictly musl dependent)
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create directories for config and downloads
RUN mkdir -p /config /media_hdd

# Expose port
EXPOSE 5800

# Start command
CMD ["npm", "start"]
