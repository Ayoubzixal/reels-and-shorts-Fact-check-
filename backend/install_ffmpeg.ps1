$url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$output = "ffmpeg.zip"
$dir = "ffmpeg"

Write-Host "Downloading FFmpeg from GitHub..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $output

Write-Host "Extracting..."
if (Test-Path "ffmpeg_temp") { Remove-Item -Recurse -Force "ffmpeg_temp" }
Expand-Archive -Path $output -DestinationPath "ffmpeg_temp" -Force

Write-Host "Locating and moving binaries..."
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir }

$ffmpeg = Get-ChildItem -Path "ffmpeg_temp" -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
$ffprobe = Get-ChildItem -Path "ffmpeg_temp" -Recurse -Filter "ffprobe.exe" | Select-Object -First 1

if ($ffmpeg -and $ffprobe) {
    Move-Item -Path $ffmpeg.FullName -Destination $dir -Force
    Move-Item -Path $ffprobe.FullName -Destination $dir -Force
    Write-Host "Success! FFmpeg installed to $dir"
} else {
    Write-Error "Could not find binaries in the zip file."
}

Write-Host "Cleaning up..."
Remove-Item $output
Remove-Item -Recurse -Force "ffmpeg_temp"
