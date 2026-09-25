#!/bin/bash
# Installs the build-recorder skill for every Claude Code session on this computer (macOS / Linux).
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.claude/skills/build-recorder"
mkdir -p "$HOME/.claude/skills"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
echo "Installed → $DEST"
command -v ffmpeg >/dev/null || echo "Next: install ffmpeg  (macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg)"
command -v node >/dev/null || echo "Next: install Node.js (https://nodejs.org) for the product demo"
python3 -c "import pynput" 2>/dev/null || echo "Next: pip3 install pynput   (for live prompt polishing)"
echo "Then open Claude Code on this computer and say: start build recording"
