# Vape Concept Builder

Interactive 3D configurator for custom-branded vape hardware: pick a device, finish, brand marking and packaging, see it live in 3D, then submit the concept.

**Live demo:** https://explore-it-now.github.io/Vape-Concept-Builder/

- `app/` is the website (React, TypeScript, Vite, three.js). Run it locally with `cd app && npm install && npm run dev`.
- `project/` and `chats/` hold the original Claude Design prototype, its handoff notes and the design conversation.
- Every push to `main` rebuilds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).

This is a demo. Nothing submitted through the form is sent or stored, and the device shapes are illustrative.
