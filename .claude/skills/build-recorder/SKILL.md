---
name: build-recorder
description: Records the user's real screen while they build an app, website, tool, dashboard, AI tool or any software with Claude (Claude Design, claude.ai chat and Claude Code), then edits it into a clean, silent step-by-step video ready for a voiceover. Idle time is cut, Claude's generation is fast-forwarded, every click is zoomed in, section title cards are added, and an end-to-end demo of the finished product is appended, plus a timestamped shot list. Use when the user says "start build recording", "record this build", "record what I'm building", invokes /build-recorder, or asks for a video showing how something was built. Also use when they say "stop recording", "make the build video" or "add a marker".
---

# Build recorder

Turn a real build session into a voiceover-ready video:

1. **Your real screen**, everything: Claude Design, claude.ai chat, the Claude Code terminal or app, your browser.
2. **Automatic editing**: dead time cut, Claude generating fast-forwarded, zoom on each click (e.g. the Export button in Claude Design), section cards at each stage.
3. **The finished product demo**, recorded end to end with Playwright and zoomed on each click.
4. **`final.mp4`** (1920×1080, silent) + **`shotlist.md`** (timestamps for writing the voiceover).

Scripts live next to this file in `scripts/`. `REC` below means `python3 <this skill dir>/scripts/rec.py` (use `python` on Windows). All output goes in `./build-recording/` in the current project unless `--dir` is given.

## It must run on the user's own computer

The recorder captures the screen of the machine Claude Code runs on. It works in **Claude Code on the user's Mac, Windows or Linux computer** (desktop app, VS Code/JetBrains extension, or `claude` in a terminal). It cannot work in a cloud session (claude.ai/code web, mobile, or `CLAUDE_CODE_REMOTE=true`), because those run in a remote container with no view of the user's screen. If invoked there, say so plainly in two or three lines, explain they need to start Claude Code on their computer, and stop. Do not fake a recording.

## 1. Start (at the very beginning of the session)

1. Run `REC doctor`. Fix what it reports before going on:
   - **ffmpeg missing**: macOS `brew install ffmpeg`, Windows `winget install Gyan.FFmpeg`, Linux `sudo apt install ffmpeg`. Ask before installing anything.
   - **macOS screen permission**: the app running Claude Code (Terminal, iTerm, VS Code, or the Claude app) needs **System Settings → Privacy & Security → Screen & System Audio Recording**. The user must enable it and restart that app. The first `start` may trigger the macOS prompt.
2. Ask what they are building if they have not said, and the project name (used for the title card).
3. **Offer a prompt script** so the live prompting looks professional on camera: read
   `reference/prompt-playbook.md`, write `build-recording/prompt-script.md` (4-9 structured prompts
   for Claude Design then Claude Code, in order), and show it to the user. They paste these into the
   real tools during the recording. Skip if they'd rather prompt freely.
