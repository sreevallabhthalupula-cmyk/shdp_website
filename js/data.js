/* SHDP data access layer.
   Every part of the site reads content through these functions only, so the source
   can later change (local JSON today, Supabase tomorrow) without touching the UI code.
   All functions return Promises and never throw: on failure they resolve to null
   and log one console error, so callers can keep their built-in fallback content. */
(() => {
  const cache = new Map();

  function loadJSON(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path, { headers: { Accept: "application/json" } })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          return res.json();
        })
        .catch(err => {
          // logged once per file: every module asking for the same file shares this result
          console.error(`[shdp] Could not load ${path}: ${err.message}. Using built-in fallback content.`);
          return null;
        }));
    }
    return cache.get(path);
  }

  // Today's date in India time as YYYY-MM-DD (the trust's calendar day for every visitor).
  // `?quoteDate=YYYY-MM-DD` in the page URL overrides it, for previewing scheduled content.
  function todayISO() {
    const override = new URLSearchParams(location.search).get("quoteDate");
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  const isPublishedQuote = q => q && q.status === "published" && q.shloka && (q.shloka.sa || q.shloka.te || q.shloka.en);

  // Pick the quote for a date: an exact date match first, otherwise a deterministic
  // fallback from undated / past-dated quotes (same date => same quote, no randomness).
  function pickQuote(quotes, dateISO) {
    const published = (Array.isArray(quotes) ? quotes : []).filter(isPublishedQuote);
    if (!published.length) return null;
    const exact = published.find(q => q.date === dateISO);
    if (exact) return exact;
    // never reveal a future-scheduled quote early; with nothing eligible the page keeps its built-in shloka
    const pool = published.filter(q => !q.date || q.date < dateISO)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (!pool.length) return null;
    const dayNumber = Math.floor(Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10)) / 86400000);
    return pool[((dayNumber % pool.length) + pool.length) % pool.length];
  }

  // Read one collection: drop records without an id, drop drafts, warn about duplicate ids.
  function collection(path, key, { publishedOnly = true } = {}) {
    return loadJSON(path).then(d => {
      if (!d) return null;
      const list = Array.isArray(d[key]) ? d[key] : null;
      if (!list) { console.error(`[shdp] ${path}: expected an array "${key}".`); return null; }
      const seen = new Set();
      return list.filter(item => {
        if (!item || typeof item !== "object" || !item.id) { console.warn(`[shdp] ${path}: skipped an entry without an id.`); return false; }
        if (seen.has(item.id)) { console.warn(`[shdp] ${path}: duplicate id "${item.id}" skipped.`); return false; }
        seen.add(item.id);
        return !publishedOnly || !item.status || item.status === "published";
      });
    });
  }

  window.SHDP_DATA = {
    loadJSON,
    todayISO,
    pickQuote,
    getSite: () => loadJSON("data/site.json"),
    getQuotes: () => loadJSON("data/quotes.json").then(d => (d && Array.isArray(d.quotes) ? d.quotes : null)),
    getQuoteForDate: date => window.SHDP_DATA.getQuotes().then(qs => (qs ? pickQuote(qs, date || todayISO()) : null)),
    getEvents: () => collection("data/events.json", "events"),
    getProgrammes: () => collection("data/programmes.json", "programmes"),
    getVideos: () => collection("data/videos.json", "videos"),
    // Pravachanalu categories (Students, Youth, ...) live beside the videos they group
    getVideoCategories: () => loadJSON("data/videos.json").then(d => (d && Array.isArray(d.categories) ? d.categories.filter(c => c && c.id) : [])),
    getCommunityOptions: () => loadJSON("data/community.json"),
    getBooks: () => collection("data/books.json", "books"),
    getTimeline: () => collection("data/timeline.json", "timeline"),
    getGallery: () => collection("data/gallery.json", "albums")
  };
})();
