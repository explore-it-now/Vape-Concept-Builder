import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export const FINISH_MAT = {
  black: { color: '#1c1c1e', metalness: 0.2, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6, anisotropy: 0, dark: true },
  steel: { color: '#c3c7cb', metalness: 1, roughness: 0.34, clearcoat: 0, clearcoatRoughness: 0, anisotropy: 0.9, dark: false },
  rose: { color: '#e6a28c', metalness: 1, roughness: 0.24, clearcoat: 0, clearcoatRoughness: 0, anisotropy: 0.3, dark: false },
  olive: { color: '#4a5535', metalness: 0.4, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3, anisotropy: 0, dark: true },
  white: { color: '#f1ede5', metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, anisotropy: 0, dark: false }
};

function fontsReady() {
  return document.fonts ? document.fonts.load('800 100px "Archivo"').catch(() => {}) : Promise.resolve();
}

/* ---------------- Smoke background ---------------- */
export function createSmoke(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return { setColors() {}, dispose() {} };
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision highp float;
uniform vec2 r;uniform float t;uniform vec3 c1,c2;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<6;i++){v+=a*n(p);p=R*p*2.03;a*=.5;}return v;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
 p+=(m-.5)*vec2(.18,-.12);
 float T=t*.055;
 vec2 q=vec2(fbm(p*1.5+vec2(0.,T)),fbm(p*1.5+vec2(5.2,-T*.8)));
 vec2 w=vec2(fbm(p*1.3+2.6*q+vec2(1.7,9.2)+T*1.4),fbm(p*1.3+2.6*q+vec2(8.3,2.8)-T));
 float f=fbm(p*1.1+2.9*w+vec2(0.,-T*2.));
 vec3 col=vec3(.03,.03,.038);
 col=mix(col,c2*.6,smoothstep(.3,.95,f)*.85);
 col=mix(col,c1*.9,smoothstep(.5,1.05,f*(.6+w.x)+.2*q.y)*.8);
 col+=c1*pow(f,5.)*.9;
 col+=mix(c1,c2,q.x)*pow(max(0.,1.-length(w-.55)*2.2),3.)*.18;
 float v=smoothstep(1.35,.15,length(p*vec2(.75,1.05)));
 col*=mix(.28,1.,v);
 col+=(h(gl_FragCoord.xy+fract(t)*97.)-.5)*.025;
 gl_FragColor=vec4(col,1.);
}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (k) => gl.getUniformLocation(prog, k);
  const uR = U('r'), uT = U('t'), uC1 = U('c1'), uC2 = U('c2'), uM = U('m');
  const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  let cur1 = [0.8, 0.3, 0.2], cur2 = [0.3, 0.2, 0.9], tgt1 = cur1, tgt2 = cur2;
  const mouse = [0.5, 0.5], mTgt = [0.5, 0.5];
  const onMove = (e) => { mTgt[0] = e.clientX / innerWidth; mTgt[1] = e.clientY / innerHeight; };
  addEventListener('pointermove', onMove, { passive: true });
  const scale = 0.5;
  const resize = () => {
    const w = Math.max(1, Math.floor(innerWidth * scale)), h = Math.max(1, Math.floor(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  addEventListener('resize', resize);
  resize();
  let raf, t0 = performance.now(), last = t0, t = 12;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce.matches) t += dt;
    const k = 1 - Math.pow(0.02, dt);
    cur1 = cur1.map((v, i) => v + (tgt1[i] - v) * k);
    cur2 = cur2.map((v, i) => v + (tgt2[i] - v) * k);
    mouse[0] += (mTgt[0] - mouse[0]) * k * 0.5; mouse[1] += (mTgt[1] - mouse[1]) * k * 0.5;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform3fv(uC1, cur1); gl.uniform3fv(uC2, cur2);
    gl.uniform2f(uM, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    setColors(a, b) { tgt1 = hex(a); tgt2 = hex(b); },
    dispose() { cancelAnimationFrame(raf); removeEventListener('pointermove', onMove); removeEventListener('resize', resize); }
  };
}

/* ---------------- 3D stage ---------------- */
function envMap(renderer, c1, c2) {
  const scene = new THREE.Scene();
  const disposables = [];
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x0c0c0e, side: THREE.BackSide }));
  disposables.push(room.geometry, room.material);
  scene.add(room);
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
    disposables.push(m.geometry, m.material);
  };
  panel(5, 12, '#ffffff', 4, [-8, 2, 5]);
  panel(3, 12, c1, 3.2, [8, 1, 3]);
  panel(12, 3, '#ffffff', 1.8, [0, 9, 1]);
  panel(10, 6, c2, 2.2, [-2, -1, -9]);
  panel(2.5, 9, '#ffffff', 1.6, [4, 0, 9]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  disposables.forEach(d => d.dispose());
  return rt;
}

