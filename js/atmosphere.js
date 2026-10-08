/* SHDP atmosphere: the quiet motion layer outside the hero.
   - Sacred geometry: .mandala SVGs rotate (CSS, 40–90 s cycles) only while on screen.
   - Incense dust: sparse motes drifting upward on canvas[data-atmo] in dark sections.
   - Depth: [data-depth] images move a few percent against the scroll (existing GSAP).
   Everything pauses off-screen and is skipped entirely under prefers-reduced-motion. */
(() => {
  const S = window.SHDP;
  if (!S || S.reduceMotion || !("IntersectionObserver" in window)) return;
  const { $$, safe } = S;

  /* ---------- sacred geometry: animate only while visible ---------- */
  safe("mandalas", () => {
    const io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle("is-live", e.isIntersecting)), { rootMargin: "100px" });
    $$(".mandala").forEach(m => io.observe(m));
  });

  /* ---------- incense dust ---------- */
  function dust(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tone = canvas.dataset.atmo === "dark" ? [232, 196, 128] : [184, 134, 43];
    let w = 0, h = 0, motes = [], raf = 0, running = false, visible = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function seed() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(28, Math.max(10, Math.round((w * h) / 26000)));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vy: 0.08 + Math.random() * 0.22,          // slow upward drift
        sway: 0.3 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2,
        a: 0.12 + Math.random() * 0.33
      }));
    }
    function frame(time) {
      raf = requestAnimationFrame(frame);
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.vy;
        if (m.y < -6) { m.y = h + 6; m.x = Math.random() * w; }
        const x = m.x + Math.sin(t * 0.4 + m.phase) * m.sway * 6;
        // fade in near the bottom and out near the top, like rising smoke
        const life = Math.min(1, (h - m.y) / (h * 0.25), m.y / (h * 0.3));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${(m.a * Math.max(0, life)).toFixed(3)})`;
        ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function update() {
      const should = visible && document.visibilityState === "visible";
      if (should && !running) { running = true; if (!motes.length) seed(); raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(canvas);
    document.addEventListener("visibilitychange", update);
    let lastW = 0, rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const nw = canvas.getBoundingClientRect().width; if (nw !== lastW) { lastW = nw; seed(); } }, 200); });
    seed(); lastW = w;
  }
  safe("dust", () => $$("canvas[data-atmo]").forEach(c => safe("dust canvas", () => dust(c))));

  /* ---------- depth: a few images drift a little against the scroll ---------- */
  safe("depth", () => {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    $$("[data-depth]").forEach(el => {
      const d = Math.min(10, Math.max(2, +el.dataset.depth || 4));
      // constant slight zoom so the moving image never reveals an edge inside its frame
      const scale = 1 + (d * 2.4) / 100;
      gsap.fromTo(el, { yPercent: -d, scale }, { yPercent: d, scale, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
  });
})();
