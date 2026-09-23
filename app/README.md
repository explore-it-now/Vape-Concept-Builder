# Concept Builder

React + TypeScript + Vite implementation of `project/Concept Builder v3.dc.html` (the Claude Design prototype).

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run lint
```

## Layout

- `src/data.ts` — devices, finishes, packaging, placement/method options, spec rows and reference code.
- `src/scene/` — three.js code, lazy-loaded so the page paints before WebGL starts.
  - `smoke.ts` — full-page shader smoke that follows the pointer and fades to the finish colours.
  - `stage.ts` — the 3D device + packaging box, materials per finish, brand marking (engraved / printed / embossed, front / back / both), box artwork, drag-to-spin.
  - `useScene.ts` — mounts both onto their canvases and pushes state changes through.
- `src/components/` — nav/hero/process/contact/footer, options panel, preview overlay, spec bar (copy + PDF), submit modal.
- `src/lib/` — clipboard fallback chain and the printable A4 spec sheet.

## Placeholders to replace before launch

- `SALES_EMAIL` in `src/data.ts` (`sales@example.com`).
- The submit form is demo-only: nothing is sent or stored. Wire `SubmitModal`'s `submit` to your CRM or email service.
- Device geometry is built from primitives; swap in real product models (glTF) when available.
