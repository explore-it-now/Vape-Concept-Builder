# Installs the build-recorder skill for every Claude Code session on this computer (Windows).
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:USERPROFILE ".claude\skills\build-recorder"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Copy-Item -Recurse $src $dest
Write-Host "Installed -> $dest"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host "Next: install ffmpeg:  winget install Gyan.FFmpeg" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "Next: install Node.js (https://nodejs.org) for the product demo" }
Write-Host "Then open Claude Code on this computer and say: start build recording"
