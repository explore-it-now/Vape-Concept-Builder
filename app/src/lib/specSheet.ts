import type { SpecRow } from '../data';

const esc = (t: string) =>
  String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface SheetInput {
  title: string;
  ref: string;
  rows: SpecRow[];
  accent: string;
  image: string;
}

/** Opens the browser print dialog with an A4 spec sheet (choose "Save as PDF" to download). */
export function printSpecSheet({ title, ref, rows, accent, image }: SheetInput) {
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Concept spec sheet ${ref}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans",sans-serif;color:#111113;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.h{font-family:Archivo,sans-serif;font-stretch:125%;font-weight:800}.m{font-family:"IBM Plex Mono",monospace;font-size:10pt;letter-spacing:.1em;text-transform:uppercase;color:#55555c}</style></head>
<body><div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111113;padding-bottom:10px">
<div><div class="m">Concept spec sheet</div><div class="h" style="font-size:26pt;line-height:1.05;margin-top:4px">${esc(title)}</div></div>
<div style="text-align:right"><div class="m">Ref ${ref}</div><div style="font-size:11pt;margin-top:4px">${esc(date)}</div></div></div>
<div style="margin-top:14px;border-radius:14px;overflow:hidden;background:radial-gradient(ellipse at 45% 55%,#2a2a30,#0c0c0f 70%);height:118mm;display:flex;align-items:center;justify-content:center;position:relative">
${image ? `<img src="${image}" style="max-width:100%;max-height:100%;display:block">` : ''}
<div style="position:absolute;left:14px;bottom:12px;width:14px;height:14px;border-radius:99px;background:${accent}"></div></div>
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:12pt">${rows
    .map(
      (r) =>
        `<tr><td class="m" style="padding:9px 0;border-bottom:1px solid #dcdcdf;width:38%">${esc(r.label)}</td><td style="padding:9px 0;border-bottom:1px solid #dcdcdf;font-weight:600">${esc(r.value)}</td></tr>`,
    )
    .join('')}</table>
<p style="margin:16px 0 0;font-size:10pt;color:#55555c;line-height:1.5">This concept is illustrative. Device shapes are not to scale and are not exact models of any manufacturer's hardware. Pricing, minimum order quantities and turnaround times are confirmed by your account manager.</p>
</body></html>`;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    try {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => frame.remove(), 60000);
  };
  const ready = doc.fonts ? doc.fonts.ready : Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1200))]).then(() => setTimeout(go, 150));
}
