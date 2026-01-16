const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/ayob-/Desktop/fact check/ffmpeg-temp/ffmpeg-8.0.1-essentials_build/bin';
const destDir = 'c:/Users/ayob-/Desktop/fact check/backend/ffmpeg';

try {
    fs.copyFileSync(path.join(srcDir, 'ffmpeg.exe'), path.join(destDir, 'ffmpeg.exe'));
    console.log('Copied ffmpeg.exe');
    fs.copyFileSync(path.join(srcDir, 'ffprobe.exe'), path.join(destDir, 'ffprobe.exe'));
    console.log('Copied ffprobe.exe');
    console.log('SUCCESS! FFmpeg is now installed.');
} catch (err) {
    console.error('Error:', err.message);
}
