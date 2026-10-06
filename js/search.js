/* SHDP search: client-side search over the loaded JSON (both languages).
   Opens from any [data-search-open] button, "/" or Ctrl/Cmd+K. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, $$, esc, t, pick } = S;

  const dlg = $("#search-dialog");
  if (!dlg) return;
  const input = $("#search-input", dlg), results = $("#search-results", dlg);
  let index = null, building = null;

  const both = f => (f == null ? "" : typeof f === "string" ? f : [f.en, f.te, f.sa].filter(Boolean).join(" "));
  const GROUPS = [
    ["event", "search.events", "Events"], ["programme", "search.programmes", "Programmes"], ["video", "search.videos", "Videos"],
    ["book", "search.books", "Books"], ["milestone", "search.journey", "Our journey"], ["quote", "search.quotes", "Shlokas"]
  ];

  function build() {
    if (building) return building;
    building = Promise.all([SHDP_DATA.getEvents(), SHDP_DATA.getProgrammes(), SHDP_DATA.getVideos(), SHDP_DATA.getBooks(), SHDP_DATA.getTimeline(), SHDP_DATA.getQuotes()])
      .then(([ev, pr, vi, bo, tl, qu]) => {
        const items = [];
        const add = (type, x, title, sub, extra) => items.push({ type, id: x.id, title, sub, hay: [both(title), both(sub), extra].join(" ").toLowerCase() });
        (ev || []).forEach(x => add("event", x, x.title, x.schedule, [both(x.description), both(x.venue), both(x.audience), x.type].join(" ")));
        (pr || []).forEach(x => add("programme", x, x.title, x.schedule, [both(x.description), both(x.audience), both(x.location)].join(" ")));
        (vi || []).filter(x => x.youtube_id).forEach(x => add("video", x, x.title, x.series || x.category, [both(x.description), (x.tags || []).join(" ")].join(" ")));
        (bo || []).forEach(x => add("book", x, x.title, x.author, [both(x.description), both(x.category)].join(" ")));
        (tl || []).forEach(x => add("milestone", x, x.title, S.timeline ? S.timeline.periodLabel(x.period) : "", both(x.description)));
        (qu || []).filter(q => q && q.status === "published").forEach(x => add("quote", x, x.shloka, x.transliteration, [both(x.meaning), both(x.source)].join(" ")));
        index = items;
        return items;
      });
    return building;
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return String(text).split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join("");
  }

  function run() {
    if (!results) return;
    const q = (input.value || "").trim();
    if (!index) { results.innerHTML = `<p class="search-hint">${esc(t("search.loading", "Loading…"))}</p>`; return; }
    if (q.length < 2) { results.innerHTML = `<p class="search-hint">${esc(t("search.hint", "Type at least two letters, in English or Telugu."))}</p>`; return; }
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = index.filter(it => terms.every(term => it.hay.includes(term)));
    if (!hits.length) { results.innerHTML = `<p class="search-hint">${esc(t("search.none", "No results. Try another word."))}</p>`; return; }
    results.innerHTML = GROUPS.map(([type, key, en]) => {
      const g = hits.filter(h => h.type === type).slice(0, 6);
      if (!g.length) return "";
      return `<section class="search-group"><h3>${esc(t(key, en))}</h3><ul>${g.map(h => {
        const title = typeof h.title === "object" && h.title && h.type === "quote" ? (h.title.sa || pick(h.title)) : pick(h.title);
        return `<li><button type="button" data-hit-type="${h.type}" data-hit-id="${esc(h.id)}"><span class="hit-title">${highlight(title || "", terms[0])}</span>${pick(h.sub) ? `<span class="hit-sub">${highlight(pick(h.sub), terms[0])}</span>` : ""}</button></li>`;
      }).join("")}</ul></section>`;
    }).join("");
  }

  function go(type, id) {
    S.closeDialog(dlg);
    setTimeout(() => {
      if (type === "event" && S.events) S.events.open(id);
      else if (type === "book" && S.books) S.books.open(id);
      else if (type === "quote" && S.quote) { S.quote.show(id); const sh = $("#shloka"); if (sh) sh.scrollIntoView({ block: "start" }); }
      else location.hash = (type === "milestone" ? "#milestone-" : type === "programme" ? "#programme-" : "#video-") + id;
    }, 30);
  }

  function open(opener) {
    S.wireDialog(dlg);
    S.openDialog(dlg, opener);
    if (input) { input.value = ""; input.focus(); }
    run();
    build().then(run);
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-search-open]");
    if (b) { e.preventDefault(); open(b); }
  });
  document.addEventListener("keydown", e => {
    const typing = /^(input|textarea|select)$/i.test((e.target.tagName || "")) || e.target.isContentEditable;
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing && !dlg.open)) { e.preventDefault(); open(document.activeElement); }
  });
  if (input) input.addEventListener("input", run);
  if (results) results.addEventListener("click", e => { const b = e.target.closest("[data-hit-type]"); if (b) go(b.dataset.hitType, b.dataset.hitId); });
  const clear = $("[data-search-clear]", dlg);
  if (clear) clear.addEventListener("click", () => { input.value = ""; input.focus(); run(); });
  S.onLang(() => { if (dlg.open) run(); });
})();
