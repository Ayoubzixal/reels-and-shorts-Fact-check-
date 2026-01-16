const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const FILE_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
const OUTPUT_FILE = "ffmpeg.zip";
const TARGET_DIR = path.join(__dirname, 'ffmpeg');

async function download() {
    console.log(`Downloading ${FILE_URL}...`);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(OUTPUT_FILE);
        https.get(FILE_URL, response => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                console.log(`Redirecting to ${response.headers.location}`);
                https.get(response.headers.location, redirectResponse => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                }).on('error', err => {
                    fs.unlink(OUTPUT_FILE, () => { });
                    reject(err);
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }
        }).on('error', err => {
            fs.unlink(OUTPUT_FILE, () => { });
            reject(err);
        });
    });
}

function extract() {
    console.log("Extracting...");
    try {
        if (!fs.existsSync(TARGET_DIR)) {
            fs.mkdirSync(TARGET_DIR);
        }

        // Unzip using powershell
        execSync(`powershell -command "Expand-Archive -Path ${OUTPUT_FILE} -DestinationPath ffmpeg_temp -Force"`, { stdio: 'inherit' });

        console.log("Locating binaries...");
        // Find ffmpeg.exe and ffprobe.exe recursively
        const findAndMove = (dir) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    findAndMove(fullPath);
                } else {
                    if (file === 'ffmpeg.exe' || file === 'ffprobe.exe') {
                        console.log(`Found ${file}, moving to ${TARGET_DIR}`);
                        fs.copyFileSync(fullPath, path.join(TARGET_DIR, file));
                    }
                }
            }
        };

        findAndMove('ffmpeg_temp');

        console.log("Cleanup...");
        execSync(`rmdir /s /q ffmpeg_temp`);
        fs.unlinkSync(OUTPUT_FILE);

        console.log("Done.");
    } catch (e) {
        console.error("Extraction failed:", e);
    }
}

download().then(() => {
    console.log("Download complete.");
    extract();
}).catch(err => {
    console.error("Download failed:", err);
});
