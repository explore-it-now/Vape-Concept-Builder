#!/usr/bin/env node
// Records an end-to-end product demo with Playwright from a steps file.
//
//   node demo.mjs demo-steps.json --out build-recording/demo
//
// Writes demo.mp4, demo_clicks.json (for zoom-on-click) and demo_labels.json (for the shot list).
// Steps format: see ../reference/demo-steps.md
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '@playwright/test']) { try { return require(p); } catch {} }
  try { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch {}
  console.error('Playwright not found. Install it with: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}
function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const cmd of ['ffmpeg -version']) { try { execSync(cmd, { stdio: 'ignore' }); return 'ffmpeg'; } catch {} }
  for (const py of ['python3', 'python']) {
    try { return execSync(`${py} -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"`).toString().trim(); } catch {}
  }
  console.error('ffmpeg not found (brew install ffmpeg / winget install Gyan.FFmpeg / pip install imageio-ffmpeg).');
  process.exit(1);
}

const args = process.argv.slice(2);
const specFile = args.find((a) => !a.startsWith('--'));
if (!specFile) { console.error('usage: node demo.mjs demo-steps.json [--out DIR]'); process.exit(1); }
const outDir = path.resolve(args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : 'build-recording/demo');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const specDir = path.dirname(path.resolve(specFile));
const { chromium, devices } = loadPlaywright();

const FPS = 25, DT = 1000 / FPS;
const MODE = spec.mode || 'realtime'; // 'frames' = smooth frame-by-frame capture for heavy 3D/WebGL pages
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Page overlay: a visible cursor with click ripples, and optional captions.
const OVERLAY = (touch, captions) => `(() => {
  const css = \`#__cur{position:fixed;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
    background:rgba(255,255,255,.95);box-shadow:0 0 0 2px rgba(0,0,0,.55),0 4px 14px rgba(0,0,0,.45);z-index:2147483647;
    pointer-events:none;transition:transform .12s;display:${touch ? 'none' : 'block'}}
  #__cur.down{transform:scale(.7)}
  .__rip{position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:2px solid #fff;
    box-shadow:0 0 0 1px rgba(0,0,0,.3);z-index:2147483646;pointer-events:none;animation:__rip .55s ease-out forwards}
  @keyframes __rip{to{transform:scale(3.4);opacity:0}}
  #__cap{position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:88vw;bottom:26px;z-index:2147483645;pointer-events:none;
    padding:12px 22px;border-radius:999px;background:rgba(12,12,15,.9);color:#fff;font:600 ${touch ? 14 : 19}px/1.3 system-ui,sans-serif;
    box-shadow:0 12px 40px rgba(0,0,0,.45);opacity:0;display:${captions ? 'block' : 'none'}}\`;
  const init = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const cur = document.createElement('div'); cur.id = '__cur'; document.body.appendChild(cur);
    const cap = document.createElement('div'); cap.id = '__cap'; document.body.appendChild(cap);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    const rip = (x, y) => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); };
    addEventListener('mousedown', (e) => { cur.classList.add('down'); rip(e.clientX, e.clientY); }, true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
    addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) rip(t.clientX, t.clientY); }, true);
    window.__caption = (t) => { cap.textContent = t || ''; cap.style.opacity = t ? 1 : 0; };
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();
})();`;

// Virtual clock for 'frames' mode: the page only advances when a frame is captured.
const CLOCK = `(() => {
  let vt = 0, id = 0; const raf = new Map(), timers = new Map();
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { raf.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => raf.delete(i);
  const rs = window.setTimeout, rc = window.clearTimeout;
  window.setTimeout = (fn, ms = 0, ...a) => { if (typeof fn !== 'function') return rs(fn, ms); timers.set(++id, { at: vt + (+ms || 0), fn, a }); return id; };
  window.clearTimeout = (i) => { timers.delete(i); rc(i); };
  window.__tick = (dt) => {
    vt += dt;
    for (const [k, t] of [...timers]) if (t.at <= vt) { timers.delete(k); try { t.fn(...t.a); } catch (e) { console.error(e); } }
    const cbs = [...raf.values()]; raf.clear();
    for (const cb of cbs) { try { cb(vt); } catch (e) { console.error(e); } }
  };
})();`;

