/* rixochixo.com home v3.1: FILE 001, Mateo as a live point-cloud + depth mesh. Composed, not loud.
   Data: me.bin (N x u16 x,y,z + u8 lum + u8 edge) and wire.bin (u16 gw, gh, W, H, step; then gw*gh u16 z; 0 = empty),
   both made by site/home-v3/scan.py from one photo (Depth Anything V2 small, run locally).
   Move = he follows a little. Drag = rotate. Modes: POINTS / MESH / DEPTH. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const BASE = new URL('.', import.meta.url).href;
const SLELO = new THREE.Color('#c8f230');
const SILVER = new THREE.Color('#ACB2C0');

const el = document.getElementById('rx-hero-art');
if (el) boot(el).catch(err => { console.warn('[rx scan]', err); el.classList.add('rx-scan-fail'); });

async function boot(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700;
  el.innerHTML = '';
  el.classList.add('rx-scan');
  const stage = document.createElement('div'); stage.className = 'rx-scan-stage'; el.appendChild(stage);
  const hud = document.createElement('div'); hud.className = 'rx-scan-hud';
  hud.innerHTML =
    '<span class="rx-c tl"></span><span class="rx-c tr"></span><span class="rx-c bl"></span><span class="rx-c br"></span>' +
    '<div class="rx-hud-row top"><span>File 001 · Mateo Rico</span><span class="rx-pts"></span></div>' +
    '<div class="rx-hud-row bot"><span class="rx-coord">34.0577° N · 117.8215° W</span>' +
    '<span class="rx-modes" role="group" aria-label="Scan view">' +
    '<button type="button" data-m="0" aria-pressed="true">Points</button><button type="button" data-m="1" aria-pressed="false">Mesh</button><button type="button" data-m="2" aria-pressed="false">Depth</button></span></div>' +
    '<div class="rx-hint">drag to rotate</div>';
  el.appendChild(hud);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'A live 3D scan of Mateo Rico in a shirt and tie, drawn as a cloud of points. Drag to rotate it.');

  const [meBuf, wireBuf] = await Promise.all([
    fetch(BASE + 'me.bin').then(r => { if (!r.ok) throw new Error('me.bin ' + r.status); return r.arrayBuffer(); }),
    fetch(BASE + 'wire.bin').then(r => { if (!r.ok) throw new Error('wire.bin ' + r.status); return r.arrayBuffer(); })
  ]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);
  const rig = new THREE.Group(); scene.add(rig);

  // source frame size from the wire header; fit the subject inside the frame
  const wv = new DataView(wireBuf);
  const gw = wv.getUint16(0, true), gh = wv.getUint16(2, true), SW = wv.getUint16(4, true), SH = wv.getUint16(6, true), GS = wv.getUint16(8, true);
  const dv = new DataView(meBuf), stride = 8, all = (meBuf.byteLength / stride) | 0;
  let bx0 = 1, bx1 = 0, by0 = 1, by1 = 0;
  for (let i = 0; i < all; i++) { const x = dv.getUint16(i * stride, true) / 65535, y = dv.getUint16(i * stride + 2, true) / 65535; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const ASP = SW / SH, SC = Math.min(2.0 / (by1 - by0), 1.7 / ((bx1 - bx0) * ASP)), DZ = 0.55;
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const toX = x => (x - cx) * ASP * SC, toY = y => -(y - cy) * SC, toZ = z => (z - 0.55) * DZ;
  const top = toY(by0), bottom = toY(by1);

  // ---------- points ----------
  const keep = small ? 2 : 1, n = Math.floor(all / keep);
  const pos = new Float32Array(n * 3), lum = new Float32Array(n), edge = new Float32Array(n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * keep * stride;
    pos[i * 3] = toX(dv.getUint16(o, true) / 65535); pos[i * 3 + 1] = toY(dv.getUint16(o + 2, true) / 65535); pos[i * 3 + 2] = toZ(dv.getUint16(o + 4, true) / 65535);
    lum[i] = dv.getUint8(o + 6) / 255; edge[i] = dv.getUint8(o + 7) / 255; seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const U = {
    uTime: { value: 0 }, uBuild: { value: reduce ? 1.2 : 0 }, uTop: { value: top }, uSpan: { value: top - bottom },
    uMouse: { value: new THREE.Vector2(9, 9) }, uScan: { value: -9 }, uMode: { value: 0 },
    uPR: { value: renderer.getPixelRatio() }, uSize: { value: small ? 11.0 : 8.5 },
    uLime: { value: SLELO }, uSilver: { value: SILVER }, uSplat: { value: 1 }, uWire: { value: 0.1 }
  };

  // build: a clean top-to-bottom print, the way a scanner lays it down
  const COMMON = /* glsl */`
    uniform float uTime, uBuild, uTop, uSpan, uScan, uMode;
    uniform vec2 uMouse;
    attribute float aSeed;
    vec3 place(vec3 p, float seed, out float band, out float vis){
      float yn = (uTop - p.y) / uSpan;                 // 0 at the top of the head, 1 at the bottom
      float k = smoothstep(yn - 0.02, yn + 0.12, uBuild * 1.15 - seed * 0.05);
      vis = k * (1.0 - smoothstep(0.8, 1.0, yn));   // fade out at the bottom edge
      vec3 q = p + vec3(0.0, 0.0, (1.0 - k) * -0.25);
      q += vec3(sin(uTime*0.6+seed*40.0), cos(uTime*0.5+seed*31.0), 0.0) * 0.0015;
      band = exp(-pow((q.y - uScan) * 40.0, 2.0));
      vec4 c = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
      vec2 d = c.xy / c.w - uMouse; float r = length(d);
      float f = smoothstep(0.16, 0.0, r);
      q.xy += normalize(d + 1e-5) * f * 0.045;
      q.z  += f * 0.06;
      return q;
    }`;

  const pmat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: true, blending: THREE.NormalBlending,
    vertexShader: COMMON + /* glsl */`
      uniform float uPR, uSize;
      attribute float aLum, aEdge;
      varying float vLum, vBand, vZ, vEdge, vVis;
      void main(){
        float band, vis; vec3 q = place(position, aSeed, band, vis);
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        gl_Position = projectionMatrix * mv;
        vLum = aLum; vBand = band; vZ = position.z; vEdge = aEdge; vVis = vis;
        gl_PointSize = uSize * uPR * (0.6 + aLum*0.8) / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uMode, uSplat; uniform vec3 uLime, uSilver;
      varying float vLum, vBand, vZ, vEdge, vVis;
      void main(){
        if (vVis < 0.02) discard;
        vec2 c = gl_PointCoord - 0.5; float r2 = dot(c,c);
        float a = exp(-r2*10.0);
        if (a < 0.35) discard;
        vec3 col = vec3(0.05 + vLum*0.98 + vEdge*0.04);
        if (uMode > 1.5) { float z = clamp(vZ/0.55 + 0.55, 0.0, 1.0); col = mix(vec3(0.1), uSilver*1.5, z); }
        col = mix(col, mix(uSilver*1.3, uLime, 0.35), vBand*0.6);
        gl_FragColor = vec4(col, min(1.0, a * 1.15) * uSplat * vVis);
      }`
  });
  rig.add(new THREE.Points(g, pmat));

  // ---------- depth mesh ----------
  const Z = (i, j) => wv.getUint16(10 + (j * gw + i) * 2, true);
  const segs = [], sd = [];
  const vtx = (i, j) => [toX(Math.min(SW - 1, i * GS) / (SW - 1)), toY(Math.min(SH - 1, j * GS) / (SH - 1)), toZ(Z(i, j) / 65535)];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    if (!Z(i, j)) continue;
    const s = Math.random();
    if (i + 1 < gw && Z(i + 1, j)) { segs.push(...vtx(i, j), ...vtx(i + 1, j)); sd.push(s, s); }
    if (j + 1 < gh && Z(i, j + 1)) { segs.push(...vtx(i, j), ...vtx(i, j + 1)); sd.push(s, s); }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
  lg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(sd), 1));
  const lmat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: COMMON + /* glsl */`
      varying float vBand, vZ, vVis;
      void main(){ float band, vis; vec3 q = place(position, aSeed, band, vis); vBand = band; vZ = position.z; vVis = vis;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uWire; uniform vec3 uLime, uSilver; varying float vBand, vZ, vVis;
      void main(){ float z = clamp(vZ/0.55 + 0.55, 0.0, 1.0);
        vec3 col = mix(uSilver*(0.35+0.65*z), uSilver*1.3, vBand);
        gl_FragColor = vec4(col, (uWire*(0.5+0.5*z) + vBand*0.3) * vVis); }`
  });
  rig.add(new THREE.LineSegments(lg, lmat));

  hud.querySelector('.rx-pts').textContent = n.toLocaleString('en-US') + ' pts';

  // ---------- modes ----------
  const MODES = [{ splat: 1, wire: 0.1 }, { splat: 0.25, wire: 0.85 }, { splat: 1, wire: 0.04 }];
  const target = Object.assign({}, MODES[0]);
  let sweep = 0;
  hud.querySelectorAll('.rx-modes button').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const m = +b.dataset.m; U.uMode.value = m; Object.assign(target, MODES[m]);
    hud.querySelectorAll('.rx-modes button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  }));

  // ---------- input ----------
  let mx = 0, my = 0, rx = 0, ry = 0, drag = null, orbitX = 0, orbitY = 0;
  const ndc = new THREE.Vector2(9, 9);
  addEventListener('pointermove', e => {
    mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1;
    const r = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -((e.clientY - r.top) / r.height) * 2 + 1;
    const inside = Math.abs(x) < 1 && Math.abs(y) < 1; ndc.set(inside ? x : 9, inside ? y : 9);
    if (drag) { orbitY = drag.oy + (e.clientX - drag.x) * 0.006; orbitX = Math.max(-0.35, Math.min(0.35, drag.ox + (e.clientY - drag.y) * 0.003)); }
  }, { passive: true });
  stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox: orbitX, oy: orbitY }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('pointerleave', () => { ndc.set(9, 9); });

  // ---------- size / visibility ----------
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = w / h < 0.75 ? 4.9 : 4.2;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage); size();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stage);

  // ---------- loop ----------
  const t0 = performance.now(); let last = t0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    U.uTime.value = t;
    if (!reduce) U.uBuild.value = Math.min(1.2, U.uBuild.value + dt / 3.2);
    // one quiet pass of the scan line every 12 s, after the build
    sweep += dt; const sy = (sweep - 4) % 12;
    U.uScan.value = (reduce || sweep < 4 || sy > 2.4) ? -9 : top + 0.05 - (sy / 2.4) * (top - bottom + 0.1);
    U.uMouse.value.lerp(ndc, 0.15);
    U.uSplat.value += (target.splat - U.uSplat.value) * 0.06;
    U.uWire.value += (target.wire - U.uWire.value) * 0.06;
    if (!drag) { orbitX *= 0.95; orbitY *= 0.95; }
    const idle = reduce ? 0 : Math.sin(t * 0.25) * 0.05;
    rx += ((my * 0.06) + orbitX - rx) * 0.05;
    ry += ((mx * 0.2) + idle + orbitY - ry) * 0.05;
    rig.rotation.set(rx, ry, 0);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  el.classList.add('rx-scan-ready');
}
