# demo-steps.json format

```json
{
  "url": "http://localhost:5173",
  "viewport": { "width": 1440, "height": 900 },
  "mode": "realtime",
  "readySelector": "canvas",
  "hideSelector": ".loading",
  "stickyTop": 90,
  "captions": false,
  "startHold": 1200,
  "endHold": 1500,
  "steps": [
    { "label": "Pick the device", "click": "role=radio[name=/510 cart/]" },
    { "label": "Choose a finish", "click": "role=radio[name=\"Rose gold\"]", "wait": 1500 },
    { "label": "Type the brand name", "type": "#cb-brand", "text": "AURORA", "delay": 120 },
    { "label": "Spin the model", "drag": ".preview__canvas", "dx": 300, "back": 160 },
    { "label": "Upload artwork", "upload": "#cb-art", "file": "art.png" },
    { "scroll": ".spec", "offset": 200 },
    { "label": "Submit the concept", "click": "text=Submit concept" },
    { "type": "role=textbox[name=\"Your name\"]", "text": "Jordan Lee" },
    { "key": "Enter", "wait": 2500 },
    { "scrollTop": true }
  ]
}
```

## Top-level options

| Key | Meaning |
|---|---|
| `url` | Page to open (deployed URL or local dev server). |
| `viewport` | Desktop size. Ignored when `device` is set. |
| `device` | Playwright device name for a phone demo, e.g. `"iPhone 13"`, `"Pixel 7"` (taps instead of clicks). |
| `mode` | `"realtime"` (default) or `"frames"`: captures frame by frame on a virtual clock. Smooth even for heavy 3D on slow machines. Use it for WebGL/three.js pages. |
| `readySelector` / `hideSelector` | Wait for an element to appear / a loader to disappear before starting. |
| `stickyTop` | Height of a sticky header, so scrolling keeps clicked elements visible below it. |
| `captions` | `true` burns each `label` into the video as a caption. Keep `false` when a voiceover is planned. |
| `launchArgs` | Extra Chromium args, e.g. `["--use-gl=angle"]`. |

## Step actions

Each step can have a `label` (goes in the shot list) and a `wait` in ms after it (default 900). One action per step:

| Action | Example | What it does |
|---|---|---|
| `click` | `"click": "text=Save"` | Moves the cursor there smoothly and clicks (tap on phones). |
| `type` | `"type": "#email", "text": "a@b.com", "delay": 70` | Clicks the field, clears it, types letter by letter. `"clear": false` to append. |
| `key` | `"key": "Enter"` | Presses a key. |
| `hover` | `"hover": ".card"` | Moves the cursor onto an element. |
| `scroll` | `"scroll": 600` or `"scroll": "#pricing"` | Smooth scroll by pixels or to an element (`offset` = space above it). |
| `scrollTop` | `"scrollTop": true` | Smooth scroll back to the top. |
| `drag` | `"drag": "canvas", "dx": 300, "back": 150` | Drags right then back (good for rotating 3D, sliders). |
| `upload` | `"upload": "input[type=file]", "file": "logo.png"` | Sets a file input (path relative to the steps file). |
| `goto` | `"goto": "/dashboard"` | Navigates (relative to `url`). |
| `moveTo` | `"moveTo": [720, 450]` | Moves the cursor to a point. |

Selectors are Playwright selectors: CSS (`#id`, `.class`), `text=...`, or `role=button[name="Send"]`. Prefer roles and visible text from the app you built.