fs.mkdirSync(outDir, { recursive: true });
const framesDir = path.join(outDir, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
const browser = await chromium.launch(spec.launchArgs ? { args: spec.launchArgs } : {});
const dev = spec.device ? devices[spec.device] : null;
const vp = spec.viewport || { width: 1440, height: 900 };
const ctxOpts = dev ? { ...dev } : { viewport: vp, deviceScaleFactor: spec.deviceScaleFactor || 1 };
if (MODE === 'realtime') ctxOpts.recordVideo = { dir: path.join(outDir, 'raw'), size: dev ? dev.viewport : vp };
const ctx = await browser.newContext(ctxOpts);
if (MODE === 'frames') await ctx.addInitScript(CLOCK);
await ctx.addInitScript(OVERLAY(!!dev?.hasTouch, !!spec.captions));
const page = await ctx.newPage();
const scale = MODE === 'frames' ? (ctxOpts.deviceScaleFactor || 1) : 1;

let frame = 0, clock = 0, mx = 0, my = 0;
const t0 = Date.now();
const now = () => (MODE === 'frames' ? clock / 1000 : (Date.now() - t0) / 1000);
const clicks = [], labels = [];
if (MODE === 'frames') fs.mkdirSync(framesDir, { recursive: true });

async function snap() {
  if (MODE === 'frames') {
    await page.evaluate((dt) => window.__tick(dt), DT);
    clock += DT;
    await page.screenshot({ path: path.join(framesDir, String(frame++).padStart(6, '0') + '.jpg'), type: 'jpeg', quality: 90 });
  } else {
    await page.waitForTimeout(DT);
  }
}
async function hold(ms) { for (let i = 0; i < Math.round(ms / DT); i++) await snap(); }
async function move(x, y, ms = 650) {
  const x0 = mx, y0 = my, n = Math.max(1, Math.round(ms / DT));
  for (let i = 1; i <= n; i++) { const e = ease(i / n); mx = x0 + (x - x0) * e; my = y0 + (y - y0) * e; await page.mouse.move(mx, my); await snap(); }
}
async function scrollBy(dy, ms = 800) {
  const y0 = await page.evaluate(() => scrollY), n = Math.max(1, Math.round(ms / DT));
  for (let i = 1; i <= n; i++) { await page.evaluate((v) => scrollTo(0, v), y0 + dy * ease(i / n)); await snap(); }
}
async function reveal(loc) {
  const b = await loc.boundingBox();
  if (!b) { await loc.scrollIntoViewIfNeeded(); return; }
  const vh = page.viewportSize().height, top = spec.stickyTop || 90;
  if (b.y < top) await scrollBy(b.y - top - 20);
  else if (b.y + b.height > vh - 110) await scrollBy(b.y + b.height - vh + 140);
}
async function center(loc) { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; }
async function press(loc) {
  await reveal(loc);
  const [x, y] = await center(loc);
  if (dev?.hasTouch) { await page.touchscreen.tap(x, y); clicks.push({ t: now(), x: x * scale, y: y * scale }); return; }
  await move(x, y);
  await hold(150);
  clicks.push({ t: now(), x: x * scale, y: y * scale });
  await page.mouse.down(); await snap(); await page.mouse.up();
}
const L = (sel) => page.locator(sel).first();

await page.goto(spec.url, { waitUntil: 'networkidle' });
if (MODE === 'frames') for (let i = 0; i < 40; i++) await page.evaluate((dt) => window.__tick(dt), DT);
if (spec.readySelector) await page.waitForSelector(spec.readySelector, { state: spec.readyState || 'visible' });
if (spec.hideSelector) await page.waitForSelector(spec.hideSelector, { state: 'hidden' }).catch(() => {});
await page.mouse.move(vp.width / 2, vp.height / 2); mx = vp.width / 2; my = vp.height / 2;
await hold(spec.startHold ?? 1200);

for (const s of spec.steps) {
  if (s.label) { labels.push({ t: now(), text: s.label }); if (spec.captions) await page.evaluate((t) => window.__caption(t), s.label); }
  if (s.goto) { await page.goto(new URL(s.goto, spec.url).href, { waitUntil: 'networkidle' }); }
  if (s.click) await press(L(s.click));
  if (s.type) {
    await press(L(s.type));
    if (s.clear !== false) { await L(s.type).fill(''); }
    for (const c of s.text) { await page.keyboard.type(c); await hold(s.delay ?? 70); }
  }
  if (s.key) { await page.keyboard.press(s.key); await snap(); }
  if (s.hover) { await reveal(L(s.hover)); const [x, y] = await center(L(s.hover)); await move(x, y); }
  if (s.scroll !== undefined) {
    if (typeof s.scroll === 'number') await scrollBy(s.scroll, s.ms ?? 900);
    else { const b = await L(s.scroll).boundingBox(); await scrollBy(b.y - (s.offset ?? 100), s.ms ?? 900); }
  }
  if (s.scrollTop) await scrollBy(-(await page.evaluate(() => scrollY)), s.ms ?? 900);
  if (s.drag) {
    await reveal(L(s.drag));
    const [x, y] = await center(L(s.drag));
    await move(x, y); await page.mouse.down();
    await move(x + (s.dx ?? 300), y + (s.dy ?? 0), s.ms ?? 1200);
    await move(x - (s.back ?? 150), y, s.ms ?? 1200);
    await page.mouse.up();
  }
  if (s.upload) {
    await L(s.upload).setInputFiles(path.resolve(specDir, s.file));
    await snap();
  }
  if (s.moveTo) { const [x, y] = s.moveTo; await move(x, y); }
  await hold(s.wait ?? 900);
}
await hold(spec.endHold ?? 1500);

const outMp4 = path.join(outDir, 'demo.mp4');
const ff = ffmpegPath();
if (MODE === 'frames') {
  execSync(`"${ff}" -hide_banner -loglevel error -y -framerate ${FPS} -i "${framesDir}/%06d.jpg" -c:v libx264 -crf 18 -pix_fmt yuv420p "${outMp4}"`);
  fs.rmSync(framesDir, { recursive: true, force: true });
  await ctx.close();
} else {
  const video = page.video();
  await ctx.close();
  execSync(`"${ff}" -hide_banner -loglevel error -y -i "${await video.path()}" -c:v libx264 -crf 18 -pix_fmt yuv420p -r ${FPS} "${outMp4}"`);
  fs.rmSync(path.join(outDir, 'raw'), { recursive: true, force: true });
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'demo_clicks.json'), JSON.stringify(clicks, null, 1));
fs.writeFileSync(path.join(outDir, 'demo_labels.json'), JSON.stringify(labels, null, 1));
console.log(`DEMO → ${outMp4} (${now().toFixed(1)}s, ${clicks.length} clicks)`);
