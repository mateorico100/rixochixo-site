/* rixochixo.com home v3 (2027): page layer. Decode headline, status line, CTA, section numbering,
   scroll reveal, card spotlight + tilt, cursor, live LA clock. No dependencies. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer: fine)').matches;
  document.documentElement.classList.add('rx-v3');

  // ---------- hero copy ----------
  var h1 = document.querySelector('.rx-hero-h1');
  var label = document.querySelector('.rx-hero-label');
  if (label) label.textContent = 'Mateo Rico, EIT · structural engineering / software / design';
  if (h1) {
    var text = h1.textContent.trim();
    h1.setAttribute('aria-label', text);
    var span = document.createElement('span'); span.setAttribute('aria-hidden', 'true');
    var caret = document.createElement('i'); caret.className = 'rx-caret'; caret.setAttribute('aria-hidden', 'true');
    h1.textContent = ''; h1.appendChild(span); h1.appendChild(caret);
    if (reduce) span.textContent = text;
    else {
      var GLY = '01<>/\\[]{}#*+=-_ABCDEFGHJKLMNPQRSTUVWXYZ', start = performance.now(), dur = 1500;
      (function tick(now) {
        var p = Math.min(1, (now - start) / dur), out = '';
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (ch === ' ' || i / text.length < p) out += ch;
          else out += GLY[(Math.random() * GLY.length) | 0];
        }
        span.textContent = out;
        if (p < 1) requestAnimationFrame(tick);
      })(start);
    }
    var col = h1.parentNode;
    var st = document.createElement('div'); st.className = 'rx-status';
    st.innerHTML = '<span><i class="rx-pip"></i><b>Online</b> · building 2027</span><span>M.S. Structural · Cal Poly Pomona</span><span class="rx-clock">LA --:--:--</span>';
    col.appendChild(st);
    var cta = document.createElement('div'); cta.className = 'rx-cta';
    cta.innerHTML = '<a class="rx-cta-main" href="#rx-shake">Shake the building</a><a href="/portfolio">Portfolio</a><a href="/contact">Contact</a>';
    col.appendChild(cta);
  }

  // ---------- clock ----------
  function clock() {
    var t = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
    document.querySelectorAll('.rx-clock').forEach(function (c) { c.textContent = 'LA ' + t; });
  }
  clock(); setInterval(clock, 1000);

  // ---------- sections ----------
  var bands = [].slice.call(document.querySelectorAll('.rx-band')).filter(function (b) { return !b.classList.contains('rx-hero'); });
  var k = 0;
  document.querySelectorAll('.rx-kicker').forEach(function (kk) {
    k++; var n = document.createElement('span'); n.className = 'rx-num-k'; n.textContent = (k < 10 ? '0' : '') + k;
    kk.insertBefore(n, kk.firstChild);
  });
  var last = bands[bands.length - 1];
  if (last) {
    var wrap = last.querySelector('.rx-wrap') || last;
    var sys = document.createElement('div'); sys.className = 'rx-sysline';
    sys.innerHTML = '<span>rixochixo.com · v2027.0</span><span class="rx-clock"></span><span>© ' + new Date().getFullYear() + ' Mateo Rico</span>';
    wrap.appendChild(sys); clock();
  }
  var rev = [];
  bands.forEach(function (b) { [].forEach.call(b.querySelectorAll('.rx-kicker, .rx-title, .rx-copy, #rx-shake, .rx-card, .rx-proof'), function (e) { rev.push(e); }); });
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('rx-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rev.forEach(function (e, i) { e.classList.add('rx-reveal'); e.style.transitionDelay = ((i % 3) * 0.08) + 's'; io.observe(e); });
  }

  // ---------- cards ----------
  document.querySelectorAll('.rx-card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
      if (!reduce && fine) c.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 4) + 'deg) rotateY(' + ((x - 0.5) * 5) + 'deg)';
    });
    c.addEventListener('pointerleave', function () { c.style.transform = ''; });
  });

  // ---------- cursor ----------
  if (fine && !reduce) {
    var ring = document.createElement('div'); ring.className = 'rx-cur';
    var dot = document.createElement('div'); dot.className = 'rx-cur-dot';
    document.body.appendChild(ring); document.body.appendChild(dot);
    var tx = -100, ty = -100, cx = -100, cy = -100;
    addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%)';
      var hot = e.target.closest && e.target.closest('a, button, input, select, .rx-scan-stage');
      ring.classList.toggle('rx-hot', !!hot);
    }, { passive: true });
    (function loop() {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      ring.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
  }
})();
