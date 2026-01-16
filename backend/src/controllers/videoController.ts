import { Request, Response } from 'express';
import { config } from '../config/config';
import {
    VideoData,
    ProcessVideoRequest,
    AnalyzeRequest,
    VideoStatus
} from '../types';
import {
    generateId,
    extractPlatform,
    isValidPlatformUrl,
    cleanupTempFiles
} from '../utils/helpers';
import { downloadVideo, checkYtDlpInstalled } from '../services/downloadService';
import { transcribeAudio, checkGeminiConfigured } from '../services/transcriptionService';
import { factCheckTranscription } from '../services/factCheckService';

// In-memory storage for video processing jobs
const videoJobs: Map<string, VideoData> = new Map();

/**
 * Get supported languages
 */
export function getLanguages(_req: Request, res: Response): void {
    res.json({
        success: true,
        languages: config.supportedLanguages,
    });
}

/**
 * Get supported platforms
 */
export function getPlatforms(_req: Request, res: Response): void {
    res.json({
        success: true,
        platforms: [
            { name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
            { name: 'Facebook', domains: ['facebook.com', 'fb.watch'] },
            { name: 'Instagram', domains: ['instagram.com'] },
            { name: 'Twitter/X', domains: ['twitter.com', 'x.com'] },
            { name: 'TikTok', domains: ['tiktok.com'] },
        ],
    });
}

/**
 * Check system status
 */
export async function getSystemStatus(_req: Request, res: Response): Promise<void> {
    const ytdlpInstalled = await checkYtDlpInstalled();
    const geminiConfigured = await checkGeminiConfigured();

    res.json({
        success: true,
        status: {
            ytdlp: ytdlpInstalled,
            gemini: geminiConfigured,
            ready: ytdlpInstalled && geminiConfigured,
        },
        message: !ytdlpInstalled
            ? 'yt-dlp is not installed. Please install it: pip install yt-dlp'
            : !geminiConfigured
                ? 'Gemini API key not configured. Please set GEMINI_API_KEY in .env'
                : 'System ready',
    });
}

/**
 * Process a video URL - download and transcribe
 */
export async function processVideo(req: Request, res: Response): Promise<void> {
    try {
        const { url, language } = req.body as ProcessVideoRequest;

        // Validate input
        if (!url) {
            res.status(400).json({ success: false, error: 'Video URL is required' });
            return;
        }

        if (!language) {
            res.status(400).json({ success: false, error: 'Language is required' });
            return;
        }

        // Validate URL
        if (!isValidPlatformUrl(url)) {
            res.status(400).json({
                success: false,
                error: 'Unsupported platform. Supported: YouTube, Facebook, Instagram, Twitter/X, TikTok'
            });
            return;
        }

        // Validate language
        const validLanguage = config.supportedLanguages.find(l => l.code === language);
        if (!validLanguage) {
            res.status(400).json({ success: false, error: 'Unsupported language' });
            return;
        }

        // Create job
        const videoId = generateId();
        const videoData: VideoData = {
            id: videoId,
            url,
            platform: extractPlatform(url),
            language,
            status: 'pending',
            progress: 0,
            statusMessage: 'Initializing...',
            createdAt: new Date(),
        };

        videoJobs.set(videoId, videoData);

        // Return immediately with job ID
        res.json({
            success: true,
            id: videoId,
            message: 'Video processing started',
        });

        // Process in background
        processVideoAsync(videoId, url, language);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: errorMessage });
    }
}

/**
 * Background video processing
 */
