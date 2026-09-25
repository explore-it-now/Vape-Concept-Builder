#!/usr/bin/env node
// Renders a title card PNG:  node card.mjs out.png WIDTH HEIGHT "Title" ["Subtitle"]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import path from 'path';

const require = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '@playwright/test']) { try { pw = require(p); break; } catch {} }
if (!pw) pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const [out, w, h, title, sub = ''] = process.argv.slice(2);
const W = +w, H = +h;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<body style="margin:0;width:${W}px;height:${H}px;display:grid;place-items:center;text-align:center;
  background:radial-gradient(ellipse 70% 60% at 50% 55%,#231612,#0b0b0e 70%);color:#f2efe9;font-family:-apple-system,'Segoe UI',system-ui,sans-serif">
  <div style="padding:0 8%"><div style="font-weight:800;font-size:${Math.round(H * 0.08)}px;letter-spacing:-0.02em;line-height:1.05">${esc(title)}</div>
  ${sub ? `<div style="margin-top:${Math.round(H * 0.03)}px;font-size:${Math.round(H * 0.03)}px;color:#ff7a45;font-weight:600">${esc(sub)}</div>` : ''}</div></body>`);
await page.screenshot({ path: out });
await browser.close();
