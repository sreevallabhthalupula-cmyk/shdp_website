/* SHDP core: shared helpers used by every module.
   Exposes one namespace, window.SHDP. Everything here is defensive: a missing element
   or bad value returns null / does nothing instead of throwing. */
(() => {
  const $ = (s, el = document) => (el ? el.querySelector(s) : null);
  const $$ = (s, el = document) => (el ? [...el.querySelectorAll(s)] : []);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safe(name, fn) {
    try { return fn(); } catch (err) { console.error(`[shdp] ${name} failed:`, err); }
  }

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ESC[c]);

  /* ---------- language ---------- */
  let lang = "en";
  const listeners = new Set();
  const TE = () => window.SHDP_TE || {};
  // UI string: Telugu from js/i18n.js when available, otherwise the English default
  const t = (key, en) => (lang === "te" && TE()[key]) || en;
  // bilingual content field {en, te} -> current language, falling back to English
  const pick = f => (f == null ? null : typeof f === "string" ? f : (f[lang] || f.en || f.te || f.sa || null));
  // which language a picked value is actually in (for the lang attribute)
  const pickLangCode = f => (f && typeof f === "object" && f[lang] ? lang : (f && f.en ? "en" : f && f.te ? "te" : lang));

  /* ---------- URLs ---------- */
  // Only allow real, safe link targets. Anything else returns null so the button is hidden.
  function safeUrl(u, { allowRelative = true } = {}) {
    if (typeof u !== "string") return null;
    const v = u.trim();
    if (!v || v === "#") return null;
    if (/^(https?:|mailto:|tel:)/i.test(v)) {
      try { if (/^https?:/i.test(v)) new URL(v); return v; } catch (_) { return null; }
    }
    if (allowRelative && /^(\/|\.\/|assets\/|data\/|#[\w-])/.test(v) && !/^\/\//.test(v)) return v;
    return null;
  }
  const isExternal = u => /^https?:/i.test(u || "");

  /* ---------- dates (the trust's calendar is India time) ---------- */
  const TZ = "Asia/Kolkata";
  function todayISO() {
    if (window.SHDP_DATA && SHDP_DATA.todayISO) return SHDP_DATA.todayISO();
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  const isISODate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
  const isTime = s => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const locale = () => (lang === "te" ? "te-IN" : "en-IN");
  // format a YYYY-MM-DD (or YYYY-MM / YYYY) for display in the current language
  function formatDate(iso, opts) {
    if (typeof iso !== "string") return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y) return "";
    const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
    const o = opts || (d ? { day: "numeric", month: "short", year: "numeric" } : m ? { month: "short", year: "numeric" } : { year: "numeric" });
    try { return new Intl.DateTimeFormat(locale(), { timeZone: "UTC", ...o }).format(date); } catch (_) { return iso; }
  }
  function formatTime(hhmm) {
    if (!isTime(hhmm)) return "";
    const [h, m] = hhmm.split(":").map(Number);
    try { return new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, h, m))); }
    catch (_) { return hhmm; }
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2800);
  }

  /* ---------- dialogs (native <dialog>, focus restored on close) ---------- */
  function openDialog(dlg, opener) {
    if (!dlg) return;
    dlg._opener = opener || document.activeElement;
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute("open", "");
    document.documentElement.classList.add("has-dialog");
  }
  function closeDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === "function" && dlg.open) dlg.close();
    else dlg.removeAttribute("open");
  }
  // shared wiring for every dialog: close buttons, backdrop click, focus return
  function wireDialog(dlg) {
    if (!dlg || dlg._wired) return;
    dlg._wired = true;
    dlg.addEventListener("click", e => {
      if (e.target.closest("[data-dialog-close]")) closeDialog(dlg);
      else if (e.target === dlg) closeDialog(dlg); // click on the backdrop
    });
    dlg.addEventListener("close", () => {
      if (!$$("dialog[open]").length) document.documentElement.classList.remove("has-dialog");
      const o = dlg._opener;
      if (o && document.contains(o) && typeof o.focus === "function") o.focus({ preventScroll: true });
    });
  }

  /* ---------- site configuration ---------- */
  const getPath = (obj, path) => String(path || "").split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  let site = null;
  const siteReady = (window.SHDP_DATA ? SHDP_DATA.getSite() : Promise.resolve(null)).then(s => (site = s));

  // Base URL for share links: configured production URL, else the current page.
  function pageUrl(hash) {
    const base = (site && safeUrl(getPath(site, "links.custom_domain"))) || (site && safeUrl(getPath(site, "links.website_url"))) || (location.origin + location.pathname);
    return base.replace(/#.*$/, "") + (hash ? "#" + String(hash).replace(/^#/, "") : "");
  }

  window.SHDP = {
    $, $$, safe, esc, reduceMotion,
    get lang() { return lang; },
    setLangState(next) { lang = next === "te" ? "te" : "en"; listeners.forEach(fn => safe("lang listener", () => fn(lang))); },
    onLang(fn) { listeners.add(fn); },
    t, pick, pickLangCode, safeUrl, isExternal,
    TZ, todayISO, isISODate, isTime, formatDate, formatTime,
    toast, openDialog, closeDialog, wireDialog,
    getPath, siteReady, get site() { return site; }, pageUrl
  };
})();
