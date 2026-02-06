FROM node:20-slim

# Install FFmpeg and Python (for yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install --break-system-packages yt-dlp

# Create app directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy backend source
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Create temp directory
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Hugging Face Spaces uses port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Start server
CMD ["node", "dist/index.js"]