async function processVideoAsync(videoId: string, url: string, language: string): Promise<void> {
    const updateStatus = (status: VideoStatus, progress: number, message: string) => {
        const job = videoJobs.get(videoId);
        if (job) {
            job.status = status;
            job.progress = progress;
            job.statusMessage = message;
        }
    };

    try {
        // Step 1: Download video
        updateStatus('downloading', 5, 'Starting download...');

        const downloadResult = await downloadVideo(url, videoId, (progress, message) => {
            updateStatus('downloading', progress, message);
        });

        const job = videoJobs.get(videoId);
        if (job) {
            job.audioPath = downloadResult.audioPath;
            job.title = downloadResult.title;
            job.duration = downloadResult.duration;
        }

        // Step 2: Transcribe audio
        updateStatus('transcribing', 45, 'Starting transcription...');

        const transcriptionResult = await transcribeAudio(downloadResult.audioPath, language, (progress, message) => {
            updateStatus('transcribing', progress, message);
        });

        if (job) {
            job.transcription = transcriptionResult.transcription;
            job.status = 'completed';
            job.progress = 70;
            job.statusMessage = 'Transcription complete. Ready for analysis.';
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const job = videoJobs.get(videoId);
        if (job) {
            job.status = 'error';
            job.error = errorMessage;
            job.statusMessage = `Error: ${errorMessage}`;
        }
    }
}


/**
 * Get video processing status
 */
export function getVideoStatus(req: Request, res: Response): void {
    const { id } = req.params;

    const job = videoJobs.get(id);
    if (!job) {
        res.status(404).json({ success: false, error: 'Video not found' });
        return;
    }

    res.json({
        success: true,
        id: job.id,
        status: job.status,
        progress: job.progress,
        statusMessage: job.statusMessage,
        title: job.title,
        platform: job.platform,
        transcription: job.status === 'completed' || job.status === 'analyzing' ? job.transcription : undefined,
        error: job.error,
    });
}

/**
 * Analyze (fact-check) a transcribed video
 */
export async function analyzeVideo(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { useInternet = false } = req.body as AnalyzeRequest;

        const job = videoJobs.get(id);
        if (!job) {
            res.status(404).json({ success: false, error: 'Video not found' });
            return;
        }

        if (!job.transcription) {
            res.status(400).json({ success: false, error: 'Video not yet transcribed' });
            return;
        }

        if (job.status === 'analyzing') {
            res.status(400).json({ success: false, error: 'Analysis already in progress' });
            return;
        }

        // Update status
        job.status = 'analyzing';
        job.progress = 75;
        job.statusMessage = 'Starting fact-check analysis...';

        // Return immediately
        res.json({
            success: true,
            id: job.id,
            message: 'Analysis started',
        });

        // Analyze in background
        analyzeVideoAsync(id, job.transcription, job.language);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: errorMessage });
    }
}

/**
 * Background analysis processing
 */
async function analyzeVideoAsync(videoId: string, transcription: string, language: string): Promise<void> {
    const job = videoJobs.get(videoId);
    if (!job) return;

    try {
        const result = await factCheckTranscription(transcription, language, (progress, message) => {
            job.progress = progress;
            job.statusMessage = message;
        });

        job.claims = result.claims;
        job.overallScore = result.overallScore;
        job.analyzedAt = new Date();
        job.status = 'completed';
        job.progress = 100;
        job.statusMessage = 'Analysis complete!';

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        job.status = 'error';
        job.error = errorMessage;
        job.statusMessage = `Analysis error: ${errorMessage}`;
    }
}

/**
 * Get final results
 */
export function getVideoResults(req: Request, res: Response): void {
    const { id } = req.params;

    const job = videoJobs.get(id);
    if (!job) {
        res.status(404).json({ success: false, error: 'Video not found' });
        return;
    }

    if (!job.claims || job.overallScore === undefined) {
        res.status(400).json({
            success: false,
            error: 'Analysis not yet complete',
            status: job.status,
            progress: job.progress,
        });
        return;
    }

    const summary = {
        totalClaims: job.claims.length,
        trueClaims: job.claims.filter(c => c.status === 'true').length,
        falseClaims: job.claims.filter(c => c.status === 'false').length,
        partiallyTrueClaims: job.claims.filter(c => c.status === 'partially_true').length,
        unverifiableClaims: job.claims.filter(c => c.status === 'unverifiable').length,
    };

    res.json({
        success: true,
        id: job.id,
        url: job.url,
        title: job.title,
        platform: job.platform,
        language: job.language,
        transcription: job.transcription,
        overallScore: job.overallScore,
        claims: job.claims,
        summary,
        analyzedAt: job.analyzedAt,
    });
}

/**
 * Delete a video job and cleanup files
 */
export function deleteVideo(req: Request, res: Response): void {
    const { id } = req.params;

    const job = videoJobs.get(id);
    if (!job) {
        res.status(404).json({ success: false, error: 'Video not found' });
        return;
    }

    // Cleanup temp files
    cleanupTempFiles(id);

    // Remove from memory
    videoJobs.delete(id);

    res.json({
        success: true,
        message: 'Video deleted successfully',
    });
}
