(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let lang = "en";

  /* ---------- toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2800);
  }

  /* ---------- header: solid after hero, hide on scroll down ---------- */
  const header = $("#header");
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    header.classList.toggle("is-solid", y > 40);
    header.classList.toggle("is-hidden", y > 600 && y > lastY && !drawer.classList.contains("is-open"));
    lastY = y;
  }, { passive: true });

  /* ---------- mobile drawer ---------- */
  const drawer = $("#drawer");
  const openBtn = $(".nav .menu-btn");
  function setDrawer(open) {
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }
  openBtn.addEventListener("click", () => setDrawer(true));
  $("[data-close]", drawer).addEventListener("click", () => setDrawer(false));
  $$("a", drawer).forEach(a => a.addEventListener("click", () => setDrawer(false)));
  document.addEventListener("keydown", e => { if (e.key === "Escape") setDrawer(false); });

  /* ---------- placeholder WhatsApp links ---------- */
  $$("[data-wa-group]").forEach(a => {
    if (a.getAttribute("href") === "#") {
      a.addEventListener("click", e => { e.preventDefault(); toast("WhatsApp group links coming soon"); });
    }
  });

  /* ---------- next Sunday date for Bala Chaitanya ---------- */
  (function nextSunday() {
    const d = new Date();
    const add = (7 - d.getDay()) % 7;
    d.setDate(d.getDate() + add);
    $("[data-next-sunday-day]").textContent = d.getDate();
    $("[data-next-sunday-mon]").textContent = d.toLocaleString("en-IN", { month: "short" });
    $("[data-next-sunday-dow]").textContent = add === 0 ? "Today" : "Sun";
  })();
  $("#year").textContent = new Date().getFullYear();

  /* ---------- programmes ---------- */
  const programmes = [
    {
      name: "Pravachanalu", te: "ప్రవచనాలు",
      when: "Weekly", whenTe: "వారానికి",
      img: "assets/img/prog-pravachanalu.jpg", pos: "50% 70%",
      body: "Scripture discourses on the Vedas, Puranas and Itihasas: Ramayana, Mahabharata, Bhagavad Gita and Srimad Bhagavatam, explained with logic and everyday examples.",
      bodyTe: "వేదాలు, పురాణాలు, ఇతిహాసాలపై ప్రవచనాలు: రామాయణం, మహాభారతం, భగవద్గీత, శ్రీమద్భాగవతం, తర్కంతో, నిత్య జీవిత ఉదాహరణలతో.",
      meta: [["For", "All ages"], ["Where", "In person + YouTube"], ["Fee", "Free"]]
    },
    {
      name: "Bala Chaitanya Deepika", te: "బాల చైతన్య దీపిక",
      when: "Every Sunday, 10 AM", whenTe: "ప్రతి ఆదివారం, ఉదయం 10",
      img: "assets/img/prog-bala.jpg", pos: "50% 60%",
      body: "A live, interactive Zoom programme where children ask their doubts and grow spiritually and mentally, mentored directly by Guruji.",
      bodyTe: "పిల్లలు తమ సందేహాలు అడిగి, ఆధ్యాత్మికంగా, మానసికంగా ఎదిగే ప్రత్యక్ష జూమ్ కార్యక్రమం, గురువుగారి మార్గదర్శనంలో.",
      meta: [["For", "Children 8 to 16"], ["Where", "Zoom"], ["Fee", "Free"]]
    },
    {
      name: "Dharma Chaitanya Vedika", te: "ధర్మ చైతన్య వేదిక",
      when: "Mon to Sat, since 2019", whenTe: "సోమ నుండి శని, 2019 నుండి",
      img: "assets/img/prog-bhajan.jpg", pos: "50% 82%",
      body: "Daily online classes on ancient literature for homemakers and seekers across India, in morning and evening batches.",
      bodyTe: "దేశవ్యాప్తంగా గృహిణులు, జిజ్ఞాసువుల కోసం ప్రాచీన సాహిత్యంపై రోజువారీ ఆన్‌లైన్ తరగతులు, ఉదయం, సాయంత్రం బ్యాచ్‌లలో.",
      meta: [["For", "Homemakers, seekers"], ["Where", "Online"], ["Fee", "Free"]]
    },
    {
      name: "Bhagavad Gita classes", te: "భగవద్గీత తరగతులు",
      when: "Since 2005", whenTe: "2005 నుండి",
      img: "assets/img/ashram-vision.jpg", pos: "78% 45%",
      body: "Started for children at Bhakta Sanjeevani Devalayam, NFC, expanded to elders at the Ayyappa Swamy Temple, ECIL, and now run weekly online by Guruji's disciples.",
      bodyTe: "NFC భక్త సంజీవని దేవాలయంలో పిల్లల కోసం ప్రారంభమై, ECIL అయ్యప్ప స్వామి ఆలయంలో పెద్దలకు విస్తరించి, ఇప్పుడు గురువుగారి శిష్యులచే వారానికొకసారి ఆన్‌లైన్‌లో.",
      meta: [["For", "Children & elders"], ["Where", "Online"], ["Fee", "Free"]]
    },
    {
      name: "Yoga & Surya Namaskaras", te: "యోగ & సూర్య నమస్కారాలు",
      when: "Since 2006", whenTe: "2006 నుండి",
      img: "assets/img/prog-yoga.jpg", pos: "50% 70%",
      body: "Dawn sessions of Ashtanga Yoga, Surya Namaskaras and Pranayama across Dr. A.S. Rao Nagar and ECIL, with a mass gathering every 21 June.",
      bodyTe: "డా. ఎ.ఎస్. రావు నగర్, ECILలో తెల్లవారుజామున అష్టాంగ యోగ, సూర్య నమస్కారాలు, ప్రాణాయామం; ప్రతి జూన్ 21న సామూహిక యోగా.",
      meta: [["For", "Everyone"], ["Where", "Hyderabad"], ["Fee", "Free"]]
    },
    {
      name: "Goshala & cow protection", te: "గోశాల & గో సంరక్షణ",
      when: "Ongoing seva", whenTe: "నిరంతర సేవ",
      img: "assets/img/prog-goshala.jpg", pos: "50% 50%",
      body: "Rythu Bazar drives collect surplus vegetables to feed cows across Hyderabad, and Gopashtami campaigns share Gomatha's ecological importance.",
      bodyTe: "రైతు బజార్ల నుండి మిగులు కూరగాయలు సేకరించి హైదరాబాద్‌లో గోవులకు ఆహారం; గోపాష్టమి నాడు గోమాత పర్యావరణ ప్రాముఖ్యతపై అవగాహన.",
      meta: [["For", "Volunteers"], ["Where", "Hyderabad"], ["Join", "WhatsApp"]]
    }
  ];
  const metaTe = { "For": "ఎవరికి", "Where": "ఎక్కడ", "Fee": "రుసుము", "Join": "చేరడం" };

  const progList = $("#prog-list");
  const progMedia = $("#prog-media");
  const progPanel = $("#prog-panel");
  let progIndex = 0;

  programmes.forEach((p, i) => {
    const img = new Image();
    img.src = p.img; img.alt = ""; img.loading = "lazy";
    img.style.objectPosition = p.pos;
    if (i !== 0) img.classList.add("is-out");
    progMedia.appendChild(img);
  });

  function renderProgList() {
    progList.innerHTML = programmes.map((p, i) => `
      <li class="prog-item" role="presentation">
        <button class="prog-btn" role="tab" id="prog-tab-${i}" aria-selected="${i === progIndex}" aria-controls="prog-panel" tabindex="${i === progIndex ? 0 : -1}" data-i="${i}">
          <span><span class="name">${lang === "te" ? p.te : p.name}</span><span class="when">${lang === "te" ? p.whenTe : p.when}</span></span>
          <svg class="icon"><use href="#i-arrow"/></svg>
        </button>
      </li>`).join("");
  }
  function renderProgPanel() {
    const p = programmes[progIndex];
    $$("img", progMedia).forEach((img, i) => img.classList.toggle("is-out", i !== progIndex));
    progPanel.setAttribute("aria-labelledby", `prog-tab-${progIndex}`);
    progPanel.innerHTML = `
      <h3>${lang === "te" ? p.te : p.name}</h3>
      <p>${lang === "te" ? p.bodyTe : p.body}</p>
      <dl>${p.meta.map(([k, v]) => `<div><dt>${lang === "te" ? metaTe[k] : k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
    if (!reduceMotion && window.gsap) gsap.from(progPanel.children, { y: 14, opacity: 0, duration: 0.5, stagger: 0.06, ease: "expo.out" });
  }
  function selectProg(i, focus) {
    if (i === progIndex) return;
    progIndex = (i + programmes.length) % programmes.length;
    $$(".prog-btn", progList).forEach((b, j) => { b.setAttribute("aria-selected", j === progIndex); b.tabIndex = j === progIndex ? 0 : -1; });
    if (focus) $$(".prog-btn", progList)[progIndex].focus();
    renderProgPanel();
  }
  progList.addEventListener("click", e => { const b = e.target.closest(".prog-btn"); if (b) selectProg(+b.dataset.i); });
  progList.addEventListener("mouseover", e => {
    const b = e.target.closest(".prog-btn");
    if (b && window.matchMedia("(hover: hover) and (min-width: 961px)").matches) selectProg(+b.dataset.i);
  });
  progList.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); selectProg(progIndex + 1, true); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); selectProg(progIndex - 1, true); }
  });
  renderProgList();
  renderProgPanel();

  /* ---------- timeline arrows + track length ---------- */
  const timeline = $("#timeline");
  const sizeTrack = () => timeline.style.setProperty("--track-w", timeline.scrollWidth + "px");
  sizeTrack(); window.addEventListener("resize", sizeTrack);
  $$("[data-scroll]").forEach(b => b.addEventListener("click", () => {
    timeline.scrollBy({ left: +b.dataset.scroll * (timeline.clientWidth * 0.8), behavior: reduceMotion ? "auto" : "smooth" });
  }));

  /* ---------- shloka: share + downloadable status card ---------- */
  function shareText() {
    const meaning = $("#shloka-meaning").textContent;
    return `${$("#shloka-text").textContent}\n${$("#shloka-translit").textContent}\n\n${meaning}\n\nSri Haritha Dharma Parishad`;
  }
  $("#share-shloka").addEventListener("click", e => {
    e.currentTarget.href = "https://wa.me/?text=" + encodeURIComponent(shareText());
  });
  $("#download-card").addEventListener("click", async () => {
    await document.fonts.ready;
    const W = 1080, H = 1920, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const bg = g.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.45, H * 0.8);
    bg.addColorStop(0, "#2a6338"); bg.addColorStop(0.55, "#102a1a"); bg.addColorStop(1, "#0b2014");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // halo
    const halo = g.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 460);
    halo.addColorStop(0, "rgba(233,133,44,0.35)"); halo.addColorStop(1, "rgba(233,133,44,0)");
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(226,183,100,0.6)"; g.lineWidth = 2;
    g.beginPath(); g.arc(W / 2, H * 0.4, 380, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H * 0.4, 400, 0, Math.PI * 2); g.stroke();
    g.textAlign = "center";
    g.fillStyle = "#e2b764"; g.font = "600 34px Mukta";
    g.fillText(lang === "te" ? "నేటి శ్లోకం" : "SHLOKA OF THE DAY", W / 2, 300);
    g.fillStyle = "#fbf6e8"; g.font = "112px 'Tiro Devanagari Sanskrit'";
    const words = $("#shloka-text").textContent.split(" ");
    g.fillText(words.slice(0, 2).join(" "), W / 2, H * 0.4 - 20);
    g.fillText(words.slice(2).join(" "), W / 2, H * 0.4 + 120);
    g.fillStyle = "#e2b764"; g.font = "italic 44px Mukta";
    g.fillText($("#shloka-translit").textContent, W / 2, H * 0.4 + 520);
    g.fillStyle = "#c3cdbf"; g.font = (lang === "te" ? "46px 'Noto Sans Telugu'" : "48px Mukta");
    wrap(g, $("#shloka-meaning").textContent, W / 2, H * 0.4 + 640, 860, 70);
    const logo = $(".brand img");
    try {
      g.save(); g.beginPath(); g.arc(W / 2, H - 290, 70, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.clip();
      g.drawImage(logo, W / 2 - 66, H - 356, 132, 132); g.restore();
    } catch (_) { /* logo optional */ }
    g.fillStyle = "#fbf6e8"; g.font = "44px Marcellus";
    g.fillText("Sri Haritha Dharma Parishad", W / 2, H - 160);
    g.fillStyle = "#e2b764"; g.font = "36px 'Tiro Devanagari Sanskrit'";
    g.fillText("संस्कृतेः रक्षा · राष्ट्रस्य सेवा", W / 2, H - 100);
    try {
      const a = document.createElement("a");
      a.download = "shdp-shloka-of-the-day.png";
      a.href = c.toDataURL("image/png");
      a.click();
      toast(lang === "te" ? "కార్డ్ డౌన్‌లోడ్ అయింది" : "Status card downloaded");
    } catch (_) {
      toast("Open the site from a web server to download the card");
    }
  });
  function wrap(g, text, x, y, maxW, lh) {
    const words = text.split(" "); let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; }
      else line = test;
    }
    g.fillText(line, x, y);
  }

  /* ---------- language toggle ---------- */
  const TE = window.SHDP_TE || {};
  const enText = new Map();
  $$("[data-i18n]").forEach(el => enText.set(el, el.textContent));
  $$("[data-i18n-html]").forEach(el => enText.set(el, el.innerHTML));
  function setLang(next) {
    lang = next;
    document.documentElement.lang = next;
    $$("[data-i18n]").forEach(el => {
      const v = next === "te" ? TE[el.dataset.i18n] : enText.get(el);
      if (v) el.textContent = v;
    });
    $$("[data-i18n-html]").forEach(el => {
      const v = next === "te" ? TE[el.dataset.i18nHtml] : enText.get(el);
      if (v) el.innerHTML = v;
    });
    $$(".lang-toggle button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === next)));
    renderProgList(); renderProgPanel();
    sizeTrack();
    try { localStorage.setItem("shdp-lang", next); } catch (_) {}
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  $$(".lang-toggle button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  try { if (localStorage.getItem("shdp-lang") === "te") setLang("te"); } catch (_) {}

  /* ---------- Three.js: rising diya embers + a slow sacred ring ---------- */
  function initHero3D() {
    const canvas = $("#hero-canvas");
    if (!window.THREE || !canvas) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
    catch (_) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 14;

    // soft round sprite for particles
    const spr = document.createElement("canvas"); spr.width = spr.height = 64;
    const sg = spr.getContext("2d");
    const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,236,190,1)"); rg.addColorStop(0.35, "rgba(240,170,80,0.6)"); rg.addColorStop(1, "rgba(233,133,44,0)");
    sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(spr);

    const COUNT = window.innerWidth < 700 ? 140 : 320;
    const pos = new Float32Array(COUNT * 3), speed = new Float32Array(COUNT), drift = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      speed[i] = 0.004 + Math.random() * 0.014;
      drift[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.32, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
    const embers = new THREE.Points(geo, mat);
    scene.add(embers);

    // ring of points echoing the halo in the logo / portraits
    const RING = 220, ringPos = new Float32Array(RING * 3);
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2, r = 6.2 + Math.sin(i * 0.7) * 0.06;
      ringPos[i * 3] = Math.cos(a) * r; ringPos[i * 3 + 1] = Math.sin(a) * r; ringPos[i * 3 + 2] = 0;
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
    const ring = new THREE.Points(ringGeo, new THREE.PointsMaterial({ size: 0.12, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    const ringGroup = new THREE.Group(); ringGroup.add(ring);
    const ring2 = ring.clone(); ring2.scale.setScalar(1.18); ring2.material = ring.material.clone(); ring2.material.opacity = 0.25; ringGroup.add(ring2);
    scene.add(ringGroup);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // centre the ring behind the portrait (right column on desktop, lower on mobile)
      const visual = $("[data-hero-visual] .arch").getBoundingClientRect();
      const hero = canvas.getBoundingClientRect();
      const cx = ((visual.left + visual.width / 2 - hero.left) / w) * 2 - 1;
      const cy = -(((visual.top + visual.height * 0.42 - hero.top) / h) * 2 - 1);
      const v = new THREE.Vector3(cx, cy, 0.5).unproject(camera).sub(camera.position).normalize();
      const t = -camera.position.z / v.z;
      ringGroup.position.copy(camera.position).add(v.multiplyScalar(t));
      // size the ring in pixels relative to the portrait, then convert to world units
      const worldPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / h;
      ringGroup.scale.setScalar((visual.width * 0.66 * worldPerPx) / 6.2);
    }
    resize(); window.addEventListener("resize", resize);
    setTimeout(resize, 1700); // re-measure once the intro animation has settled

    let mx = 0, my = 0;
    window.addEventListener("pointermove", e => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });

    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

    const clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      const t = clock.getElapsedTime();
      const p = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        p[i * 3 + 1] += speed[i];
        p[i * 3] += Math.sin(t * 0.6 + drift[i]) * 0.004;
        if (p[i * 3 + 1] > 9) { p[i * 3 + 1] = -9; p[i * 3] = (Math.random() - 0.5) * 30; }
      }
      geo.attributes.position.needsUpdate = true;
      ringGroup.rotation.z = t * 0.05;
      ring2.rotation.z = -t * 0.08;
      mat.opacity = 0.7 + Math.sin(t * 1.3) * 0.15;
      camera.position.x += (mx * 1.2 - camera.position.x) * 0.03;
      camera.position.y += (-my * 0.8 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    if (reduceMotion) { renderer.render(scene, camera); } else { frame(); }
  }

  /* ---------- GSAP: intro, reveals, counters, parallax ---------- */
  function initMotion() {
    window.__shdpReady = true; // cancels the head-script failsafe
    if (reduceMotion) return;
    // hero intro is pure CSS (see styles.css), so it never depends on this file loading

    // reveals: CSS transitions driven by IntersectionObserver (cheap, no rAF loop)
    const io = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach((e, i) => {
        e.target.style.setProperty("--d", (i * 0.08) + "s");
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    $$("[data-reveal]").forEach(el => io.observe(el));

    if (!window.gsap || !window.ScrollTrigger) return; // counters + parallax are optional extras
    gsap.registerPlugin(ScrollTrigger);

    $$("[data-count]").forEach(el => {
      const end = +el.dataset.count, suffix = el.dataset.suffix || "";
      const obj = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 90%", once: true,
        onEnter: () => gsap.to(obj, { v: end, duration: 1.8, ease: "expo.out", onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; } })
      });
    });

    gsap.to("[data-parallax]", { yPercent: 8, ease: "none", scrollTrigger: { trigger: ".vision", start: "top bottom", end: "bottom top", scrub: true } });  }

  // scripts are deferred, so CDN libraries are ready by now (or failed, and we skip)
  initHero3D();
  initMotion();
})();
