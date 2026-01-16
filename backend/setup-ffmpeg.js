const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const ZIP_PATH = 'ffmpeg.zip';
const EXTRACT_DIR = 'ffmpeg_temp';
const FINAL_DIR = 'ffmpeg';

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const get = (link) => {
            console.log(`Getting: ${link}`);
            https.get(link, { headers: { 'User-Agent': 'Node.js Downloader' } }, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.log(`Redirecting to: ${response.headers.location}`);
                    get(response.headers.location);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        };
        get(url);
    });
}

async function main() {
    console.log('Downloading FFmpeg...');
    try {
        await downloadFile(FFMPEG_URL, ZIP_PATH);
        console.log('Download complete. Extracting...');

        if (fs.existsSync(EXTRACT_DIR)) {
            try {
                fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
            } catch (e) { console.log('Could not clear temp dir, proceeding...'); }
        }
        fs.mkdirSync(EXTRACT_DIR);

        // Use standard Windows tar if available (usually is) or Powershell
        // Powershell Expand-Archive is reliable on Win 10+
        console.log('Unzipping...');
        execSync(`powershell -command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${EXTRACT_DIR}' -Force"`);

        console.log('Extraction complete. Locating binaries...');

        const findFile = (dir, name) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        const found = findFile(filePath, name);
                        if (found) return found;
                    } else if (file === name) {
                        return filePath;
                    }
                } catch (e) { /* ignore access errors */ }
            }
            return null;
        };

        const ffmpegPath = findFile(EXTRACT_DIR, 'ffmpeg.exe');
        const ffprobePath = findFile(EXTRACT_DIR, 'ffprobe.exe');

        if (!ffmpegPath || !ffprobePath) {
            throw new Error('Could not find ffmpeg.exe or ffprobe.exe in extracted archive');
        }

        console.log(`Found binaries:\n${ffmpegPath}\n${ffprobePath}`);

        if (!fs.existsSync(FINAL_DIR)) {
            fs.mkdirSync(FINAL_DIR);
        }

        fs.copyFileSync(ffmpegPath, path.join(FINAL_DIR, 'ffmpeg.exe'));
        fs.copyFileSync(ffprobePath, path.join(FINAL_DIR, 'ffprobe.exe'));

        console.log('Binaries installed successfully to ./ffmpeg');

        // Cleanup
        console.log('Cleaning up...');
        try {
            fs.unlinkSync(ZIP_PATH);
            fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
        } catch (e) {
            console.log('Cleanup error (non-critical):', e.message);
        }

        console.log('Done! FFmpeg is ready.');

    } catch (error) {
        console.error('Setup failed:', error);
    }
}

main();
