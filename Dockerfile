FROM node:20-slim

# Install FFmpeg and Python (for yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN npm install -g yt-dlp-exec

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy backend source
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
