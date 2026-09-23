import { Color } from 'three';
import { reducedMotion } from './motion';

export interface Smoke {
  setColors(a: string, b: string): void;
  dispose(): void;
}

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FRAG = `precision highp float;
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

type RGB = [number, number, number];

const toRGB = (hex: string): RGB => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

/** Full-page animated smoke, rendered at half resolution with a single fragment shader. */
export function createSmoke(canvas: HTMLCanvasElement): Smoke {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return { setColors() {}, dispose() {} };

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (k: string) => gl.getUniformLocation(prog, k);
  const uR = U('r'), uT = U('t'), uC1 = U('c1'), uC2 = U('c2'), uM = U('m');

  let cur1: RGB = [0.8, 0.3, 0.2], cur2: RGB = [0.3, 0.2, 0.9];
  let tgt1 = cur1, tgt2 = cur2;
  const mouse = [0.5, 0.5], mTgt = [0.5, 0.5];
  const onMove = (e: PointerEvent) => {
    mTgt[0] = e.clientX / innerWidth;
    mTgt[1] = e.clientY / innerHeight;
  };
  addEventListener('pointermove', onMove, { passive: true });

  const scale = 0.5;
  const resize = () => {
    const w = Math.max(1, Math.floor(innerWidth * scale));
    const h = Math.max(1, Math.floor(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  addEventListener('resize', resize);
  resize();

  let raf = 0, last = performance.now(), t = 12;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reducedMotion.matches) t += dt;
    const k = 1 - Math.pow(0.02, dt);
    cur1 = cur1.map((v, i) => v + (tgt1[i] - v) * k) as RGB;
    cur2 = cur2.map((v, i) => v + (tgt2[i] - v) * k) as RGB;
    mouse[0] += (mTgt[0] - mouse[0]) * k * 0.5;
    mouse[1] += (mTgt[1] - mouse[1]) * k * 0.5;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform3fv(uC1, cur1);
    gl.uniform3fv(uC2, cur2);
    gl.uniform2f(uM, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    setColors(a, b) {
      tgt1 = toRGB(a);
      tgt2 = toRGB(b);
    },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('resize', resize);
    },
  };
}
