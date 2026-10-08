/* SHDP page shell: drawer, header, FAB, marquee, quote of the day + status card,
   site configuration (contact / join), language switching, nav highlighting,
   Three.js hero, GSAP motion, service worker. Content sections live in their own
   modules (events.js, programmes.js, timeline.js, media.js, books.js, search.js). */
(() => {
  const S = window.SHDP;
  if (!S) { console.error("[shdp] core.js did not load"); document.documentElement.classList.remove("motion-ok"); return; }
  const { $, $$, safe, esc, t, pick, reduceMotion, toast } = S;
  const lang = () => S.lang;

  /* ---------- mobile drawer ---------- */
  const drawer = $("#drawer");
  const openBtn = $(".nav .menu-btn");
  let prevOverflow = "";
  const isDrawerOpen = () => !!drawer && drawer.classList.contains("is-open");
  const drawerFocusables = () => drawer ? $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer).filter(el => !el.closest("[hidden]")) : [];

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
    drawer.addEventListener("click", e => { if (e.target.closest("a, [data-search-open]")) setDrawer(false); });
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

  /* ---------- nav: mark the section in view (aria-current) ---------- */
  safe("nav current", () => {
    const links = $$('.nav-links a[href^="#"], .drawer a[href^="#"]');
    const ids = [...new Set(links.map(a => a.getAttribute("href").slice(1)))];
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (!sections.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => (a.getAttribute("href") === "#" + e.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(s => io.observe(s));
  });

  /* ---------- site configuration: contact, social, join (data/site.json) ----------
     [data-site-href="path"]  sets href (+ data-site-prefix); hidden when the value is missing
                              if the element is marked data-site-optional.
     [data-site-text="path"]  sets text.
     [data-site-show="path"]  element stays hidden unless the value exists. */
  function applySite(site) {
    const get = p => S.getPath(site, p);
    $$("[data-site-href]").forEach(el => safe("site href", () => {
      const raw = get(el.dataset.siteHref);
      const url = typeof raw === "string" && raw.trim() ? S.safeUrl((el.dataset.sitePrefix || "") + raw.trim()) : null;
      if (url) {
        el.setAttribute("href", url);
        if (S.isExternal(url)) { el.target = "_blank"; el.rel = "noopener"; }
        el.hidden = false;
      } else if (el.hasAttribute("data-site-optional")) {
        el.hidden = true;
      }
    }));
    $$("[data-site-text]").forEach(el => safe("site text", () => {
      const v = get(el.dataset.siteText);
      const s = v && typeof v === "object" ? pick(v) : v;
      if (typeof s === "string" && s.trim()) el.textContent = s.trim();
    }));
    $$("[data-site-show]").forEach(el => { const v = get(el.dataset.siteShow); el.hidden = !(v && (typeof v !== "object" || pick(v))); });

    // phone -> tel:, address -> Google Maps
    const phone = get("contact.phone");
    $$("[data-contact-phone]").forEach(a => { if (typeof phone === "string" && phone.trim()) { a.href = "tel:" + phone.replace(/[^\d+]/g, ""); a.textContent = phone.trim(); } });
    const addr = pick(get("contact.address"));
    const maps = S.safeUrl(get("contact.maps_url")) || (addr ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr) : null);
    $$("[data-contact-address]").forEach(a => { if (addr && maps) { a.href = maps; a.textContent = addr; a.target = "_blank"; a.rel = "noopener"; } });

    // WhatsApp groups: show only groups with real invite links; otherwise a clear fallback
    const groups = get("whatsapp.groups") || {};
    let anyGroup = false;
    $$("[data-wa-group-id]").forEach(li => {
      const url = S.safeUrl(groups[li.dataset.waGroupId] && groups[li.dataset.waGroupId].url);
      const a = $("a", li);
      if (url && a) { a.href = url; a.target = "_blank"; a.rel = "noopener"; li.hidden = false; anyGroup = true; }
      else li.hidden = true;
    });
    const groupsList = $("#wa-groups"), groupsFallback = $("#wa-groups-fallback");
    if (groupsList) groupsList.hidden = !anyGroup;
    if (groupsFallback) groupsFallback.hidden = anyGroup;

    // FAB: WhatsApp community if configured, else the Join section
    const fab = $(".fab"), community = S.safeUrl(get("whatsapp.community_url"));
    if (fab && community) { fab.href = community; fab.target = "_blank"; fab.rel = "noopener"; }

    updateJoinLinks(site);
  }

  // Volunteer / seva / donation actions: real form or link first, then a prefilled email
  function mailto(subject, body) {
    const email = S.site && S.getPath(S.site, "contact.email");
    return typeof email === "string" && email.includes("@") ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
  }
  function updateJoinLinks(site) {
    if (!site) return;
    const get = p => S.getPath(site, p);
    const vol = $("#volunteer-link");
    if (vol) {
      const url = S.safeUrl(get("join.volunteer_url")) || S.safeUrl(get("join.google_form_url")) ||
        mailto(t("join.mailSubject", "Volunteer / seva enquiry"), t("join.mailBody", "Namaskaram,\n\nI would like to help with seva.\n\nName:\nCity / area:\nHow I can help (teaching, annadana, goshala, media):\nWhen I am free:\n"));
      if (url) { vol.href = url; vol.hidden = false; if (S.isExternal(url)) { vol.target = "_blank"; vol.rel = "noopener"; } } else vol.hidden = true;
    }
    const join = $("#join-email-link");
    if (join) {
      const url = mailto(t("join.groupSubject", "Please add me to a WhatsApp group"), t("join.groupBody", "Namaskaram,\n\nPlease add me to an SHDP WhatsApp group.\n\nName:\nWhatsApp number:\nGroup (parents / youth / Hyderabad seva):\n"));
      if (url) { join.href = url; join.hidden = false; } else join.hidden = true;
    }
    const give = $("#give-link");
    if (give) {
      const url = S.safeUrl(get("join.donation_details_url")) || mailto(t("join.giveSubject", "Supporting SHDP"), t("join.giveBody", "Namaskaram,\n\nI would like to support the Parishad. Please share the bank / UPI details.\n"));
      if (url) { give.href = url; give.hidden = false; } else give.hidden = true;
    }
  }
  S.siteReady.then(site => { if (site) safe("site config", () => applySite(site)); });

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
    targets.forEach(x => io.observe(x));
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
    let tm;
    window.addEventListener("resize", () => { clearTimeout(tm); tm = setTimeout(build, 200); });
  });

  /* ---------- quote of the day (data/quotes.json) ----------
     The shloka already in the HTML is the built-in fallback, used until (or if never)
     the JSON loads. Share link, copy and status card always read what is displayed. */
  const textOf = sel => { const el = $(sel); return el && !el.hidden ? el.textContent.replace(/\s+/g, " ").trim() : ""; };
  const quoteText = () => {
    const head = [textOf("#shloka-text"), textOf("#shloka-translit")].filter(Boolean).join("\n");
    return [head, textOf("#shloka-meaning"), textOf("#shloka-source")].filter(Boolean).join("\n\n");
  };
  const shareText = () => quoteText() + "\n\nSri Haritha Dharma Parishad";

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
  function renderQuote() {
    const q = currentQuote, st = $("#shloka-text");
    if (!q || !st) return;
    const s = q.shloka || {};
    const useTe = lang() === "te" && s.te, useEn = lang() === "en" && s.en;
    st.textContent = useTe ? s.te : useEn ? s.en : (s.sa || s.te || s.en || "");
    st.lang = useTe ? "te" : useEn ? "en" : s.sa ? "sa" : s.te ? "te" : "en";
    const setText = (sel, v) => { const el = $(sel); if (!el) return; el.textContent = v || ""; el.hidden = !v; };
    setText("#shloka-translit", q.transliteration);
    setText("#shloka-meaning", pick(q.meaning));
    setText("#shloka-source", pick(q.source) ? "— " + pick(q.source) : null);
    updateShareLink();
  }
  // Built eagerly (and on language change) so long-press / open-in-new-tab also work
  function updateShareLink() {
    const a = $("#share-shloka");
    if (a) a.href = "https://wa.me/?text=" + encodeURIComponent(shareText());
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
  // show a specific published quote (used by search)
  S.quote = {
    show(id) {
      if (!window.SHDP_DATA) return;
      SHDP_DATA.getQuotes().then(qs => { const q = (qs || []).find(x => x && x.id === id && x.status === "published"); if (q) { currentQuote = q; renderQuote(); } });
    }
  };

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

  async function drawCard() {
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
    g.fillStyle = "#e2b764"; g.font = "600 34px Mukta, 'Noto Sans Telugu'";
    g.fillText(lang() === "te" ? "నేటి శ్లోకం" : "SHLOKA OF THE DAY", W / 2, 300);

    // shloka: wrapped and vertically centred inside the halo circle, shrinking for long verses
    const shloka = fitLines(g, textOf("#shloka-text"), s => `${s}px 'Tiro Devanagari Sanskrit', 'Noto Sans Telugu', Mukta`, [112, 100, 88, 76, 66, 58], 640, 4);
    const shLh = shloka.size * 1.25;
    g.fillStyle = "#fbf6e8"; g.textBaseline = "middle";
    shloka.lines.forEach((ln, i) => g.fillText(ln, W / 2, cy + (i - (shloka.lines.length - 1) / 2) * shLh));
    g.textBaseline = "alphabetic";

    // transliteration + meaning (+ source) share the band between the circle and the logo.
    // Short texts keep the original positions/sizes; longer ones scale down together to fit.
    const trText = textOf("#shloka-translit"), meText = [textOf("#shloka-meaning"), textOf("#shloka-source")].filter(Boolean).join(" ");
    const meBase = lang() === "te" ? 46 : 48;
    const meaningFont = s => lang() === "te" ? `${s}px 'Noto Sans Telugu', Mukta` : `${s}px Mukta, 'Noto Sans Telugu'`;
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
    return c;
  }

  // Phones that can share files get the native share sheet (WhatsApp status, save image);
  // everything else downloads the PNG.
  async function cardAction() {
    const c = await drawCard();
    const name = "shdp-shloka-of-the-day.png";
    const blob = await new Promise(res => { try { c.toBlob(res, "image/png"); } catch (_) { res(null); } });
    if (blob && window.File && navigator.canShare) {
      try {
        const file = new File([blob], name, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: t("shloka.label", "Shloka of the day") }); return; }
      } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try {
      const a = document.createElement("a");
      a.download = name;
      a.href = blob ? URL.createObjectURL(blob) : c.toDataURL("image/png");
      a.click();
      if (blob) setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast(t("toast.cardDownloaded", "Status card downloaded"));
    } catch (_) {
      toast(t("toast.cardFailed", "Open the site from a web server to download the card"));
    }
  }

  safe("shloka", () => {
    updateShareLink();
    const dl = $("#download-card");
    if (dl) dl.addEventListener("click", () => { cardAction().catch(err => console.error("[shdp] status card failed:", err)); });
    const nat = $("#share-shloka-native");
    if (nat) nat.addEventListener("click", () => { if (S.share) S.share.share({ title: t("shloka.label", "Shloka of the day"), text: shareText(), url: "#shloka" }, nat); });
    const cp = $("#copy-shloka");
    if (cp) cp.addEventListener("click", () => {
      const done = ok => toast(ok ? t("toast.textCopied", "Shloka copied") : t("toast.copyFailed", "Couldn't copy. Please select the text instead."));
      if (S.share) S.share.copy(shareText()).then(done); else done(false);
    });
  });

  /* ---------- language toggle ---------- */
  const TE = window.SHDP_TE || {};
  const enText = new Map();
  function setLang(next) {
    next = next === "te" ? "te" : "en";
    document.documentElement.lang = next;
    $$("[data-i18n]").forEach(el => {
      const v = next === "te" ? TE[el.dataset.i18n] : enText.get(el);
      if (v) el.textContent = v;
    });
    $$("[data-i18n-html]").forEach(el => {
      const v = next === "te" ? TE[el.dataset.i18nHtml] : enText.get(el);
      if (v) el.innerHTML = v;
    });
    $$("[data-i18n-attr]").forEach(el => {
      // data-i18n-attr="aria-label:key;placeholder:key2"
      el.dataset.i18nAttr.split(";").forEach(pair => {
        const [attr, key] = pair.split(":").map(s => s && s.trim());
        if (!attr || !key) return;
        const store = "en_" + attr.replace(/-/g, "_");
        if (!(store in el.dataset)) el.dataset[store] = el.getAttribute(attr) || "";
        const v = next === "te" ? TE[key] : el.dataset[store];
        if (v) el.setAttribute(attr, v);
      });
    });
    $$(".lang-toggle button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === next)));
    S.setLangState(next);            // modules re-render their own content
    safe("render quote (lang)", renderQuote); // also refreshes the share link
    if (S.site) safe("join links (lang)", () => updateJoinLinks(S.site));
    try { localStorage.setItem("shdp-lang", next); } catch (_) {}
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  safe("language", () => {
    $$("[data-i18n]").forEach(el => enText.set(el, el.textContent));
    $$("[data-i18n-html]").forEach(el => enText.set(el, el.innerHTML));
    $$(".lang-toggle button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
    let saved = null;
    try { saved = localStorage.getItem("shdp-lang"); } catch (_) {}
    if (saved === "te") setLang("te");
  });

  /* ---------- Three.js: rising diya embers + a slow sacred ring ---------- */
  function initHero3D() {
    const canvas = $("#hero-canvas");
    const archEl = $("[data-hero-visual] .arch");
    if (!window.THREE || !canvas || !archEl) return;
    const small = window.innerWidth < 700;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    let renderer;
    // at high pixel ratios antialiasing on soft points is invisible but costly
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: dpr < 2, powerPreference: "low-power" }); }
    catch (_) { return; }
    renderer.setPixelRatio(dpr);
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

    const COUNT = small ? 140 : 320;
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

    let lastW = 0, lastH = 0;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // centre the ring behind the portrait (right column on desktop, lower on mobile)
      const visual = archEl.getBoundingClientRect();
      const hero = canvas.getBoundingClientRect();
      const cx = ((visual.left + visual.width / 2 - hero.left) / w) * 2 - 1;
      const cy = -(((visual.top + visual.height * 0.42 - hero.top) / h) * 2 - 1);
      const v = new THREE.Vector3(cx, cy, 0.5).unproject(camera).sub(camera.position).normalize();
      const tt = -camera.position.z / v.z;
      ringGroup.position.copy(camera.position).add(v.multiplyScalar(tt));
      // size the ring in pixels relative to the portrait, then convert to world units
      const worldPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / h;
      ringGroup.scale.setScalar((visual.width * 0.66 * worldPerPx) / 6.2);
      if (!running) renderer.render(scene, camera);
    }
    // ignore mobile address-bar height jitter; only react to real size changes, debounced
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w !== lastW || Math.abs(h - lastH) > 120) resize();
      }, 150);
    });

    let mx = 0, my = 0;
    window.addEventListener("pointermove", e => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });

    const clock = new THREE.Clock();
    let running = false, raf = 0, inView = true;
    function frame() {
      raf = requestAnimationFrame(frame);
      const tt = clock.getElapsedTime();
      const p = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        p[i * 3 + 1] += speed[i];
        p[i * 3] += Math.sin(tt * 0.6 + drift[i]) * 0.004;
        if (p[i * 3 + 1] > 9) { p[i * 3 + 1] = -9; p[i * 3] = (Math.random() - 0.5) * 30; }
      }
      geo.attributes.position.needsUpdate = true;
      ringGroup.rotation.z = tt * 0.05;
      ring2.rotation.z = -tt * 0.08;
      mat.opacity = 0.7 + Math.sin(tt * 1.3) * 0.15;
      camera.position.x += (mx * 1.2 - camera.position.x) * 0.03;
      camera.position.y += (-my * 0.8 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    // the loop runs only while the hero is on screen and the tab is visible
    function update() {
      const should = !reduceMotion && inView && document.visibilityState === "visible";
      if (should && !running) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; update(); }).observe(canvas);
    document.addEventListener("visibilitychange", update);

    resize();
    setTimeout(resize, 1700); // re-measure once the intro animation has settled
    if (reduceMotion) renderer.render(scene, camera); else update();
  }

  /* ---------- motion: reveals (IntersectionObserver), GSAP counters + parallax ---------- */
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

  /* ---------- anchor links (#books, #guidance...): re-settle once data-driven sections above have rendered ---------- */
  safe("hash settle", () => {
    const id = location.hash.slice(1);
    if (!id || !/^[\w-]+$/.test(id) || /^(event|programme|milestone|book|video|album)-/.test(id) || !window.SHDP_DATA) return;
    let moved = false;
    const mark = () => { moved = true; };
    ["wheel", "touchstart", "keydown"].forEach(ev => window.addEventListener(ev, mark, { passive: true, once: true }));
    const D = SHDP_DATA;
    Promise.all([D.getEvents(), D.getProgrammes(), D.getTimeline(), D.getVideos(), D.getBooks(), D.getGallery()]).then(() => setTimeout(() => {
      const el = document.getElementById(id);
      if (!moved && el) el.scrollIntoView({ block: "start" });
    }, 120));
  });

  /* ---------- service worker (offline shell + installable app) ---------- */
  safe("service worker", () => {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(err => console.warn("[shdp] service worker not registered:", err.message));
    });
  });

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
