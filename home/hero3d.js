/* rixochixo.com home v3 (2027): SCAN_01, Mateo as a live point-cloud splat + depth mesh.
   Data: me.bin (N x u16 x,y,z + u8 lum + u8 edge) and wire.bin (u16 gw, gh, then gw*gh u16 z; 0 = empty),
   both made by site/home-v3/build/scan.py from one frame (Depth Anything V2 small, local).
   Move = look around. Drag = orbit. Click = break apart. Modes: SPLAT / MESH / DEPTH. */
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
    '<div class="rx-hud-row top"><span><i class="rx-pip"></i>SCAN_01 · M.RICO</span><span class="rx-pts">LOADING</span></div>' +
    '<div class="rx-hud-row bot"><span class="rx-coord">34.0577° N · 117.8215° W</span>' +
    '<span class="rx-modes" role="group" aria-label="Scan view">' +
    '<button type="button" data-m="0" aria-pressed="true">SPLAT</button><button type="button" data-m="1" aria-pressed="false">MESH</button><button type="button" data-m="2" aria-pressed="false">DEPTH</button></span></div>' +
    '<div class="rx-hint">drag to orbit · click to break</div>';
  el.appendChild(hud);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'A live 3D scan of Mateo Rico rendered as a cloud of points and a depth mesh. Move to look around, drag to orbit, click to break it apart.');

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
  camera.position.set(0, 0, 4.1);
  const rig = new THREE.Group(); scene.add(rig);

  // fit the subject's bounding box to the frame (subject height 1.8 world units)
  const dv = new DataView(meBuf), stride = 8, all = (meBuf.byteLength / stride) | 0;
  let bx0 = 1, bx1 = 0, by0 = 1, by1 = 0;
  for (let i = 0; i < all; i++) { const x = dv.getUint16(i * stride, true) / 65535, y = dv.getUint16(i * stride + 2, true) / 65535; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const ASP = 518 / 924, SC = 1.8 / (by1 - by0), DZ = 0.6, cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const toX = x => (x - cx) * ASP * SC, toY = y => -(y - cy) * SC, toZ = z => (z - 0.55) * DZ;

  // ---------- points ----------
  const keep = small ? 2 : 1, n = Math.floor(all / keep);
  const pos = new Float32Array(n * 3), scat = new Float32Array(n * 3), lum = new Float32Array(n), edge = new Float32Array(n), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * keep * stride;
    const x = dv.getUint16(o, true) / 65535, y = dv.getUint16(o + 2, true) / 65535, z = dv.getUint16(o + 4, true) / 65535;
    pos[i * 3] = toX(x); pos[i * 3 + 1] = toY(y); pos[i * 3 + 2] = toZ(z);
    lum[i] = dv.getUint8(o + 6) / 255; edge[i] = dv.getUint8(o + 7) / 255; seed[i] = Math.random();
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 2.5, s = Math.sqrt(1 - u * u);
    scat[i * 3] = r * s * Math.cos(t); scat[i * 3 + 1] = r * u; scat[i * 3 + 2] = r * s * Math.sin(t) - 1.0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aScat', new THREE.BufferAttribute(scat, 3));
  g.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const U = {
    uTime: { value: 0 }, uBuild: { value: reduce ? 1 : 0 }, uBreak: { value: 0 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uScan: { value: -9 }, uMode: { value: 0 },
    uPR: { value: renderer.getPixelRatio() }, uSize: { value: small ? 12.0 : 9.5 },
    uLime: { value: SLELO }, uSilver: { value: SILVER }, uSplat: { value: 1 }, uWire: { value: 0.16 }
  };

  const COMMON = /* glsl */`
    uniform float uTime, uBuild, uBreak, uScan, uMode;
    uniform vec2 uMouse;
    attribute vec3 aScat; attribute float aSeed;
    float hash(float n){ return fract(sin(n)*43758.5453); }
    vec3 place(vec3 p, float seed, out float band){
      float k = clamp((uBuild - seed*0.45) / 0.55, 0.0, 1.0);
      k = k*k*(3.0-2.0*k);
      vec3 q = mix(aScat, p, k);
      q += vec3(sin(uTime*0.9+seed*40.0), cos(uTime*0.7+seed*31.0), sin(uTime*0.5+seed*17.0)) * 0.004;
      // break apart (click)
      vec3 dir = normalize(p + vec3(hash(seed*91.0)-0.5, hash(seed*37.0)-0.5, hash(seed*53.0)) );
      q += dir * uBreak * (0.6 + seed*1.6);
      // scan band (world y)
      band = exp(-pow((q.y - uScan) * 22.0, 2.0));
      q.x += band * (hash(floor(uTime*24.0)+seed*13.0) - 0.5) * 0.05;
      // cursor: push points away in screen space
      vec4 c = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
      vec2 nd = c.xy / c.w;
      vec2 d = nd - uMouse; float r = length(d);
      float f = smoothstep(0.22, 0.0, r);
      q.xy += normalize(d + 1e-5) * f * 0.16;
      q.z  += f * 0.22;
      return q;
    }`;

  const pmat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: true, blending: THREE.NormalBlending,
    vertexShader: COMMON + /* glsl */`
      uniform float uPR, uSize;
      attribute float aLum, aEdge;
      varying float vLum, vBand, vZ, vEdge;
      void main(){
        float band; vec3 q = place(position, aSeed, band);
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        gl_Position = projectionMatrix * mv;
        vLum = aLum; vBand = band; vZ = position.z; vEdge = aEdge;
        gl_PointSize = uSize * uPR * (0.55 + aLum*0.9) * (1.0 + band*1.2) / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uMode, uSplat; uniform vec3 uLime, uSilver;
      varying float vLum, vBand, vZ, vEdge;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r2 = dot(c,c);
        if (r2 > 0.25) discard;
        float a = exp(-r2*10.0);
        if (a < 0.35) discard;
        float l = 0.06 + vLum*1.0 + vEdge*0.05;
        vec3 col = vec3(l);
        if (uMode > 1.5) { float z = clamp(vZ/0.6 + 0.55, 0.0, 1.0); col = mix(vec3(0.1), uSilver*1.5, z); }
        col = mix(col, uLime, vBand*0.9);
        gl_FragColor = vec4(col, min(1.0, a * 1.15) * uSplat);
      }`
  });
  rig.add(new THREE.Points(g, pmat));

  // ---------- depth mesh (wire) ----------
  const wv = new DataView(wireBuf), gw = wv.getUint16(0, true), gh = wv.getUint16(2, true);
  const Z = (i, j) => wv.getUint16(4 + (j * gw + i) * 2, true);
  const segs = [], sd = [];
  const vtx = (i, j) => [toX(i * 7 / 517), toY(j * 7 / 923), toZ(Z(i, j) / 65535)];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    if (!Z(i, j)) continue;
    const s = Math.random();
    if (i + 1 < gw && Z(i + 1, j)) { segs.push(...vtx(i, j), ...vtx(i + 1, j)); sd.push(s, s); }
    if (j + 1 < gh && Z(i, j + 1)) { segs.push(...vtx(i, j), ...vtx(i, j + 1)); sd.push(s, s); }
  }
  const lg = new THREE.BufferGeometry();
  const lp = new Float32Array(segs);
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const ls = new Float32Array(lp.length);
  for (let i = 0; i < lp.length; i += 3) { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, r = 3 + Math.random() * 2; ls[i] = r * Math.cos(t); ls[i + 1] = r * u; ls[i + 2] = r * Math.sin(t) - 1; }
  lg.setAttribute('aScat', new THREE.BufferAttribute(ls, 3));
  lg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(sd), 1));
  const lmat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: COMMON + /* glsl */`
      varying float vBand, vZ;
      void main(){ float band; vec3 q = place(position, aSeed, band); vBand = band; vZ = position.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uWire; uniform vec3 uLime, uSilver; varying float vBand, vZ;
      void main(){ float z = clamp(vZ/0.6 + 0.55, 0.0, 1.0);
        vec3 col = mix(uSilver*(0.35+0.65*z), uLime, vBand);
        gl_FragColor = vec4(col, uWire*(0.5+0.5*z) + vBand*0.55); }`
  });
  rig.add(new THREE.LineSegments(lg, lmat));

  hud.querySelector('.rx-pts').textContent = (n).toLocaleString('en-US') + ' PTS';

  // ---------- modes ----------
  const target = { splat: 1, wire: 0.16 };
  const MODES = [{ splat: 1, wire: 0.16 }, { splat: 0.3, wire: 0.95 }, { splat: 1, wire: 0.05 }];
  hud.querySelectorAll('.rx-modes button').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const m = +b.dataset.m; U.uMode.value = m; Object.assign(target, MODES[m]);
    hud.querySelectorAll('.rx-modes button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    sweep = 0;
  }));

  // ---------- input ----------
  let mx = 0, my = 0, rx = 0, ry = 0, drag = null, orbitX = 0, orbitY = 0, breakV = 0, sweep = 0, inside = false;
  const ndc = new THREE.Vector2(9, 9);
  function local(e) { const r = renderer.domElement.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; }
  addEventListener('pointermove', e => {
    mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1;
    const [x, y] = local(e);
    inside = Math.abs(x) < 1.2 && Math.abs(y) < 1.2; ndc.set(inside ? x : 9, inside ? y : 9);
    if (drag) { orbitY = drag.oy + (e.clientX - drag.x) * 0.008; orbitX = drag.ox + (e.clientY - drag.y) * 0.005; }
  }, { passive: true });
  stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox: orbitX, oy: orbitY, t: performance.now() }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointerup', e => {
    if (drag && performance.now() - drag.t < 220 && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) breakV = 1;
    drag = null;
  });
  stage.addEventListener('pointerleave', () => { ndc.set(9, 9); });

  // ---------- size / visibility ----------
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = w / h < 0.7 ? 4.6 : 4.1;
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
    if (!reduce) U.uBuild.value = Math.min(1, U.uBuild.value + dt / 2.6);
    // scan sweep: once on build, then every 7 s
    sweep += dt; const period = 7, sy = sweep % period;
    U.uScan.value = reduce ? -9 : (sy < 1.6 ? 1.35 - (sy / 1.6) * 2.9 : -9);
    breakV = Math.max(0, breakV - dt * 0.9);
    U.uBreak.value = reduce ? 0 : Math.sin(Math.min(1, breakV) * Math.PI) * 0.9 * breakV;
    U.uMouse.value.lerp(ndc, 0.25);
    U.uSplat.value += (target.splat - U.uSplat.value) * 0.08;
    U.uWire.value += (target.wire - U.uWire.value) * 0.08;
    if (!drag) { orbitX *= 0.94; orbitY *= 0.94; }
    const idle = reduce ? 0 : Math.sin(t * 0.35) * 0.12;
    rx += ((my * 0.12) + orbitX - rx) * 0.06;
    ry += ((mx * 0.32) + idle + orbitY - ry) * 0.06;
    rig.rotation.set(rx, ry, 0);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  el.classList.add('rx-scan-ready');
}
