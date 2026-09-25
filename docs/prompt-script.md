# Prompt script: Vape Concept Builder (for the live recording)

Paste these one at a time, in order, during the recording. Each one builds on the previous result.
Wait for Claude to finish, check the result briefly on screen, then move to the next.

---

## Part 1: Claude Design

### 1. The brief

```
Design a premium, interactive product configurator for a custom vape hardware brand.
Buyers are cannabis brands ordering branded hardware in bulk.

Core experience
- Live 3D preview of the device that the user can drag to rotate, with a slow idle spin.
- Three device types: all-in-one, 510 cartridge, rechargeable battery.
- Five finishes: matte black, brushed steel, rose gold, deep olive, ceramic white,
  each with a realistic material (brushed metal, gloss ceramic, soft-touch matte).
- Brand name field (max 14 characters) that is engraved on the device in real time.
- Packaging options (kraft sleeve, matte black box, window box) shown as a 3D box next to the device.

Look and feel
- Dark, high-end, modern marketing site. No generic "AI" look.
- Animated smoke background whose colours shift with the selected finish.
- Accent colour, glows and highlights follow the finish.
- Clear typographic hierarchy: bold display headings, clean body text, mono labels.

Page structure
- Top bar, builder (options panel + 3D stage + spec summary), a 3-step process section,
  a closing call to action and a footer with a demo disclaimer.
```

### 2. Brand-package features

```
Extend the configurator into a full brand-package tool:
- Logo placement: front, back, or front and back.
- Application method: engraved, printed or embossed, each visibly different in the 3D preview.
- Box artwork upload (PNG/JPG/WebP) that wraps the front of the 3D box, with replace and remove.
- "Spec sheet (PDF)" button that produces an A4 sheet with the render, reference code, date,
  every selected option and the disclaimer.
Keep the spec summary and copied text in sync with every new option.
```

### 3. Conversion and polish

```
Make the page convert and feel human-made:
- Add a primary "Submit concept" action (top bar, end of the options panel, closing section)
  that opens a form: name, company, work email, estimated quantity, notes. Validate name and
  email, then show a confirmation with the concept's reference code.
- Typography: expressive display face for headings, an elegant italic for highlighted phrases
  that takes the finish colour, and a clean text face for body copy.
- Add a few hand-drawn touches (a "made for <brand>" sticker, a short handwritten note on the
  3D stage) so it feels designed by a person, not generated.
- Rewrite all copy in plain, confident language. Every line of text must be fully readable
  on the dark background.
```

### 4. Export

Click **Export → Claude Code** (hand off the design). Pause the cursor on the button for a moment before clicking so the zoom lands on it.

---

## Part 2: Claude Code

### 5. Build it for real

```
Implement the exported Claude Design prototype as a production website.

Stack: Vite + React + TypeScript, with three.js installed from npm (no CDN scripts).
Structure it as components: options panel, 3D stage, smoke background, spec summary,
submit form, spec sheet.

Requirements
- Match the prototype visually: layout, colours, typography, spacing, hover states.
- The 3D scene and smoke load lazily so the page paints immediately.
- Accessible: radio groups with arrow-key support, visible focus, labelled form fields,
  focus kept inside the submit dialog.
- Respect prefers-reduced-motion.

Done when: npm run build and lint pass, and you have checked the page in a headless
browser (every option, the form, the spec sheet) with no console errors.
```

### 6. Photoreal devices

```
Make the 3D devices look like real hardware.
- All-in-one: flat-fronted rounded pod with a tapered mouthpiece, airflow slot, LED and USB-C port.
- 510 cartridge: threaded base, thick glass tank with oil, meniscus and air bubbles, centre post.
- Battery: rounded tube, 510 connector with gold contact pin, chrome fire button, USB-C port.
- Materials: brushed-metal streaks on steel and rose gold, soft-touch grain on matte finishes.
- Lighting: studio strip lights for crisp metal highlights, and real cast shadows.
Render each device in each finish and show me before and after.
```

### 7. Mobile first

```
Optimise the site for iPhone and Android.
- On phones, the 3D preview sits under the headline and stays pinned while the options scroll.
- Compact one-line top bar; the submit form opens as a bottom sheet.
- 44px minimum tap targets, 16px inputs (no iOS zoom), safe-area insets for the notch and
  home bar, no sticky hover states on touch.
- Lighter rendering on phones so it stays smooth and cool.
Test at iPhone and Pixel sizes and check there is no horizontal scrolling.
```

### 8. Ship it

```
Create a GitHub repository named vape-concept-builder, push to main, and set up
GitHub Actions to build and deploy to GitHub Pages on every push.
Also add Netlify and Vercel config so it can be deployed there with zero setup.
Give me the live URL when it is up.
```

### 9. Demo video

```
Stop recording.
```
(The build-recorder skill then records the end-to-end product demo and edits the final video.)

---

## Recording tips

- **Typing or pasting?** Pasting makes a prompt appear instantly; typing shows it being written.
  For the video, paste, then scroll through the prompt slowly for a second so viewers can read it,
  or type the first line and paste the rest.
- Keep each Claude window full-screen on your main display.
- Pause the cursor on important buttons (Export, Send, Submit) for half a second before clicking.
- Turn on Do Not Disturb.
