@echo off
echo Downloading FFmpeg...
curl -L -o ffmpeg.zip https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

echo Extracting...
if exist ffmpeg_temp rmdir /s /q ffmpeg_temp
mkdir ffmpeg_temp
powershell -command "Expand-Archive -Path ffmpeg.zip -DestinationPath ffmpeg_temp -Force"

echo Moving binaries...
if not exist ffmpeg mkdir ffmpeg
powershell -command "Get-ChildItem -Path ffmpeg_temp -Recurse -Filter *.exe | Where-Object { $_.Name -match 'ffmpeg.exe|ffprobe.exe' } | Move-Item -Destination ffmpeg -Force"

echo Cleaning up...
del ffmpeg.zip
rmdir /s /q ffmpeg_temp

echo FFmpeg installation complete!
