---
title: Video Fact Checker API
emoji: 🔍
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# Video Fact-Checker Backend API

Backend service for fact-checking social media videos using AI.

## Endpoints

- `GET /` - Health check
- `GET /api/languages` - Get supported languages  
- `GET /api/platforms` - Get supported platforms
- `POST /api/video/process` - Process video URL
- `GET /api/video/:id/status` - Get processing status
- `POST /api/video/:id/analyze` - Analyze transcription
- `GET /api/video/:id/results` - Get fact-check results
