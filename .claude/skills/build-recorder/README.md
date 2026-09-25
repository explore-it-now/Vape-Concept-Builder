# build-recorder (Claude Code skill)

Records your real screen while you build with Claude Design, claude.ai and Claude Code, then edits it into a
silent, voiceover-ready video: idle time cut, generation fast-forwarded, zoom on every click, section cards,
and an end-to-end demo of the finished product. Also produces a timestamped shot list.

## Install (once, on your computer)

macOS / Linux:
```
git clone https://github.com/explore-it-now/Vape-Concept-Builder.git
./Vape-Concept-Builder/.claude/skills/build-recorder/install.sh
```
Windows (PowerShell):
```
git clone https://github.com/explore-it-now/Vape-Concept-Builder.git
powershell -ExecutionPolicy Bypass -File .\Vape-Concept-Builder\.claude\skills\build-recorder\install.ps1
```
Requirements: Python 3, ffmpeg, Node.js + Playwright (for the product demo), `pip install pynput` (for live polish).
macOS: allow Screen Recording for your terminal / Claude app (System Settings → Privacy & Security).

## Use

1. Open Claude Code **on your computer** (desktop app, IDE extension or `claude` in a terminal). Cloud sessions can't see your screen.
2. Say **"start build recording"** (or `/build-recorder`).
3. Build as usual in Claude Design, claude.ai and Claude Code. Say "mark: …" to label moments.
4. Say **"stop recording"**. You get `build-recording/final.mp4` and `build-recording/shotlist.md`.
