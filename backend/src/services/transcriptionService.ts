import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { config } from '../config/config';

interface TranscriptionResult {
    transcription: string;
    language: string;
}

interface ChunkInfo {
    path: string;
    startTime: number; // in seconds
    duration: number;  // in seconds
}

// 4 MB threshold - be conservative due to base64 encoding (~33% increase)
const FILE_SIZE_THRESHOLD = 4 * 1024 * 1024;

// Chunking configuration
const CHUNK_DURATION_SECONDS = 5 * 60; // 5 minutes per chunk
const CHUNKING_THRESHOLD_SECONDS = 10 * 60; // Use chunking for audio > 10 minutes

/**
 * Get audio duration using FFprobe
 */
function getAudioDuration(audioPath: string): number {
    try {
        // Use system ffprobe if FFMPEG_PATH is not set (Railway), otherwise use local Windows path
        const ffprobePath = process.env.FFMPEG_PATH ? path.join(config.ffmpegPath, 'ffprobe.exe') : 'ffprobe';
        const result = execSync(
            `"${ffprobePath}" -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
            { encoding: 'utf8' }
        );
        const duration = parseFloat(result.trim());
        console.log(`Audio duration: ${duration} seconds (${(duration / 60).toFixed(1)} minutes)`);
        return duration;
    } catch (err) {
        console.error('Could not get audio duration:', err);
        return 0; // Fall back to non-chunked approach
    }
}

/**
 * Split audio into chunks using FFmpeg
 */
async function splitAudioIntoChunks(
    audioPath: string,
    chunkDuration: number = CHUNK_DURATION_SECONDS
): Promise<ChunkInfo[]> {
    const totalDuration = getAudioDuration(audioPath);
    if (totalDuration <= 0) {
        throw new Error('Could not determine audio duration');
    }

    const chunks: ChunkInfo[] = [];
    const ext = path.extname(audioPath);
    const dir = path.dirname(audioPath);
    const baseName = path.basename(audioPath, ext);
    // Use system ffmpeg if FFMPEG_PATH is not set (Railway), otherwise use local Windows path
    const ffmpegPath = process.env.FFMPEG_PATH ? path.join(config.ffmpegPath, 'ffmpeg.exe') : 'ffmpeg';

    let startTime = 0;
    let chunkIndex = 0;

    while (startTime < totalDuration) {
        const chunkPath = path.join(dir, `${baseName}_chunk${chunkIndex}${ext}`);
        const duration = Math.min(chunkDuration, totalDuration - startTime);

        try {
            execSync(
                `"${ffmpegPath}" -y -i "${audioPath}" -ss ${startTime} -t ${duration} -c copy "${chunkPath}"`,
                { encoding: 'utf8', stdio: 'pipe' }
            );

            if (fs.existsSync(chunkPath)) {
                chunks.push({
                    path: chunkPath,
                    startTime: startTime,
                    duration: duration
                });
                console.log(`Created chunk ${chunkIndex}: ${startTime}s - ${startTime + duration}s`);
            }
        } catch (err) {
            console.error(`Failed to create chunk ${chunkIndex}:`, err);
        }

        startTime += chunkDuration;
        chunkIndex++;
    }

    console.log(`Split audio into ${chunks.length} chunks`);
    return chunks;
}

/**
 * Transcribe audio using Google Gemini AI
 * Uses chunking for long audio (>10 min), File API for large files (>4MB)
 */
export async function transcribeAudio(
    audioPath: string,
    language: string,
    onProgress?: (progress: number, message: string) => void
): Promise<TranscriptionResult> {
    if (!config.geminiApiKey) {
        throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in .env');
    }

    onProgress?.(45, 'Initializing transcription...');

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.geminiTranscriptionModel });

    // Get file stats
    const stats = fs.statSync(audioPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Audio file size: ${fileSizeMB} MB, using model: ${config.geminiTranscriptionModel}`);

    // Determine MIME type
    const ext = path.extname(audioPath).toLowerCase();
    let mimeType = 'audio/mpeg';
    if (ext === '.m4a') mimeType = 'audio/mp4';
    if (ext === '.webm') mimeType = 'audio/webm';
    if (ext === '.wav') mimeType = 'audio/wav';
    if (ext === '.ogg') mimeType = 'audio/ogg';

    // Get language name
    const languageInfo = config.supportedLanguages.find(l => l.code === language);
    const languageName = languageInfo?.name || 'English';

    // Check audio duration for chunking decision
    const audioDuration = getAudioDuration(audioPath);

    // Use chunking for long audio (>10 minutes)
    if (audioDuration > CHUNKING_THRESHOLD_SECONDS) {
        console.log(`Audio is ${(audioDuration / 60).toFixed(1)} min - using chunked transcription`);
        onProgress?.(48, `Long audio detected (${(audioDuration / 60).toFixed(0)} min), splitting into chunks...`);
        return await transcribeWithChunking(audioPath, mimeType, languageName, model, audioDuration, onProgress);
    }

    const prompt = `Transcribe this audio accurately in ${languageName}. Include timestamps every 30 seconds [MM:SS]. Return only the transcription text.`;

    onProgress?.(48, 'Preparing audio for transcription...');

    // Use File API for anything > 4MB (safer threshold)
    if (stats.size > FILE_SIZE_THRESHOLD) {
        console.log('Using Gemini File API for transcription...');
        return await transcribeWithFileAPI(audioPath, mimeType, languageName, prompt, model, onProgress);
    } else {
        console.log('Using inline data for transcription...');
        return await transcribeWithInlineData(audioPath, mimeType, languageName, prompt, model, onProgress);
    }
}

/**
 * Transcribe long audio using chunking approach
 * Splits audio into 5-minute chunks, transcribes each, merges with adjusted timestamps
 */
async function transcribeWithChunking(
    audioPath: string,
    mimeType: string,
    languageName: string,
    model: any,
    totalDuration: number,
    onProgress?: (progress: number, message: string) => void
): Promise<TranscriptionResult> {
    // Split audio into chunks
    onProgress?.(50, 'Splitting audio into chunks...');
    const chunks = await splitAudioIntoChunks(audioPath, CHUNK_DURATION_SECONDS);

    if (chunks.length === 0) {
        throw new Error('Failed to split audio into chunks');
    }

    console.log(`Processing ${chunks.length} chunks for transcription`);

    const fileManager = new GoogleAIFileManager(config.geminiApiKey);
    const transcriptions: string[] = [];

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progressBase = 50 + Math.floor((i / chunks.length) * 40); // Progress from 50-90%
        const startTimeFormatted = formatTimestamp(chunk.startTime);

        onProgress?.(progressBase, `Transcribing chunk ${i + 1}/${chunks.length} (from ${startTimeFormatted})...`);
        console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.path}`);

        try {
            const prompt = `Transcribe this audio segment accurately in ${languageName}. This is part ${i + 1} of ${chunks.length} of a longer audio starting at ${startTimeFormatted}. Include timestamps relative to this segment start [MM:SS]. Return only the transcription text.`;

            // Upload chunk
            const uploadResult = await uploadWithRetry(
                fileManager,
                chunk.path,
                {
                    mimeType: mimeType,
                    displayName: path.basename(chunk.path),
                },
                3
            );

            // Wait for processing
            let file = uploadResult.file;
            let waitCount = 0;
            while (file.state === 'PROCESSING' && waitCount < 30) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                try {
                    file = await fileManager.getFile(file.name);
                } catch (e) { /* continue waiting */ }
                waitCount++;
            }

            if (file.state === 'FAILED') {
                console.error(`Chunk ${i + 1} processing failed, skipping...`);
                continue;
            }

            // Transcribe chunk
            const result = await model.generateContent([
                { text: prompt },
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri,
                    },
                },
            ]);

            const transcription = result.response.text();
            if (transcription && transcription.trim().length > 0) {
                // Add header for this chunk's section
                const headerText = `\n[${startTimeFormatted}]\n`;
                transcriptions.push(headerText + transcription.trim());
            }

            // Cleanup uploaded file
            try {
                await fileManager.deleteFile(file.name);
            } catch (e) { /* non-critical */ }

        } catch (err) {
            console.error(`Failed to transcribe chunk ${i + 1}:`, err);
            // Continue with other chunks
        }

        // Cleanup chunk file
        try {
            fs.unlinkSync(chunk.path);
        } catch (e) { /* non-critical */ }
    }

    if (transcriptions.length === 0) {
        throw new Error('Failed to transcribe any chunks');
    }

    onProgress?.(95, 'Merging transcriptions...');

    // Merge all transcriptions
    const fullTranscription = transcriptions.join('\n\n');

    console.log(`Successfully transcribed ${transcriptions.length}/${chunks.length} chunks`);
    onProgress?.(100, 'Transcription complete!');

    return {
        transcription: fullTranscription,
        language: languageName,
    };
}

/**
 * Format seconds to MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Upload file with retry logic and exponential backoff
 */
async function uploadWithRetry(
    fileManager: GoogleAIFileManager,
    audioPath: string,
    options: { mimeType: string; displayName: string },
    maxRetries: number = 3,
    onProgress?: (progress: number, message: string) => void
): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            onProgress?.(50 + attempt, `Uploading audio (attempt ${attempt}/${maxRetries})...`);
            const result = await fileManager.uploadFile(audioPath, options);
            return result;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.error(`Upload attempt ${attempt}/${maxRetries} failed:`, lastError.message);

            if (attempt < maxRetries) {
                // Exponential backoff: 2s, 4s, 8s
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('Upload failed after all retries');
}

/**
 * Transcribe using File API (for larger files)
 */
async function transcribeWithFileAPI(
    audioPath: string,
    mimeType: string,
    languageName: string,
    prompt: string,
    model: any,
    onProgress?: (progress: number, message: string) => void
): Promise<TranscriptionResult> {
    onProgress?.(50, 'Uploading audio to Gemini...');

    const fileManager = new GoogleAIFileManager(config.geminiApiKey);

    // Upload the file with retry logic
    const uploadResult = await uploadWithRetry(
        fileManager,
        audioPath,
        {
            mimeType: mimeType,
            displayName: path.basename(audioPath),
        },
        3,
        onProgress
    );

    console.log(`File uploaded: ${uploadResult.file.uri}, state: ${uploadResult.file.state}`);
    onProgress?.(55, 'Audio uploaded, waiting for processing...');

    // Wait for file to be ready
    let file = uploadResult.file;
    let waitCount = 0;
    const maxWait = 60; // Max 2 minutes wait

    while (file.state === 'PROCESSING' && waitCount < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const getResult = await fileManager.getFile(file.name);
            file = getResult;
        } catch (e) {
            console.log('Waiting for file to process...');
        }
        waitCount++;
        onProgress?.(55 + Math.min(waitCount, 10), `Processing audio... (${waitCount * 2}s)`);
    }

    if (file.state === 'FAILED') {
        throw new Error('Gemini file processing failed. Try a shorter video.');
    }

    if (file.state !== 'ACTIVE') {
        console.log(`File state: ${file.state}, proceeding anyway...`);
    }

    onProgress?.(65, `Transcribing in ${languageName}...`);

    // Transcribe with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            onProgress?.(65 + attempt * 2, `Transcribing (attempt ${attempt}/3)...`);

            const result = await model.generateContent([
                { text: prompt },
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri,
                    },
                },
            ]);

            const transcription = result.response.text();

            if (transcription && transcription.trim().length > 0) {
                // Cleanup: delete the uploaded file
                try {
                    await fileManager.deleteFile(file.name);
                    console.log('Cleaned up uploaded file');
                } catch (e) {
                    console.log('Could not delete file (non-critical)');
                }

                onProgress?.(70, 'Transcription complete!');
                return {
                    transcription: transcription.trim(),
                    language: languageName,
                };
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.error(`File API transcription attempt ${attempt} failed:`, lastError.message);

            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    throw lastError || new Error('Transcription failed with File API');
}

/**
 * Transcribe using inline data (for small files only)
 */
async function transcribeWithInlineData(
    audioPath: string,
    mimeType: string,
    languageName: string,
    prompt: string,
    model: any,
    onProgress?: (progress: number, message: string) => void
): Promise<TranscriptionResult> {
    onProgress?.(50, 'Reading audio file...');

    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString('base64');

    onProgress?.(55, `Transcribing in ${languageName}...`);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            onProgress?.(55 + attempt * 5, `Transcribing (attempt ${attempt}/3)...`);

            const result = await model.generateContent([
                { text: prompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Audio,
                    },
                },
            ]);

            const transcription = result.response.text();

            if (transcription && transcription.trim().length > 0) {
                onProgress?.(70, 'Transcription complete!');
                return {
                    transcription: transcription.trim(),
                    language: languageName,
                };
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.error(`Inline transcription attempt ${attempt} failed:`, lastError.message);

            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    throw lastError || new Error('Transcription failed with inline data');
}

/**
 * Check if Gemini API is configured
 */
export async function checkGeminiConfigured(): Promise<boolean> {
    if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
        return false;
    }

    try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: config.geminiTranscriptionModel });
        await model.generateContent('test');
        return true;
    } catch {
        return false;
    }
}
