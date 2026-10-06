(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let lang = "en";

  // Run each module in isolation so one missing element or error can't stop the rest.
  function safe(name, fn) {
    try { return fn(); } catch (err) { console.error(`[shdp] ${name} failed:`, err); }
  }

  /* ---------- toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2800);
  }

  /* ---------- mobile drawer ---------- */
  const drawer = $("#drawer");
  const openBtn = $(".nav .menu-btn");
  let prevOverflow = "";
  const isDrawerOpen = () => !!drawer && drawer.classList.contains("is-open");
  const drawerFocusables = () => drawer ? $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer) : [];

  function setDrawer(open) {
    if (!drawer || open === isDrawerOpen()) return;
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    if (openBtn) openBtn.setAttribute("aria-expanded", String(open));
    // keep keyboard and screen-reader focus out of the page behind the drawer
    [$("#header"), $("#main"), $(".site-footer"), $(".fab")].forEach(el => {
      if (el) open ? el.setAttribute("inert", "") : el.removeAttribute("inert");
    });
    if (open) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const first = drawerFocusables()[0];
      if (first) first.focus({ preventScroll: true });
    } else {
      document.body.style.overflow = prevOverflow;
      if (openBtn) openBtn.focus({ preventScroll: true });
    }
  }

  safe("drawer", () => {
    if (!drawer) return;
    if (openBtn) openBtn.addEventListener("click", () => setDrawer(true));
    const closeBtn = $("[data-close]", drawer);
    if (closeBtn) closeBtn.addEventListener("click", () => setDrawer(false));
    $$("a", drawer).forEach(a => a.addEventListener("click", () => setDrawer(false)));
    document.addEventListener("keydown", e => {
      if (!isDrawerOpen()) return;
      if (e.key === "Escape") { setDrawer(false); return; }
      if (e.key !== "Tab") return;
      // focus trap (fallback for browsers without `inert`)
      const items = drawerFocusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });

  /* ---------- header: solid after hero, hide on scroll down ---------- */
  safe("header", () => {
    const header = $("#header");
    if (!header) return;
    let lastY = 0;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      header.classList.toggle("is-solid", y > 40);
      // CSS keeps it visible while it has keyboard focus (.site-header:focus-within)
      header.classList.toggle("is-hidden", y > 600 && y > lastY && !isDrawerOpen());
      lastY = y;
    }, { passive: true });
  });

  /* ---------- placeholder WhatsApp links ---------- */
  safe("whatsapp placeholders", () => {
    // checked at click time, so links filled in later from data/site.json just work
    $$("[data-wa-group]").forEach(a => a.addEventListener("click", e => {
      if (a.getAttribute("href") === "#") { e.preventDefault(); toast("WhatsApp group links coming soon"); }
    }));
  });

  /* ---------- site configuration (data/site.json) ----------
     [data-site-href="path.in.json"] sets href, [data-site-text="path"] sets text.
     null / missing values leave the existing HTML (placeholder) untouched. */
  safe("site config", () => {
    if (!window.SHDP_DATA) return;
    const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
    SHDP_DATA.getSite().then(site => {
      if (!site) return;
      $$("[data-site-href]").forEach(el => safe("site href", () => {
        const v = get(site, el.dataset.siteHref);
        if (typeof v !== "string" || !v.trim()) return;
        el.setAttribute("href", (el.dataset.sitePrefix || "") + v.trim());
        if (/^https?:/i.test(v)) { el.target = "_blank"; el.rel = "noopener"; }
      }));
      $$("[data-site-text]").forEach(el => safe("site text", () => {
        const v = get(site, el.dataset.siteText);
        if (typeof v === "string" && v.trim()) { el.textContent = v.trim(); el.classList.remove("todo"); }
      }));
    });
  });

  /* ---------- floating WhatsApp button: tuck away where it would duplicate or cover CTAs ---------- */
  safe("fab", () => {
    const fab = $(".fab");
    const targets = [$("#join .join-panel"), $(".site-footer")].filter(Boolean);
    if (!fab || !targets.length || !("IntersectionObserver" in window)) return;
    const showing = new Set();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? showing.add(e.target) : showing.delete(e.target));
      fab.classList.toggle("is-tucked", showing.size > 0);
    });
    targets.forEach(t => io.observe(t));
  });

  /* ---------- next Sunday date for Bala Chaitanya ---------- */
  safe("next sunday", () => {
    const day = $("[data-next-sunday-day]"), mon = $("[data-next-sunday-mon]"), dow = $("[data-next-sunday-dow]");
    if (!day) return;
    const d = new Date();
    const add = (7 - d.getDay()) % 7;
    d.setDate(d.getDate() + add);
    day.textContent = d.getDate();
    if (mon) mon.textContent = d.toLocaleString("en-IN", { month: "short" });
    if (dow) dow.textContent = add === 0 ? "Today" : "Sun";
  });
  safe("year", () => { const y = $("#year"); if (y) y.textContent = new Date().getFullYear(); });

  /* ---------- TV marquee: clone the group so the loop is seamless ---------- */
  safe("marquee", () => {
    const track = $(".tv-track");
    const group = track && $(".tv-group", track);
    if (!group || reduceMotion) return;
    let lastW = 0;
    function build() {
      const w = group.getBoundingClientRect().width;
      const view = track.parentElement.clientWidth;
      if (!w || (w === lastW && $$(".tv-group[data-clone]", track).length)) return;
      lastW = w;
      $$(".tv-group[data-clone]", track).forEach(n => n.remove());
      // enough copies to always fill the strip while the track slides by one group width
      const copies = Math.max(1, Math.ceil(view / w));
      for (let i = 0; i < copies; i++) {
        const c = group.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        c.dataset.clone = "";
        track.appendChild(c);
      }
      track.style.setProperty("--loop-w", w + "px");
    }
    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(build, 200); });
  });

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
  const progStage = $(".prog-stage");
  let progIndex = 0;

  function renderProgList() {
    if (!progList) return;
    progList.innerHTML = programmes.map((p, i) => `
      <li class="prog-item" role="presentation">
        <button class="prog-btn" role="tab" id="prog-tab-${i}" aria-selected="${i === progIndex}" aria-controls="prog-panel" tabindex="${i === progIndex ? 0 : -1}" data-i="${i}">
          <span><span class="name">${lang === "te" ? p.te : p.name}</span><span class="when">${lang === "te" ? p.whenTe : p.when}</span></span>
          <svg class="icon"><use href="#i-arrow"/></svg>
        </button>
      </li>`).join("");
  }
  function renderProgPanel() {
    if (!progPanel) return;
    const p = programmes[progIndex];
    if (progMedia) $$("img", progMedia).forEach((img, i) => img.classList.toggle("is-out", i !== progIndex));
    progPanel.setAttribute("aria-labelledby", `prog-tab-${progIndex}`);
    progPanel.innerHTML = `
      <h3>${lang === "te" ? p.te : p.name}</h3>
      <p>${lang === "te" ? p.bodyTe : p.body}</p>
      <dl>${p.meta.map(([k, v]) => `<div><dt>${lang === "te" ? metaTe[k] : k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
    if (!reduceMotion && window.gsap) gsap.from(progPanel.children, { y: 14, opacity: 0, duration: 0.5, stagger: 0.06, ease: "expo.out" });
  }
  function selectProg(i, focus) {
    if (i === progIndex || !progList) return;
    progIndex = (i + programmes.length) % programmes.length;
    $$(".prog-btn", progList).forEach((b, j) => { b.setAttribute("aria-selected", j === progIndex); b.tabIndex = j === progIndex ? 0 : -1; });
    if (focus) $$(".prog-btn", progList)[progIndex].focus();
    renderProgPanel();
  }
  // On the single-column layout the stage sits above the list: bring it into view after a tap
  function revealProgStage() {
    if (!progStage || !window.matchMedia("(max-width: 960px)").matches) return;
    const r = progStage.getBoundingClientRect();
    if (r.top < 90 || r.top > window.innerHeight * 0.6) {
      progStage.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  safe("programmes", () => {
    if (!progList || !progPanel) return;
    if (progMedia) programmes.forEach((p, i) => {
      const img = new Image();
      img.src = p.img; img.alt = ""; img.loading = "lazy";
      img.style.objectPosition = p.pos;
      if (i !== 0) img.classList.add("is-out");
      progMedia.appendChild(img);
    });
    progList.addEventListener("click", e => {
      const b = e.target.closest(".prog-btn");
      if (!b) return;
      selectProg(+b.dataset.i);
      revealProgStage();
    });
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
  });

  /* ---------- timeline arrows + track length ---------- */
  const timeline = $("#timeline");
  const sizeTrack = () => { if (timeline) timeline.style.setProperty("--track-w", timeline.scrollWidth + "px"); };
  safe("timeline", () => {
    if (!timeline) return;
    sizeTrack(); window.addEventListener("resize", sizeTrack);
    $$("[data-scroll]").forEach(b => b.addEventListener("click", () => {
      timeline.scrollBy({ left: +b.dataset.scroll * (timeline.clientWidth * 0.8), behavior: reduceMotion ? "auto" : "smooth" });
    }));
  });

  /* ---------- shloka: share link + downloadable status card ---------- */
  const textOf = sel => { const el = $(sel); return el && !el.hidden ? el.textContent.replace(/\s+/g, " ").trim() : ""; };
  function shareText() {
    const head = [textOf("#shloka-text"), textOf("#shloka-translit")].filter(Boolean).join("\n");
    return [head, textOf("#shloka-meaning"), textOf("#shloka-source"), "Sri Haritha Dharma Parishad"].filter(Boolean).join("\n\n");
  }

  /* ---------- quote of the day (data/quotes.json) ----------
     The shloka already in the HTML is the built-in fallback, used until (or if never)
     the JSON loads. Share link and status card always read what is displayed. */
  let currentQuote = null;
  safe("quote fallback", () => {
    currentQuote = {
      id: "built-in",
      shloka: { sa: textOf("#shloka-text") || null },
      transliteration: textOf("#shloka-translit") || null,
      meaning: { en: textOf("#shloka-meaning") || null, te: (window.SHDP_TE || {})["shloka.meaning"] || null },
      source: null
    };
  });
  // bilingual field -> text for the current language, falling back to English
  const pickLang = f => (f == null ? null : typeof f === "string" ? f : (f[lang] || f.en || f.te || null));
  function renderQuote() {
    const q = currentQuote, st = $("#shloka-text");
    if (!q || !st) return;
    const s = q.shloka || {};
    const useTe = lang === "te" && s.te, useEn = lang === "en" && s.en;
    st.textContent = useTe ? s.te : useEn ? s.en : (s.sa || s.te || s.en || "");
    st.lang = useTe ? "te" : useEn ? "en" : s.sa ? "sa" : s.te ? "te" : "en";
    const setText = (sel, v) => { const el = $(sel); if (!el) return; el.textContent = v || ""; el.hidden = !v; };
    setText("#shloka-translit", q.transliteration);
    setText("#shloka-meaning", pickLang(q.meaning));
    setText("#shloka-source", pickLang(q.source));
    updateShareLink();
  }
  safe("quote of the day", () => {
    if (!window.SHDP_DATA) return;
    SHDP_DATA.getQuotes().then(quotes => {
      if (!quotes) return; // load failure is already logged by the data layer
      const q = SHDP_DATA.pickQuote(quotes, SHDP_DATA.todayISO());
      if (!q) { console.warn("[shdp] quotes.json has no published quote for today; showing the built-in shloka."); return; }
      currentQuote = q;
      safe("render quote", renderQuote);
    });
  });
  // Built eagerly (and on language change) so long-press / open-in-new-tab also work
  function updateShareLink() {
    const a = $("#share-shloka");
    if (a) a.href = "https://wa.me/?text=" + encodeURIComponent(shareText());
  }

  // Split text into lines that fit maxW. Words wider than a line are broken by grapheme
  // (Intl.Segmenter keeps Devanagari/Telugu conjuncts intact).
  function wrapLines(g, text, maxW) {
    const graphemes = s => (window.Intl && Intl.Segmenter)
      ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].map(x => x.segment)
      : Array.from(s);
    const lines = [];
    let line = "";
    for (const word of text.split(" ").filter(Boolean)) {
      const test = line ? line + " " + word : word;
      if (g.measureText(test).width <= maxW) { line = test; continue; }
      if (line) lines.push(line);
      if (g.measureText(word).width <= maxW) { line = word; continue; }
      line = "";
      for (const ch of graphemes(word)) {
        if (line && g.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
        else line += ch;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  // Pick the largest font size (from `sizes`) whose wrapped block fits maxLines
  function fitLines(g, text, fontFor, sizes, maxW, maxLines) {
    let lines = [], size = sizes[sizes.length - 1];
    for (const s of sizes) {
      g.font = fontFor(s);
      lines = wrapLines(g, text, maxW);
      size = s;
      if (lines.length <= maxLines) break;
    }
    return { lines, size };
  }

  async function downloadCard() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const W = 1080, H = 1920, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const cy = H * 0.4;
    const bg = g.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.45, H * 0.8);
    bg.addColorStop(0, "#2a6338"); bg.addColorStop(0.55, "#102a1a"); bg.addColorStop(1, "#0b2014");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // halo
    const halo = g.createRadialGradient(W / 2, cy, 0, W / 2, cy, 460);
    halo.addColorStop(0, "rgba(233,133,44,0.35)"); halo.addColorStop(1, "rgba(233,133,44,0)");
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(226,183,100,0.6)"; g.lineWidth = 2;
    g.beginPath(); g.arc(W / 2, cy, 380, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(W / 2, cy, 400, 0, Math.PI * 2); g.stroke();
    g.textAlign = "center";
    g.fillStyle = "#e2b764"; g.font = "600 34px Mukta";
    g.fillText(lang === "te" ? "నేటి శ్లోకం" : "SHLOKA OF THE DAY", W / 2, 300);

    // shloka: wrapped and vertically centred inside the halo circle, shrinking for long verses
    const shloka = fitLines(g, textOf("#shloka-text"), s => `${s}px 'Tiro Devanagari Sanskrit', 'Noto Sans Telugu', Mukta`, [112, 100, 88, 76, 66, 58], 640, 4);
    const shLh = shloka.size * 1.25;
    g.fillStyle = "#fbf6e8"; g.textBaseline = "middle";
    shloka.lines.forEach((ln, i) => g.fillText(ln, W / 2, cy + (i - (shloka.lines.length - 1) / 2) * shLh));
    g.textBaseline = "alphabetic";

    // transliteration + meaning share the band between the circle and the logo.
    // Short texts keep the original positions/sizes; longer ones scale down together to fit.
    const trText = textOf("#shloka-translit"), meText = textOf("#shloka-meaning");
    const meBase = lang === "te" ? 46 : 48;
    const meaningFont = s => lang === "te" ? `${s}px 'Noto Sans Telugu'` : `${s}px Mukta`;
    const bandTop = cy + 460, preferredTop = cy + 520, bandBottom = H - 400; // first / last baselines
    let tr, me, trSize, meSize, span;
    for (const k of [1, 0.9, 0.8, 0.72, 0.65, 0.58]) {
      trSize = Math.round(44 * k); meSize = Math.round(meBase * k);
      g.font = `italic ${trSize}px Mukta`; tr = wrapLines(g, trText, 900);
      g.font = meaningFont(meSize); me = wrapLines(g, meText, 880);
      span = Math.max(0, tr.length - 1) * trSize * 1.3 + (tr.length ? 120 * k : 0) + Math.max(0, me.length - 1) * meSize * 1.45;
      if (bandTop + span <= bandBottom) break;
    }
    let y = Math.max(bandTop, Math.min(preferredTop, bandBottom - span));
    g.font = `italic ${trSize}px Mukta`; g.fillStyle = "#e2b764";
    tr.forEach((ln, i) => g.fillText(ln, W / 2, y + i * trSize * 1.3));
    if (tr.length) y += (tr.length - 1) * trSize * 1.3 + 120 * (trSize / 44);
    g.font = meaningFont(meSize); g.fillStyle = "#c3cdbf";
    me.forEach((ln, i) => g.fillText(ln, W / 2, y + i * meSize * 1.45));

    const logo = $(".brand img");
    try {
      g.save(); g.beginPath(); g.arc(W / 2, H - 290, 70, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.clip();
      g.drawImage(logo, W / 2 - 66, H - 356, 132, 132); g.restore();
    } catch (_) { g.restore(); /* logo optional */ }
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
  }

  safe("shloka", () => {
    updateShareLink();
    const btn = $("#download-card");
    if (btn) btn.addEventListener("click", () => { downloadCard().catch(err => console.error("[shdp] status card failed:", err)); });
  });

  /* ---------- language toggle ---------- */
  const TE = window.SHDP_TE || {};
  const enText = new Map();
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
    safe("programmes (lang)", () => { renderProgList(); renderProgPanel(); });
    sizeTrack();
    safe("render quote (lang)", renderQuote); // also refreshes the share link
    try { localStorage.setItem("shdp-lang", next); } catch (_) {}
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  safe("language", () => {
    $$("[data-i18n]").forEach(el => enText.set(el, el.textContent));
    $$("[data-i18n-html]").forEach(el => enText.set(el, el.innerHTML));
    $$(".lang-toggle button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
    try { if (localStorage.getItem("shdp-lang") === "te") setLang("te"); } catch (_) {}
  });

  /* ---------- Three.js: rising diya embers + a slow sacred ring ---------- */
  function initHero3D() {
    const canvas = $("#hero-canvas");
    const archEl = $("[data-hero-visual] .arch");
    if (!window.THREE || !canvas || !archEl) return;
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
      const visual = archEl.getBoundingClientRect();
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

    if ($("[data-parallax]")) gsap.to("[data-parallax]", { yPercent: 8, ease: "none", scrollTrigger: { trigger: ".vision", start: "top bottom", end: "bottom top", scrub: true } });
  }

  // scripts are deferred, so CDN libraries are ready by now (or failed, and we skip)
  safe("hero 3d", initHero3D);
  safe("motion", () => {
    try { initMotion(); }
    catch (err) {
      // never leave [data-reveal] content hidden if motion setup breaks
      document.documentElement.classList.remove("motion-ok");
      throw err;
    }
  });
})();
