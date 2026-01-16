import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return uuidv4();
}

/**
 * Ensure temp directory exists
 */
export function ensureTempDir(): void {
    if (!fs.existsSync(config.tempDir)) {
        fs.mkdirSync(config.tempDir, { recursive: true });
    }
}

/**
 * Clean up temp files for a video
 */
export function cleanupTempFiles(videoId: string): void {
    const videoDir = path.join(config.tempDir, videoId);
    if (fs.existsSync(videoDir)) {
        fs.rmSync(videoDir, { recursive: true, force: true });
    }
}

/**
 * Extract platform from URL
 */
export function extractPlatform(url: string): string {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '').toLowerCase();

        if (hostname.includes('youtube') || hostname.includes('youtu.be')) {
            return 'YouTube';
        } else if (hostname.includes('facebook') || hostname.includes('fb.watch')) {
            return 'Facebook';
        } else if (hostname.includes('instagram')) {
            return 'Instagram';
        } else if (hostname.includes('twitter') || hostname.includes('x.com')) {
            return 'Twitter/X';
        } else if (hostname.includes('tiktok')) {
            return 'TikTok';
        }

        return 'Unknown';
    } catch {
        return 'Unknown';
    }
}

/**
 * Validate URL is from supported platform
 */
export function isValidPlatformUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '').toLowerCase();

        return config.supportedPlatforms.some(platform =>
            hostname.includes(platform.replace('www.', ''))
        );
    } catch {
        return false;
    }
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
