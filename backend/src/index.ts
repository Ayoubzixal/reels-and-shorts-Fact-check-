import express from 'express';
import cors from 'cors';
import { config } from './config/config';
import videoRoutes from './routes/videoRoutes';
import { ensureTempDir } from './utils/helpers';

const app = express();

// Health check and root FIRST - before any other middleware for fastest response
app.get('/', (_req, res) => {
    res.status(200).send('OK');
});

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', videoRoutes);

// API info endpoint
app.get('/api-info', (_req, res) => {
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
    // Ensure temp directory exists AFTER server starts
    ensureTempDir();

    console.log(`Server running on port ${PORT}`);
});

export default app;
