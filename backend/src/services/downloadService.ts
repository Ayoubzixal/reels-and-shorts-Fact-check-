import ytdlp from 'yt-dlp-exec';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';
import { ensureTempDir } from '../utils/helpers';

interface DownloadResult {
    audioPath: string;
    title: string;
    duration: number;
}

/**
 * Download video and extract audio using yt-dlp
 * Works WITHOUT FFmpeg by keeping original audio format
 */
export async function downloadVideo(
    url: string,
    videoId: string,
    onProgress?: (progress: number, message: string) => void
): Promise<DownloadResult> {
    ensureTempDir();

    const videoDir = path.join(config.tempDir, videoId);
    if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
    }

    // Don't specify mp3, let yt-dlp keep original format (works without ffmpeg)
    const outputTemplate = path.join(videoDir, 'audio.%(ext)s');

    onProgress?.(10, 'Starting download...');

    try {
        // First, get video info with bypass options
        onProgress?.(15, 'Fetching video information...');

        // Common bypass options for cloud servers
        const bypassOptions = {
            noWarnings: true,
            noCheckCertificate: true,
            // Use browser-like User-Agent
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            // Add referer
            referer: 'https://www.google.com/',
            // Extractor retries
            extractorRetries: 3,
            // Sleep between retries
            sleepInterval: 1,
            // Force IPv4
            forceIpv4: true,
        };

        const infoResult = await ytdlp(url, {
            dumpSingleJson: true,
            ...bypassOptions,
        });

        const videoInfo = infoResult as unknown as { title: string; duration: number };

        onProgress?.(25, `Downloading: ${videoInfo.title}`);

        // Try to download as lower bitrate audio to reduce file size
        // This requires FFmpeg - if not available, fallback to bestaudio
        let audioPath: string | null = null;

        try {
            // First try: Convert to low bitrate MP3 (requires FFmpeg)
            const mp3Output = path.join(videoDir, 'audio.mp3');
            await ytdlp(url, {
                format: 'worstaudio',  // Start with smallest audio
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: 9,  // 0-9 scale, 9 = lowest quality/smallest file
                output: path.join(videoDir, 'audio.%(ext)s'),
                ...bypassOptions,
                ffmpegLocation: process.env.FFMPEG_PATH ? config.ffmpegPath : undefined,  // Use system FFmpeg on Railway
            });

            // Check if MP3 was created
            if (fs.existsSync(mp3Output)) {
                audioPath = mp3Output;
                const sizeMB = (fs.statSync(mp3Output).size / (1024 * 1024)).toFixed(2);
                console.log(`Audio extracted as low-bitrate MP3: ${sizeMB} MB`);
            }
        } catch (err) {
            console.log('Low-bitrate conversion failed (FFmpeg may not be available), trying fallback...');
        }

        // Fallback: Download in original format (no FFmpeg needed)
        if (!audioPath) {
            await ytdlp(url, {
                format: 'bestaudio',
                output: path.join(videoDir, 'audio.%(ext)s'),
                ...bypassOptions,
            });

            // Find the downloaded audio file
            const files = fs.readdirSync(videoDir);
            const audioFile = files.find(f =>
                f.startsWith('audio.') &&
                (f.endsWith('.webm') || f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.opus'))
            );

            if (audioFile) {
                audioPath = path.join(videoDir, audioFile);
            }
        }

        onProgress?.(40, 'Download complete!');

        if (!audioPath) {
            throw new Error('Audio file not found after download');
        }

        return {
            audioPath,
            title: videoInfo.title || 'Unknown Title',
            duration: videoInfo.duration || 0,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
        console.error('Download error:', errorMessage);
        throw new Error(`Failed to download video: ${errorMessage}`);
    }
}

/**
 * Check if yt-dlp is installed
 */
export async function checkYtDlpInstalled(): Promise<boolean> {
    try {
        await ytdlp('--version');
        return true;
    } catch {
        return false;
    }
}
