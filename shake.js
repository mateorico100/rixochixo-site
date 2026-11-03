/* rixochixo shake table v2
   Uniform N-story elastic shear frame. Ta per ASCE 7-22 §12.8.2.1 (Ct·hn^x, Table 12.8-2),
   Newmark average acceleration time history under the CE 5515 ground motions (PEER NGA-West2, scaled),
   and a modal response spectrum (SRSS) check using RSAGOD's 5% spectra. Units: in, s, g = 386.1 in/s². */
(function () {
  var G = 386.1, ZETA = 0.05, DT = 0.005, LIMIT = 0.02;
  var SYSTEMS = [
    { name: 'Concrete moment frame', Ct: 0.016, x: 0.9 },
    { name: 'Steel moment frame', Ct: 0.028, x: 0.8 },
    { name: 'Steel eccentrically braced frame', Ct: 0.03, x: 0.75 },
    { name: 'Steel buckling-restrained braced frame', Ct: 0.03, x: 0.75 },
    { name: 'All other systems', Ct: 0.02, x: 0.75 }
  ];

  // ---------- physics (no DOM) ----------

  function period(sys, n, hFt) {
    var hn = n * hFt;
    return { hn: hn, Ta: sys.Ct * Math.pow(hn, sys.x) };
  }

  // Closed-form modes of a uniform fixed-free shear chain with unit floor masses
  function modes(n, Ta) {
    var w1 = 2 * Math.PI / Ta, sk = w1 / (2 * Math.sin(Math.PI / (2 * (2 * n + 1)))), out = [];
    for (var j = 1; j <= n; j++) {
      var th = (2 * j - 1) * Math.PI / (2 * n + 1), w = 2 * sk * Math.sin(th / 2), phi = [], s1 = 0, s2 = 0;
      for (var i = 1; i <= n; i++) {
        var p = Math.sin(i * th);
        phi.push(p);
        s1 += p;
        s2 += p * p;
      }
      out.push({ w: w, T: 2 * Math.PI / w, phi: phi, gamma: s1 / s2 });
    }
    return { k: sk * sk, list: out };
  }

  // Sa (g) from a spectrum sampled at `periods`; constant Sd past the last period
  function saAt(periods, sa, T) {
    var last = periods.length - 1;
    if (T <= periods[0]) return sa[0];
    if (T >= periods[last]) return sa[last] * Math.pow(periods[last] / T, 2);
    var lo = 0, hi = last;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (periods[mid] <= T) lo = mid; else hi = mid;
    }
    var f = (T - periods[lo]) / (periods[hi] - periods[lo]);
    return sa[lo] + f * (sa[hi] - sa[lo]);
  }

  // Modal response spectrum analysis, SRSS of the first min(n, 5) modes
  function rsa(n, hFt, Ta, periods, sa) {
    var m = modes(n, Ta), nm = Math.min(n, 5), drift = new Float64Array(n), roof = 0;
    for (var j = 0; j < nm; j++) {
      var md = m.list[j], sd = saAt(periods, sa, md.T) * G / (md.w * md.w);
      for (var i = 0; i < n; i++) {
        var d = md.gamma * (md.phi[i] - (i ? md.phi[i - 1] : 0)) * sd;
        drift[i] += d * d;
      }
      var r = md.gamma * md.phi[n - 1] * sd;
      roof += r * r;
    }
    var peak = 0, story = 0;
    for (var s = 0; s < n; s++) {
      drift[s] = Math.sqrt(drift[s]) / (12 * hFt);
      if (drift[s] > peak) { peak = drift[s]; story = s; }
    }
    return { drift: drift, peak: peak, story: story, roof: Math.sqrt(roof), modes: m.list.slice(0, nm) };
  }

  // Newmark average acceleration (γ = 1/2, β = 1/4) on M = I, tridiagonal K, Rayleigh C
  function Frame(n, Ta) {
    var m = modes(n, Ta), k = m.k, w1 = m.list[0].w, w2 = n > 1 ? m.list[1].w : 0;
    var a0 = n > 1 ? 2 * ZETA * w1 * w2 / (w1 + w2) : 2 * ZETA * w1, a1 = n > 1 ? 2 * ZETA / (w1 + w2) : 0;
    var kd = new Float64Array(n), cd = new Float64Array(n), co = -a1 * k;
    for (var i = 0; i < n; i++) {
      kd[i] = i < n - 1 ? 2 * k : k;
      cd[i] = a0 + a1 * kd[i];
    }
    // effective stiffness, factored once (Thomas)
    var c4 = 4 / (DT * DT), c2 = 2 / DT, off = -k + c2 * co, sup = new Float64Array(n), den = new Float64Array(n);
    for (var r = 0; r < n; r++) {
      var diag = kd[r] + c2 * cd[r] + c4 - (r ? off * sup[r - 1] : 0);
      den[r] = diag;
      sup[r] = off / diag;
    }
    this.n = n;
    this.k = k;
    this.u = new Float64Array(n);
    this.v = new Float64Array(n);
    this.a = new Float64Array(n);
    this.rhs = new Float64Array(n);
    this.kd = kd; this.cd = cd; this.co = co; this.off = off; this.sup = sup; this.den = den;
    this.c4 = c4; this.c2 = c2;
    this.started = false;
  }

  // Advance one DT under ground acceleration ag (in/s²)
  Frame.prototype.step = function (ag) {
    var n = this.n, u = this.u, v = this.v, a = this.a, b = this.rhs, i;
    if (!this.started) {
      for (i = 0; i < n; i++) a[i] = -ag;
      this.started = true;
    }
    for (i = 0; i < n; i++) {
      var x = this.c2 * u[i] + v[i], xl = i ? this.c2 * u[i - 1] + v[i - 1] : 0, xr = i < n - 1 ? this.c2 * u[i + 1] + v[i + 1] : 0;
      var cx = this.cd[i] * x + (i ? this.co * xl : 0) + (i < n - 1 ? this.co * xr : 0);
      b[i] = -ag + this.c4 * u[i] + (4 / DT) * v[i] + a[i] + cx;
    }
    // forward / back substitution
    b[0] /= this.den[0];
    for (i = 1; i < n; i++) b[i] = (b[i] - this.off * b[i - 1]) / this.den[i];
    for (i = n - 2; i >= 0; i--) b[i] -= this.sup[i] * b[i + 1];
    for (i = 0; i < n; i++) {
      var du = b[i] - u[i], vn = this.c2 * du - v[i];
      a[i] = this.c4 * du - (4 / DT) * v[i] - a[i];
      v[i] = vn;
      u[i] = b[i];
    }
  };

  var Engine = { G: G, DT: DT, LIMIT: LIMIT, SYSTEMS: SYSTEMS, period: period, modes: modes, saAt: saAt, rsa: rsa, Frame: Frame };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  if (typeof document === 'undefined') return;

  // ---------- page ----------

  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/[^/]*$/, '') : '';
  var root = document.getElementById('rx-shake');
  if (!root) return;

  var CALM = '#acb2c0', ACTIVE = '#c8f230', OVER = '#ffffff', DIM = '#524f5a', LINE = '#333', TEXT = '#d0d0d0';
  var field = 'background:#000;color:#fff;border:1px solid #333;padding:8px 10px;font:inherit;font-size:14px;';
  root.innerHTML =
    '<style>' +
    '#rx-shake{color:' + TEXT + ';font-size:15px}' +
    '#rx-shake .rs-row{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;margin:0 0 14px}' +
    '#rx-shake label{display:flex;gap:10px;align-items:center;margin:0;font-weight:400}' +
    '#rx-shake input[type=range]{accent-color:' + CALM + ';width:120px}' +
    '#rx-shake .rs-gm{flex:1 1 320px;min-width:0;max-width:100%}' +
    '#rx-shake .rs-grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);grid-template-areas:"frame side" "acc acc";gap:16px}#rx-shake .rs-frame{grid-area:frame}#rx-shake .rs-side{grid-area:side}#rx-shake .rs-acc{grid-area:acc}' +
    '#rx-shake canvas{display:block;width:100%;border:1px solid ' + LINE + '}' +
    '#rx-shake .rs-stats{display:grid;grid-template-columns:auto auto auto;gap:6px 14px;margin-top:14px;font-size:14px;align-items:baseline}' +
    '#rx-shake .rs-stats b{color:#fff;font-weight:600;white-space:nowrap}' +
    '#rx-shake .rs-h{color:#8a8f99;font-size:12px;letter-spacing:.08em;text-transform:uppercase}' +
    '#rx-shake .rs-f{margin:0 0 14px;color:#fff;font-size:14px}' +
    '#rx-shake .rs-note{margin-top:14px;color:#8a8f99;font-size:12px;line-height:1.5}' +
    '#rx-shake .rs-play{background:#fff;color:#000;border:0;padding:11px 22px;font-weight:700;cursor:pointer;font:inherit;font-weight:700}' +
    '#rx-shake .rs-speed{background:#000;color:#fff;border:1px solid #333;padding:10px 12px;cursor:pointer;font:inherit}' +
    '@media (max-width:767px){#rx-shake .rs-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"frame" "acc" "side";gap:12px}#rx-shake .rs-row label{flex:1 1 100%;justify-content:space-between}#rx-shake input[type=range]{flex:1}#rx-shake select{max-width:100%}#rx-shake .rs-stats{gap:6px 10px;font-size:13px}}' +
    '</style>' +
    '<div class="rs-row"><select class="rs-gm" aria-label="Ground motion" style="' + field + '"><option>Loading ground motions…</option></select>' +
    '<button type="button" class="rs-play">Shake it</button><button type="button" class="rs-speed" aria-label="Playback speed">1×</button></div>' +
    '<div class="rs-row">' +
    '<label>Stories <input type="range" class="rs-n" min="1" max="40" step="1" value="12" aria-label="Number of stories"> <b class="rs-nv" style="color:#fff;min-width:2ch"></b></label>' +
    '<label>Story height <input type="range" class="rs-h-in" min="9" max="20" step="1" value="13" aria-label="Story height in feet"> <b class="rs-hv" style="color:#fff;min-width:5ch"></b></label>' +
    '<label>Displacement scale <input type="range" class="rs-x" min="0" max="10" step="1" value="4" aria-label="Displacement drawing scale"> <b class="rs-xv" style="color:#fff;min-width:5ch"></b></label>' +
    '<select class="rs-sys" aria-label="Structural system" style="' + field + '"></select></div>' +
    '<p class="rs-f"></p>' +
    '<div class="rs-grid"><canvas class="rs-frame" style="height:420px;touch-action:pan-y;cursor:grab"></canvas>' +
    '<div class="rs-side"><canvas class="rs-spec" style="height:260px"></canvas><div class="rs-leg" style="font-size:12px;color:#8a8f99;margin-top:6px"></div>' +
    '<div class="rs-stats">' +
    '<span></span><span class="rs-h">Time history</span><span class="rs-h">RSA (SRSS)</span>' +
    '<span>Peak drift</span><b class="rs-thd">–</b><b class="rs-rsd">–</b>' +
    '<span>Roof displacement</span><b class="rs-thr">–</b><b class="rs-rsr">–</b>' +
    '<span>Sa(Ta), 5%</span><b class="rs-sa" style="grid-column:span 2">–</b>' +
    '</div></div>' +
    '<canvas class="rs-acc" style="height:72px"></canvas></div>' +
    '<p class="rs-note">Ground motions: PEER NGA-West2 records, scaled, from a CE 5515 project with Mehdi Samimy. ' +
    'Elastic uniform shear frame, 5% damping, Ta per ASCE 7-22 §12.8.2.1. A floor turns white past 2% story drift (ASCE 7 Table 12.12-1, Risk Category II). ' +
    'Not for design.</p>';

  function $(s) { return root.querySelector(s); }
  var gmSel = $('.rs-gm'), playBtn = $('.rs-play'), speedBtn = $('.rs-speed'), nIn = $('.rs-n'), hIn = $('.rs-h-in'), sysSel = $('.rs-sys');
  var fCv = $('.rs-frame'), sCv = $('.rs-spec'), aCv = $('.rs-acc'), fx = fCv.getContext('2d'), sx = sCv.getContext('2d'), ax = aCv.getContext('2d');

  SYSTEMS.forEach(function (s, i) {
    var o = document.createElement('option');
    o.value = i;
    o.textContent = s.name + ' (Ct ' + s.Ct + ', x ' + s.x + ')';
    sysSel.appendChild(o);
  });

  var index = null, cache = {}, rec = null, recSa = null;
  var n, hFt, sys, Ta, hn, frame, est, scale = 1, exag = 1, userExag = 0;
  var SCALES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  var playing = false, t = 0, speed = 1, running = false, last = 0;
  var dragging = false, gd = 0, gdPrev = 0, gdPrev2 = 0, target = 0;
  var peak = 0, peakStory = 0, peakRoof = 0, ratio = new Float64Array(40);
  var dims = {};

  function fmt(v, d) { return v.toFixed(d); }
  function pct(v) { return (v * 100).toFixed(2) + '%'; }

  function niceExag(x) {
    var p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  }

  function rebuild() {
    n = +nIn.value;
    hFt = +hIn.value;
    sys = SYSTEMS[+sysSel.value];
    var p = period(sys, n, hFt);
    Ta = p.Ta;
    hn = p.hn;
    $('.rs-nv').textContent = n;
    $('.rs-hv').textContent = hFt + ' ft';
    $('.rs-f').innerHTML = 'Ta = C<sub>t</sub> h<sub>n</sub><sup>x</sup> = ' + sys.Ct + ' × ' + hn + '<sup>' + sys.x + '</sup> = <b>' + fmt(Ta, 2) + ' s</b>' +
      ' <span style="color:#8a8f99">· ASCE 7-22 §12.8.2.1, h<sub>n</sub> = ' + hn + ' ft</span>';
    frame = new Frame(n, Ta);
    stop();
    resetPeaks();
    analyze();
    draw();
  }

  function analyze() {
    if (!index || !recSa) { est = null; return; }
    est = rsa(n, hFt, Ta, index.periods, recSa);
    $('.rs-rsd').textContent = pct(est.peak) + ' · story ' + (est.story + 1);
    $('.rs-rsr').textContent = fmt(est.roof, 1) + ' in';
    $('.rs-sa').textContent = fmt(saAt(index.periods, recSa, Ta), 3) + ' g at ' + fmt(Ta, 2) + ' s';
    // pick an exaggeration so the RSA roof displacement fills about a third of the free width
    var room = Math.max(40, (dims.fw || 600) / 2 - (dims.half || 90) - 10);
    exag = userExag || Math.min(2000, Math.max(1, niceExag(0.35 * room / (Math.max(est.roof, 0.05) * scale))));
    showExag();
    drawSpectrum();
  }

  function showExag() {
    $('.rs-x').value = SCALES.indexOf(exag) < 0 ? 4 : SCALES.indexOf(exag);
    $('.rs-xv').textContent = exag + '×';
  }

  function resetPeaks() {
    peak = 0; peakStory = 0; peakRoof = 0;
    $('.rs-thd').textContent = '–';
    $('.rs-thr').textContent = '–';
  }

  function size() {
    var d = window.devicePixelRatio || 1;
    [[fCv, fx], [sCv, sx], [aCv, ax]].forEach(function (p) {
      var c = p[0];
      c.width = c.clientWidth * d;
      c.height = c.clientHeight * d;
      p[1].setTransform(d, 0, 0, d, 0, 0);
    });
    dims = { fw: fCv.clientWidth, fh: fCv.clientHeight, half: Math.min(fCv.clientWidth * 0.16, 90) };
    analyze();
    draw();
  }

  // ---------- drawing ----------

  function draw() {
    if (!frame || !dims.fw) return;
    var W = dims.fw, H = dims.fh, base = H - 40, half = dims.half, story = (base - 30) / n;
    scale = story / (12 * hFt); // px per inch at true scale
    var k = scale * exag, cx = W / 2 + gd * k;
    fx.fillStyle = '#000';
    fx.fillRect(0, 0, W, H);
    fx.fillStyle = DIM;
    fx.fillRect(0, base, W, 2);
    var px = cx, py = base;
    for (var i = 0; i < n; i++) {
      var x = cx + frame.u[i] * k, y = base - (i + 1) * story, over = ratio[i] > LIMIT;
      fx.strokeStyle = over ? OVER : CALM;
      fx.lineWidth = over ? 4 : n > 24 ? 1.5 : 2;
      fx.beginPath();
      fx.moveTo(px - half, py); fx.lineTo(x - half, y);
      fx.moveTo(px + half, py); fx.lineTo(x + half, y);
      fx.moveTo(x - half, y); fx.lineTo(x + half, y);
      fx.stroke();
      px = x; py = y;
    }
    fx.fillStyle = '#8a8f99';
    fx.font = '12px Montserrat, sans-serif';
    fx.textAlign = 'left';
    fx.fillText('Displacements drawn ' + exag + '× true scale', 12, H - 14);
    fx.textAlign = 'right';
    fx.fillText(rec && (playing || t > 0) ? 't = ' + fmt(Math.min(t, rec.a.length * index.dt), 1) + ' s' : 'Drag to shake', W - 12, H - 14);
    drawAccel();
  }

  function drawSpectrum() {
    var W = sCv.clientWidth, H = sCv.clientHeight;
    if (!W) return;
    sx.fillStyle = '#000';
    sx.fillRect(0, 0, W, H);
    if (!index || !recSa) return;
    var L = 40, R = 10, T = 14, B = 30, tMin = 0.05, tMax = 10, P = index.periods;
    var yMax = 0;
    for (var i = 0; i < P.length; i++) yMax = Math.max(yMax, recSa[i], index.meanSa[i]);
    yMax = Math.ceil(yMax * 1.1 * 4) / 4;
    function X(tt) { return L + (Math.log(tt / tMin) / Math.log(tMax / tMin)) * (W - L - R); }
    function Y(s) { return H - B - (s / yMax) * (H - T - B); }
    sx.strokeStyle = '#1c1c1c';
    sx.fillStyle = '#8a8f99';
    sx.font = '11px Montserrat, sans-serif';
    sx.lineWidth = 1;
    sx.textAlign = 'center';
    [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].forEach(function (tt) {
      sx.beginPath(); sx.moveTo(X(tt), T); sx.lineTo(X(tt), H - B); sx.stroke();
      sx.fillText(tt, X(tt), H - B + 14);
    });
    sx.fillText('Period T (s)', (L + W - R) / 2, H - 3);
    sx.textAlign = 'right';
    var step = yMax > 2 ? 1 : yMax > 1 ? 0.5 : 0.25;
    for (var s = 0; s <= yMax + 1e-9; s += step) {
      sx.beginPath(); sx.moveTo(L, Y(s)); sx.lineTo(W - R, Y(s)); sx.stroke();
      sx.fillText(s, L - 6, Y(s) + 4);
    }
    sx.save();
    sx.translate(11, (T + H - B) / 2);
    sx.rotate(-Math.PI / 2);
    sx.textAlign = 'center';
    sx.fillText('Sa (g)', 0, 0);
    sx.restore();
    sx.save();
    sx.beginPath();
    sx.rect(L, T, W - L - R, H - T - B);
    sx.clip();
    function curve(sa, color, w) {
      sx.strokeStyle = color;
      sx.lineWidth = w;
      sx.beginPath();
      var first = true;
      for (var j = 0; j < P.length; j++) {
        if (P[j] < tMin) continue;
        if (first) { sx.moveTo(X(P[j]), Y(sa[j])); first = false; } else sx.lineTo(X(P[j]), Y(sa[j]));
      }
      sx.stroke();
    }
    index.records.forEach(function (r) { if (r.Sa !== recSa) curve(r.Sa, 'rgba(172,178,192,0.16)', 1); });
    curve(index.meanSa, '#fff', 1.5);
    curve(recSa, ACTIVE, 2.5);
    // Ta line and higher modes
    sx.strokeStyle = '#fff';
    sx.setLineDash([4, 4]);
    sx.lineWidth = 1;
    sx.beginPath(); sx.moveTo(X(Math.max(Ta, tMin)), T); sx.lineTo(X(Math.max(Ta, tMin)), H - B); sx.stroke();
    sx.setLineDash([]);
    if (est) est.modes.forEach(function (md, j) {
      if (md.T < tMin) return;
      sx.fillStyle = j ? ACTIVE : '#fff';
      sx.beginPath(); sx.arc(X(md.T), Y(saAt(P, recSa, md.T)), j ? 3 : 5, 0, 2 * Math.PI); sx.fill();
    });
    sx.restore();
    sx.textAlign = 'left';
    sx.fillStyle = '#fff';
    sx.fillText('Ta', Math.min(X(Math.max(Ta, tMin)) + 5, W - R - 16), H - B - 6);
    $('.rs-leg').innerHTML = '<span style="color:' + ACTIVE + '">━</span> selected record &nbsp; <span style="color:#fff">━</span> suite mean of 30 &nbsp; ● modes 1–' + (est ? est.modes.length : 1);
  }

  function drawAccel() {
    var W = aCv.clientWidth, H = aCv.clientHeight;
    if (!W) return;
    ax.fillStyle = '#000';
    ax.fillRect(0, 0, W, H);
    if (!rec) return;
    var a = rec.a, len = a.length, dur = len * index.dt, mid = H / 2, amp = (H / 2 - 8) / Math.max(rec.meta.pga, 1e-6);
    var playX = Math.min(t / dur, 1) * W;
    ax.lineWidth = 1;
    for (var pass = 0; pass < 2; pass++) {
      ax.strokeStyle = pass ? '#fff' : 'rgba(172,178,192,0.45)';
      ax.beginPath();
      var from = 0, to = pass ? Math.floor(playX) : W;
      for (var px = from; px < to; px++) {
        var i0 = Math.floor(px / W * len), i1 = Math.max(i0 + 1, Math.floor((px + 1) / W * len)), lo = 0, hi = 0;
        for (var i = i0; i < i1 && i < len; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
        ax.moveTo(px + 0.5, mid - hi * amp); ax.lineTo(px + 0.5, mid - lo * amp + 1);
      }
      ax.stroke();
    }
    if (t > 0) {
      ax.fillStyle = '#fff';
      ax.fillRect(playX, 0, 1, H);
    }
    ax.fillStyle = '#8a8f99';
    ax.font = '11px Montserrat, sans-serif';
    ax.textAlign = 'left';
    var lab = 'Ground acceleration · PGA ' + fmt(rec.meta.pga, 2) + ' g · ' + fmt(dur, 0) + ' s';
    ax.fillStyle = '#000';
    ax.fillRect(4, 2, ax.measureText(lab).width + 8, 15);
    ax.fillStyle = '#8a8f99';
    ax.fillText('Ground acceleration · PGA ' + fmt(rec.meta.pga, 2) + ' g · ' + fmt(dur, 0) + ' s', 8, 13);
  }

  // ---------- running ----------

  function agAt(time) {
    var a = rec.a, f = time / index.dt, i = Math.floor(f);
    if (i >= a.length - 1) return i === a.length - 1 ? a[i] * G : 0;
    return (a[i] + (f - i) * (a[i + 1] - a[i])) * G;
  }

  function track() {
    var u = frame.u;
    for (var j = 0; j < n; j++) {
      var d = Math.abs(u[j] - (j ? u[j - 1] : 0)) / (12 * hFt);
      ratio[j] = d;
      if (d > peak) { peak = d; peakStory = j; }
    }
    var r = Math.abs(u[n - 1]);
    if (r > peakRoof) peakRoof = r;
  }

  function tick(now) {
    var dtReal = Math.min(0.05, (now - last) / 1000 || 1 / 60), steps = Math.min(600, Math.round(dtReal * (playing ? speed : 1) / DT));
    last = now;
    var follow = 1 - Math.exp(-9 * DT);
    for (var s = 0; s < steps; s++) {
      var ag;
      if (playing) {
        ag = agAt(t);
        t += DT;
      } else {
        if (!dragging) target *= 0.999;
        gdPrev2 = gdPrev;
        gdPrev = gd;
        gd += (target - gd) * follow;
        ag = (gd - 2 * gdPrev + gdPrev2) / (DT * DT);
      }
      frame.step(ag);
      track();
    }
    if (playing && t > rec.a.length * index.dt + 4) playing = false, playBtn.textContent = 'Shake it';
    $('.rs-thd').textContent = pct(peak) + ' · story ' + (peakStory + 1);
    $('.rs-thr').textContent = fmt(peakRoof, 1) + ' in';
    draw();
    var energy = Math.abs(gd) + Math.abs(target);
    for (var j = 0; j < n; j++) energy += Math.abs(frame.u[j]) + Math.abs(frame.v[j]) * 0.05;
    if (!playing && !dragging && energy < 0.002) { running = false; return; }
    requestAnimationFrame(tick);
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function stop() {
    playing = false;
    t = 0;
    playBtn.textContent = 'Shake it';
  }

  function play() {
    if (!rec) return;
    if (playing) { stop(); return; }
    frame = new Frame(n, Ta);
    for (var j = 0; j < n; j++) ratio[j] = 0;
    gd = gdPrev = gdPrev2 = target = 0;
    resetPeaks();
    t = 0;
    playing = true;
    playBtn.textContent = 'Stop';
    wake();
  }

  function pointerIn(e) {
    var box = fCv.getBoundingClientRect(), px = Math.max(-60, Math.min(60, (e.clientX - box.left - box.width / 2) * 0.3));
    return px / (scale * exag);
  }

  // ---------- data ----------

  function label(r) {
    return 'EQ' + (r.eq < 10 ? '0' : '') + r.eq + r.axis + ' · ' + r.event + ' ' + r.year + ' · M' + r.M + ' · ' + r.station + ' ' + r.component + ' · SF ' + r.sf;
  }

  function select(id) {
    var meta = index.records.filter(function (r) { return r.id === id; })[0];
    recSa = meta.Sa;
    stop();
    resetPeaks();
    analyze();
    var done = function (data) {
      if (gmSel.value !== id) return;
      rec = { meta: meta, a: data.a };
      draw();
    };
    if (cache[id]) return done(cache[id]);
    rec = null;
    draw();
    fetch(BASE + 'gm/' + id + '.json').then(function (r) { return r.json(); }).then(function (d) {
      cache[id] = d;
      done(d);
    }).catch(function () { gmSel.title = 'Could not load ' + id; });
  }

  fetch(BASE + 'gm/index.json').then(function (r) { return r.json(); }).then(function (d) {
    index = d;
    gmSel.innerHTML = '';
    var group = null;
    d.records.forEach(function (r) {
      if (!group || group.dataset.eq != r.eq) {
        group = document.createElement('optgroup');
        group.dataset.eq = r.eq;
        group.label = r.event + ' ' + r.year + ' · ' + r.station;
        gmSel.appendChild(group);
      }
      var o = document.createElement('option');
      o.value = r.id;
      o.textContent = label(r);
      group.appendChild(o);
    });
    gmSel.value = 'EQ14X';
    select(gmSel.value);
  }).catch(function () {
    gmSel.innerHTML = '<option>Ground motions unavailable, drag to shake</option>';
  });

  gmSel.addEventListener('change', function () { select(gmSel.value); });
  playBtn.addEventListener('click', play);
  speedBtn.addEventListener('click', function () {
    speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    speedBtn.textContent = speed + '×';
  });
  [nIn, hIn].forEach(function (el) { el.addEventListener('input', rebuild); });
  sysSel.addEventListener('change', rebuild);
  $('.rs-x').addEventListener('input', function () {
    exag = userExag = SCALES[+this.value];
    showExag();
    draw();
  });
  fCv.addEventListener('pointerdown', function (e) {
    stop();
    dragging = true;
    resetPeaks();
    target = pointerIn(e);
    fCv.setPointerCapture(e.pointerId);
    wake();
  });
  fCv.addEventListener('pointermove', function (e) { if (dragging) target = pointerIn(e); });
  fCv.addEventListener('pointerup', function () { dragging = false; });
  fCv.addEventListener('pointercancel', function () { dragging = false; });
  window.addEventListener('resize', size);
  rebuild();
  size();
})();
