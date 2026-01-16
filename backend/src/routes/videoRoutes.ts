import { Router } from 'express';
import {
    getLanguages,
    getPlatforms,
    getSystemStatus,
    processVideo,
    getVideoStatus,
    analyzeVideo,
    getVideoResults,
    deleteVideo,
} from '../controllers/videoController';

const router = Router();

// System endpoints
router.get('/languages', getLanguages);
router.get('/platforms', getPlatforms);
router.get('/status', getSystemStatus);

// Video processing endpoints
router.post('/video/process', processVideo);
router.get('/video/:id/status', getVideoStatus);
router.post('/video/:id/analyze', analyzeVideo);
router.get('/video/:id/results', getVideoResults);
router.delete('/video/:id', deleteVideo);

export default router;
