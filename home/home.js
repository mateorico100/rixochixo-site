/* rixochixo.com home v3.1: page layer. Quiet confidence: the headline settles in line by line,
   a status line, three exits, numbered sections, slow scroll reveals, a soft card spotlight, live LA clock. No dependencies. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('rx-v3');

  // ---------- hero copy ----------
  var h1 = document.querySelector('.rx-hero-h1');
  var label = document.querySelector('.rx-hero-label');
  if (label) label.textContent = 'Mateo Rico, EIT · Structural engineer';
  if (h1) {
    var text = h1.textContent.trim();
    h1.setAttribute('aria-label', text);
    // one span per word so it can settle in, word by word, without changing the line breaks
    h1.textContent = '';
    text.split(' ').forEach(function (w, i, all) {
      var s = document.createElement('span'); s.className = 'rx-w'; s.setAttribute('aria-hidden', 'true');
      s.textContent = w; s.style.transitionDelay = (0.25 + i * 0.09) + 's';
      h1.appendChild(s); if (i < all.length - 1) h1.appendChild(document.createTextNode(' '));
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { h1.classList.add('rx-set'); }); });
    var col = h1.parentNode;
    var st = document.createElement('div'); st.className = 'rx-status';
    st.innerHTML = '<span><i class="rx-pip"></i>Active · Los Angeles</span><span>Software · Design</span><span class="rx-clock">--:--:--</span>';
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
    sys.innerHTML = '<span>rixochixo.com</span><span class="rx-clock"></span><span>© ' + new Date().getFullYear() + ' Mateo Rico</span>';
    wrap.appendChild(sys); clock();
  }
  var rev = [];
  bands.forEach(function (b) { [].forEach.call(b.querySelectorAll('.rx-kicker, .rx-title, .rx-copy, #rx-shake, .rx-card, .rx-proof'), function (e) { rev.push(e); }); });
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('rx-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rev.forEach(function (e, i) { e.classList.add('rx-reveal'); e.style.transitionDelay = ((i % 3) * 0.1) + 's'; io.observe(e); });
  }

  // ---------- cards: soft spotlight that follows the pointer ----------
  document.querySelectorAll('.rx-card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
})();
