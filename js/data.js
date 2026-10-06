/* SHDP data access layer.
   Every part of the site reads content through these functions only, so the source
   can later change (local JSON today, Supabase tomorrow) without touching the UI code.
   All functions return Promises and never throw: on failure they resolve to null
   and log a console error, so callers can keep their built-in fallback content. */
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
          console.error(`[shdp] Could not load ${path}: ${err.message}. Using built-in fallback content.`);
          cache.delete(path); // allow a later retry
          return null;
        }));
    }
    return cache.get(path);
  }

  // Today's date in India time as YYYY-MM-DD (the trust's calendar day for every visitor).
  // `?quoteDate=YYYY-MM-DD` in the page URL overrides it, for previewing scheduled quotes.
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

  window.SHDP_DATA = {
    loadJSON,
    todayISO,
    pickQuote,
    getSite: () => loadJSON("data/site.json"),
    getQuotes: () => loadJSON("data/quotes.json").then(d => (d && Array.isArray(d.quotes) ? d.quotes : null)),
    getQuoteForDate: date => window.SHDP_DATA.getQuotes().then(qs => (qs ? pickQuote(qs, date || todayISO()) : null))
  };
})();