function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-4, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(5, 2, -4); scene.add(rim);

  const finishMat = new THREE.MeshPhysicalMaterial();
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0x0f0f11, roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.22 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.2, ior: 1.45 });
  const oil = new THREE.MeshPhysicalMaterial({ color: 0xf0a531, roughness: 0.12, transmission: 0.6, thickness: 0.6, ior: 1.47, attenuationColor: new THREE.Color(0xa85a05), attenuationDistance: 0.5 });
  const led = new THREE.MeshBasicMaterial({ color: 0xffffff });
  led.toneMapped = false;

  const eCanvas = document.createElement('canvas'); eCanvas.width = 256; eCanvas.height = 1024;
  const eTex = new THREE.CanvasTexture(eCanvas);
  eTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const engraveMat = new THREE.MeshPhysicalMaterial({ alphaMap: eTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.55, metalness: 0.3 });
  const fronts = [], backs = [];
  const decal = (grp, m) => { fronts.push(m); grp.add(m); const b = m.clone(); b.rotation.y = Math.PI; backs.push(b); grp.add(b); };

  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const ring = (r, y, grp) => grp.add(mesh(new THREE.TorusGeometry(r, 0.012, 8, 48).rotateX(Math.PI / 2), plastic, 0, y, 0));

  // All-in-one
  const aio = new THREE.Group();
  aio.add(mesh(new THREE.CapsuleGeometry(0.62, 2.7, 24, 64).scale(1, 1, 0.5), finishMat, 0, -0.3, 0));
  aio.add(mesh(new THREE.CapsuleGeometry(0.34, 0.5, 16, 48).scale(1, 1, 0.55), plastic, 0, 1.95, 0));
  aio.add(mesh(new THREE.BoxGeometry(0.24, 0.025, 0.02), led, 0, -1.95, 0.305));
  {
    const g = new THREE.PlaneGeometry(0.4, 1.6, 16, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, 0.31 * Math.sqrt(Math.max(0, 1 - (x / 0.62) ** 2)) + 0.002); }
    decal(aio, mesh(g, engraveMat, 0, -0.25, 0));
  }
  // 510 cartridge
  const cart = new THREE.Group();
  cart.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 48), silver, 0, -2.1, 0));
  for (let i = 0; i < 4; i++) cart.add(mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40).rotateX(Math.PI / 2), silver, 0, -2.2 + i * 0.07, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 96), finishMat, 0, -1.2, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 96, 1, true), glass, 0, 0.35, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.05, 64), oil, 0, 0.02, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 24), silver, 0, 0.35, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 96), finishMat, 0, 1.21, 0));
  {
    const pts = [[0, 0], [0.36, 0], [0.36, 0.08], [0.33, 0.35], [0.27, 0.7], [0.2, 0.86], [0.12, 0.9], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
    cart.add(mesh(new THREE.LatheGeometry(pts, 96), finishMat, 0, 1.27, 0));
    const L = 0.325 / 0.425;
    decal(cart, mesh(new THREE.CylinderGeometry(0.4245, 0.4245, 1.3, 48, 1, true, -L / 2, L), engraveMat, 0, -1.2, 0));
  }
  ring(0.421, -0.45, cart);
  // Rechargeable battery
  const batt = new THREE.Group();
  batt.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.6, 96), finishMat, 0, -0.4, 0));
  batt.add(mesh(new THREE.SphereGeometry(0.34, 64, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.18, 1), finishMat, 0, -2.2, 0));
  batt.add(mesh(new THREE.CylinderGeometry(0.33, 0.34, 0.05, 96), silver, 0, 1.425, 0));
  batt.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.24, 48), silver, 0, 1.57, 0));
  for (let i = 0; i < 3; i++) batt.add(mesh(new THREE.TorusGeometry(0.19, 0.01, 8, 40).rotateX(Math.PI / 2), silver, 0, 1.5 + i * 0.06, 0));
  {
    const btn = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 40).rotateX(Math.PI / 2), silver, 0, 0.8, 0.335);
    batt.add(btn);
    batt.add(mesh(new THREE.TorusGeometry(0.135, 0.014, 12, 48), led, 0, 0.8, 0.335));
    const L = 0.45 / 0.345;
    decal(batt, mesh(new THREE.CylinderGeometry(0.3445, 0.3445, 1.8, 48, 1, true, -L / 2, L), engraveMat, 0, -0.7, 0));
  }
  const devices = { aio, cart, batt };
  const deviceRoot = new THREE.Group();
  deviceRoot.position.set(-0.75, 0, 0);
  Object.values(devices).forEach(g => { g.visible = false; deviceRoot.add(g); });
  scene.add(deviceRoot);

  // Packaging
  const pCanvas = document.createElement('canvas'); pCanvas.width = 600; pCanvas.height = 880;
  const pTex = new THREE.CanvasTexture(pCanvas); pTex.colorSpace = THREE.SRGBColorSpace; pTex.anisotropy = eTex.anisotropy;
  const sCanvas = document.createElement('canvas'); sCanvas.width = 256; sCanvas.height = 256;
  const sTex = new THREE.CanvasTexture(sCanvas); sTex.colorSpace = THREE.SRGBColorSpace;
  const boxFront = new THREE.MeshPhysicalMaterial({ map: pTex, roughness: 0.8 });
  const boxSide = new THREE.MeshPhysicalMaterial({ map: sTex, roughness: 0.8 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.8), [boxSide, boxSide, boxSide, boxSide, boxFront, boxSide]);
  box.position.set(1.55, -1.15, -0.9);
  box.rotation.y = -0.42;
  scene.add(box);

  const shadowTex = radialTex();
  const shadow = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, -2.27, z); scene.add(m); return m;
  };
  const devShadow = shadow(2.2, 1.2, -0.75, 0);
  shadow(2.8, 1.8, 1.55, -0.9);

  const state = { device: null, finish: null, engraving: null, pack: null, accent: '#ffffff', smoke: ['#fff', '#fff'], placement: null, method: null, artwork: null, artImg: null };
  const applyPlacement = () => {
    const p = state.placement || 'front';
    fronts.forEach(m => { m.visible = p !== 'back'; });
    backs.forEach(m => { m.visible = p !== 'front'; });
  };
  const applyMethod = () => {
    const f = FINISH_MAT[state.finish]; if (!f) return;
    const m = state.method || 'engraved';
    engraveMat.bumpMap = null; engraveMat.clearcoat = 0;
    if (m === 'engraved') {
      engraveMat.color.set(f.dark ? '#e6e0d4' : '#2a2724'); engraveMat.metalness = f.dark ? 0.1 : 0.5; engraveMat.roughness = 0.62; engraveMat.opacity = 0.9;
    } else if (m === 'printed') {
      engraveMat.color.set(f.dark ? '#f7f5f0' : '#111113'); engraveMat.metalness = 0; engraveMat.roughness = 0.35; engraveMat.opacity = 1; engraveMat.clearcoat = 0.4;
    } else {
      engraveMat.color.set(f.color).offsetHSL(0, 0, f.dark ? 0.06 : -0.04); engraveMat.metalness = f.metalness; engraveMat.roughness = Math.max(0.12, f.roughness * 0.7); engraveMat.opacity = 1; engraveMat.clearcoat = f.clearcoat;
      engraveMat.bumpMap = eTex; engraveMat.bumpScale = 4;
    }
    engraveMat.needsUpdate = true;
  };
  let env = null;

  const drawEngraving = () => {
    const g = eCanvas.getContext('2d');
    const dark = FINISH_MAT[state.finish]?.dark;
    g.clearRect(0, 0, 256, 1024);
    g.save(); g.translate(128, 512); g.rotate(-Math.PI / 2);
    let size = 150;
    const set = () => { g.font = `800 ${size}px "Archivo", sans-serif`; try { g.fontStretch = 'expanded'; g.letterSpacing = `${size * 0.14}px`; } catch (e) {} };
    set();
    const w = g.measureText(state.engraving).width;
    if (w > 860) { size = Math.floor(size * 860 / w); set(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    if (state.method === 'embossed') { g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 6; }
    g.fillText(state.engraving, 0, 0);
    g.restore();
    eTex.needsUpdate = true;
    applyMethod();
  };

  const drawPack = () => {
    const g = pCanvas.getContext('2d'); const W = 600, H = 880;
    const s = sCanvas.getContext('2d');
    const text = state.engraving;
    const speckle = (ctx, w, h, base, n, a) => { ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '60,40,20' : '255,240,220'},${Math.random() * a})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
    const brand = (color, y, max = 440) => {
      let size = 72; const set = () => { g.font = `800 ${size}px "Archivo", sans-serif`; try { g.fontStretch = 'expanded'; g.letterSpacing = `${size * 0.12}px`; } catch (e) {} };
      set(); const w = g.measureText(text).width; if (w > max) { size = Math.floor(size * max / w); set(); }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, W / 2, y);
    };
    const small = (color, y, str) => { g.font = '500 20px "IBM Plex Mono", monospace'; try { g.letterSpacing = '4px'; g.fontStretch = 'normal'; } catch (e) {} g.textAlign = 'center'; g.fillStyle = color; g.fillText(str, W / 2, y); };
    if (state.pack === 'kraft') {
      speckle(g, W, H, '#b68a5c', 9000, 0.35); speckle(s, 256, 256, '#b68a5c', 1400, 0.35);
      g.fillStyle = '#18181a'; g.fillRect(0, 0, W, 230); g.fillRect(0, H - 230, W, 230);
      s.fillStyle = '#18181a'; s.fillRect(0, 0, 256, 67); s.fillRect(0, 189, 256, 67);
      brand('#2e1f12', H / 2 - 10); g.fillStyle = '#2e1f12'; g.fillRect(W / 2 - 40, H / 2 + 50, 80, 3);
      boxFront.roughness = boxSide.roughness = 0.92; boxFront.clearcoat = boxSide.clearcoat = 0;
    } else if (state.pack === 'black') {
      g.fillStyle = '#121214'; g.fillRect(0, 0, W, H); s.fillStyle = '#121214'; s.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(214,183,122,0.55)'; g.lineWidth = 2; g.strokeRect(40, 40, W - 80, H - 80);
      brand('#d8b87c', H / 2); small('rgba(216,184,124,0.7)', H - 90, 'HARDWARE');
      boxFront.roughness = boxSide.roughness = 0.62; boxFront.clearcoat = boxSide.clearcoat = 0.3;
    } else {
      g.fillStyle = '#eeeae3'; g.fillRect(0, 0, W, H); s.fillStyle = '#eeeae3'; s.fillRect(0, 0, 256, 256);
      const x = 110, y = 90, w = W - 220, h = 470, r = 28;
      const grd = g.createLinearGradient(x, y, x + w, y + h); grd.addColorStop(0, '#26262b'); grd.addColorStop(1, '#101013');
      g.fillStyle = grd; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
      g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x + w * 0.3, y + h); g.lineTo(x + w * 0.05, y + h); g.fill(); g.restore();
      g.fillStyle = state.finishHex || '#888'; g.beginPath(); g.roundRect(W / 2 - 34, y + 60, 68, h - 120, 30); g.fill();
      brand('#1c1b1a', 680, 400); small('rgba(28,27,26,0.6)', 760, 'HARDWARE');
      boxFront.roughness = boxSide.roughness = 0.5; boxFront.clearcoat = boxSide.clearcoat = 0.4;
    }
    if (state.artImg) {
      const img = state.artImg, r = Math.max(W / img.width, H / img.height);
      const w = img.width * r, h = img.height * r;
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }
    pTex.needsUpdate = true; sTex.needsUpdate = true;
  };

  let swapT = 1;
  const api = {
    update(next) {
      const s = state;
      if (next.accent && next.accent !== s.accent) { s.accent = next.accent; led.color.set(next.accent); rim.color.set(next.accent); }
      if (next.finish !== s.finish) {
        s.finish = next.finish; s.finishHex = FINISH_MAT[next.finish].color;
        const f = FINISH_MAT[next.finish];
        finishMat.color.set(f.color); finishMat.metalness = f.metalness; finishMat.roughness = f.roughness;
        finishMat.clearcoat = f.clearcoat; finishMat.clearcoatRoughness = f.clearcoatRoughness; finishMat.anisotropy = f.anisotropy;
        finishMat.needsUpdate = true;
        if (env) env.dispose();
        env = envMap(renderer, next.smoke[0], next.smoke[1]);
        scene.environment = env.texture;
        drawEngraving(); drawPack();
      }
      if (next.engraving !== s.engraving) { s.engraving = next.engraving; drawEngraving(); drawPack(); }
      if (next.pack !== s.pack) { s.pack = next.pack; drawPack(); }
      if ((next.placement || 'front') !== s.placement) { s.placement = next.placement || 'front'; applyPlacement(); }
      if ((next.method || 'engraved') !== s.method) { s.method = next.method || 'engraved'; drawEngraving(); }
      if ((next.artwork || null) !== s.artwork) {
        s.artwork = next.artwork || null;
        if (!s.artwork) { s.artImg = null; drawPack(); }
        else { const img = new Image(); const src = s.artwork; img.onload = () => { if (s.artwork === src) { s.artImg = img; drawPack(); } }; img.src = src; }
      }
      if (next.device !== s.device) {
        s.device = next.device;
        Object.entries(devices).forEach(([k, g]) => { g.visible = k === next.device; });
        swapT = reduce.matches ? 1 : 0;
      }
    },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); }
  };
  fontsReady().then(() => { if (state.engraving != null) { drawEngraving(); drawPack(); } });

  // interaction
  let rotY = -0.35, vel = 0, dragging = false, lastX = 0, idleAt = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; rotY += dx * 0.012; vel = dx * 0.012; });
  const end = () => { dragging = false; idleAt = performance.now(); canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.style.cursor = 'grab';

  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(5.4 / 2 / tanV, 5.2 / 2 / (tanV * camera.aspect)) * 1.08;
    camera.position.set(0.3, 0.9, dist);
    camera.lookAt(0.3, 0.05, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit); ro.observe(canvas); fit();
  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }); io.observe(canvas);

  let raf, last = performance.now(), t = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    t += dt;
    if (!dragging) {
      rotY += vel; vel *= Math.pow(0.04, dt);
      if (!reduce.matches && now - idleAt > 2500) rotY += dt * 0.35;
    }
    if (swapT < 1) swapT = Math.min(1, swapT + dt / 0.45);
    const e = 1 - Math.pow(1 - swapT, 3);
    deviceRoot.rotation.y = rotY - (1 - e) * 1.2;
    const sc = 0.88 + 0.12 * e;
    deviceRoot.scale.setScalar(sc);
    const bob = reduce.matches ? 0 : Math.sin(t * 1.1) * 0.05;
    deviceRoot.position.y = bob + (1 - e) * 0.25;
    devShadow.material.opacity = 0.8 - bob * 2;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  return api;
}
