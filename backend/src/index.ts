import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import videoRoutes from './routes/videoRoutes';
import { ensureTempDir } from './utils/helpers';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure temp directory exists
ensureTempDir();

// Routes
app.use('/api', videoRoutes);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        name: 'Video Fact-Checker API',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            languages: 'GET /api/languages',
            platforms: 'GET /api/platforms',
            systemStatus: 'GET /api/status',
            processVideo: 'POST /api/video/process',
            videoStatus: 'GET /api/video/:id/status',
            analyzeVideo: 'POST /api/video/:id/analyze',
            videoResults: 'GET /api/video/:id/results',
            deleteVideo: 'DELETE /api/video/:id',
        },
    });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║         VIDEO FACT-CHECKER API SERVER                     ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                 ║
║  API endpoints:     http://localhost:${PORT}/api             ║
╠═══════════════════════════════════════════════════════════╣
║  Prerequisites:                                           ║
║  - yt-dlp: pip install yt-dlp                            ║
║  - FFmpeg: https://ffmpeg.org/download.html              ║
║  - Gemini API Key in .env file                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
