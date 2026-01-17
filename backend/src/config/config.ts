import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    // Model for transcription
    geminiTranscriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-2.5-flash',
    // Model for fact-check analysis
    geminiAnalysisModel: process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3-flash-preview',
    tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../temp'),
    // FFmpeg binary path - use system ffmpeg on Railway/Serv00, or local path for development
    ffmpegPath: process.env.FFMPEG_PATH || '',

    // Supported languages for transcription
    supportedLanguages: [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'it', name: 'Italian', nativeName: 'Italiano' },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
        { code: 'ru', name: 'Russian', nativeName: 'Русский' },
        { code: 'zh', name: 'Chinese', nativeName: '中文' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
        { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    ],

    // Supported platforms
    supportedPlatforms: [
        'youtube.com',
        'youtu.be',
        'facebook.com',
        'fb.watch',
        'instagram.com',
        'twitter.com',
        'x.com',
        'tiktok.com',
    ]
};