4. Run `REC start --polish type` (live polish on; plain `REC start` if they don't want it), then `REC mark "<first stage, e.g. Claude Design>" --kind section`.
5. Tell the user, briefly:
   - The whole main screen is being recorded (not audio). Turn on Do Not Disturb and close anything private.
   - Work normally in Claude Design, claude.ai and here. Before clicking an important button, pause the cursor on it for half a second; that makes the zoom land nicely.
   - Say **"mark: <what just happened>"** to label a moment, and **"stop recording"** when done.
   - Live polish: type any rough prompt into the prompt box, press Ctrl+Alt+P (⌘⌥P on Mac), wait for it to
     rewrite itself, then press Enter.
   - To write a prompt privately instead, say **"pause"**, then write it however you like. I polish it, put it on
     your clipboard and resume; you paste it into Claude Design or Claude Code on camera.

## Live polish (default): write rough, it becomes polished in place

The user types a rough prompt straight into the real prompt box (Claude Design, claude.ai, the Claude
Code desktop app) while recording, presses **Ctrl+Alt+P** (**⌘⌥P** on macOS), and the text is rewritten
in place into a polished prompt that types itself out (or is pasted with `--polish paste`). They then
press Enter themselves. The editor cuts everything from the first rough keystroke until the polished
text starts appearing, so the video shows an empty box, then the polished prompt being written.

- Start with `REC start --polish type` (or `--polish paste`). Needs `pip install pynput` and the
  `claude` CLI on PATH (the rewrite uses the user's own Claude Code login). Check with `REC doctor`.
- macOS: the app running Claude Code needs **Accessibility** and **Input Monitoring** permission
  (System Settings → Privacy & Security), or the hotkey and typing do nothing. Restart that app after.
- Test before recording: `python3 scripts/polish.py --test "make it 3d n add a submit button"`.
- Tell the user: click into the prompt box, type anything, press the hotkey, keep hands off the keyboard
  until it finishes typing (a few seconds), then press Enter to send.
- It works in normal text boxes (browser, desktop apps). In a plain terminal (`claude` CLI) select-all
  doesn't work, so use the pause flow below there, or run Claude Code's desktop app instead.
- Polished prompts follow `reference/prompt-playbook.md` rules (kept in sync inside `polish.py`).

## Polish-and-paste: rough prompt off camera, polished prompt on camera

The user wants viewers to see well-crafted prompts. They write rough prompts off camera; the video only
shows the polished prompt being pasted and sent in the real tool, and Claude building from it. Nothing
is faked: the polished prompt is what actually gets sent.

When the user says **"pause"** (or "polish", or "off camera") while recording:
1. Run `REC pause` immediately. It stops capture and cuts the last 8 s, removing them asking to pause.
2. Tell them in one line: "Paused. Write your prompt however you like."
3. When they send the rough prompt, rewrite it following `reference/prompt-playbook.md`: keep their
   intent, specifics and wording where it's specific; add structure, fix spelling, make it concrete.
   Don't invent features they didn't ask for. Write it to `build-recording/prompts/NN.md`.
4. `REC clip --file build-recording/prompts/NN.md` to put it on the clipboard.
5. Show the polished prompt in full and say where to paste it (Claude Design, claude.ai, or here),
   then ask "Ready? I'll resume the recording." Only when they confirm, run `REC resume`, then
   `REC mark "<first ~80 chars>" --kind prompt`.
6. If the polished prompt is for **this** Claude Code session, they paste it here after resuming.
   Treat it as a new instruction and build it.

For the whole build up front, write the full script in one go (step 3 of Start) and put each prompt on
the clipboard just before it's needed (pause → clip → resume, or clip while recording if the chat is
off screen).

Keep the terminal or chat window where this happens off the recorded screen if possible (a second
monitor, or minimised) so the polishing conversation isn't visible even briefly.

## 2. While building: add markers

Markers become section cards and shot-list notes. Each is one quick command; never let marking slow the build.

- **Every user prompt in this session**: `REC mark "<first ~80 chars of the prompt>" --kind prompt`.
- **Stage changes** (these become title cards): `REC mark "<Stage>" --kind section`. Typical stages: "Designing in Claude Design", "Exporting to Claude Code", "Building in Claude Code", "Testing", "Deploying", "Mobile polish". When a Claude Design handoff arrives here, mark "Exporting from Claude Design to Claude Code" as a section.
- **Milestones**: `REC mark "Build passes" --kind step`, `REC mark "Live at <url>" --kind step`.
- When the user says "mark: X", run `REC mark "X" --kind step` (or `section` if it names a new stage).

For a break (lunch, a call), `REC pause` and later `REC resume`: parts are joined automatically.

## 3. Stop and record the product demo

1. `REC stop`.
2. Get a URL for the finished product: the deployed URL, or start the dev server (e.g. `npm run dev`) and use localhost.
3. Write `build-recording/demo-steps.json` that walks through the product **end to end** the way a buyer would use it: 8-20 steps, each with a short `label`. Read `reference/demo-steps.md` for the format. Use real selectors from the code you wrote. Include the key moments: the main flow, a form submission, anything visual (3D, charts), and mobile if it matters (a second run with `"device": "iPhone 13"`).
   - Use `"mode": "frames"` for heavy WebGL/3D or animation-heavy pages on slow machines (smooth, slower to record); otherwise `"realtime"`.
4. Run `node <skill dir>/scripts/demo.mjs build-recording/demo-steps.json --out build-recording/demo`. Needs Playwright (`npm i -g playwright && npx playwright install chromium` if missing; ask first). Check the printed click count matches the steps; fix selectors and re-run if a step failed.

## 4. Edit

```
REC edit --title "<Project>: how it was built" --subtitle "Claude Design → Claude Code" \
  --demo build-recording/demo/demo.mp4 \
  --demo-clicks build-recording/demo/demo_clicks.json \
  --demo-labels build-recording/demo/demo_labels.json
```

Useful options: `--speed 8` (faster fast-forward), `--max-fast 6` (cap each fast-forward to 6 s on screen), `--zoom 2` (tighter click zoom), `--no-zoom`, `--idle-keep 0.4`, `--width 1080 --height 1920` (vertical output). Editing a long session takes a few minutes; run it in the background and tell the user.

Then:
- Pull 6-10 frames from `final.mp4` (ffmpeg `-ss T -frames:v 1`) and look at them: check the zooms land on the buttons and nothing private is on screen. If a zoom is off, the recording may start slightly before the first frame; retry with `--offset 0.5` or `--offset 1`.
- Give the user the paths to `build-recording/final.mp4` and `build-recording/shotlist.md`, the final length, and what was cut or sped up. Offer to open the folder (`open build-recording` on macOS, `explorer build-recording` on Windows).
- The video is silent on purpose, for their voiceover. `shotlist.md` has one row per shot with an empty "Voiceover notes" column; offer to draft the voiceover script from the markers.

## Notes

- Recordings are large (roughly 1-3 GB per hour on Retina screens). `build-recording/` should not be committed; add it to `.gitignore`.
- Multiple monitors: the main display is recorded. Ask the user to keep Claude on the main display.
- If Claude Code is closed while recording, the recording keeps running in the background. Next session, `REC status` shows it and `REC stop` ends it.
- `BUILD_REC_FORCE=1` skips the cloud check. Only for testing on a virtual display (Xvfb); never use it to pretend a cloud session can see the user's screen.
