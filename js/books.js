/* SHDP books: data/books.json -> searchable shelf + detail dialog.
   Buy / Read buttons appear only for real, valid links. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, esc, t, pick, safe } = S;

  const grid = $("#book-grid"), empty = $("#book-empty"), toolbar = $("#book-toolbar"), none = $("#book-noresults");
  if (!grid) return;

  let books = null;
  const state = { q: "", language: "all", category: "all" };
  const LANGS = { te: ["Telugu", "తెలుగు"], en: ["English", "ఇంగ్లీష్"], sa: ["Sanskrit", "సంస్కృతం"], hi: ["Hindi", "హిందీ"] };
  const langName = c => (LANGS[c] ? LANGS[c][S.lang === "te" ? 1 : 0] : c);

  const links = b => ({ buy: S.safeUrl(b.buy_url), pdf: S.safeUrl(b.pdf_url) });

  function card(b) {
    const title = pick(b.title) || "", author = pick(b.author) || "", cover = S.safeUrl(b.cover), l = links(b);
    return `<article class="book" id="book-${esc(b.id)}">
      <button type="button" class="book-cover" data-book-open="${esc(b.id)}" aria-label="${esc(t("books.details", "Details"))}: ${esc(title)}">
        ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
        <span class="book-fallback" lang="${esc(S.pickLangCode(b.title))}">${esc(title)}</span>
      </button>
      <h3 lang="${esc(S.pickLangCode(b.title))}">${esc(title)}</h3>
      <p class="book-meta">${esc([author, b.language ? langName(b.language) : ""].filter(Boolean).join(" · "))}</p>
      <div class="book-actions">
        ${l.buy ? `<a class="btn btn-green btn-sm" href="${esc(l.buy)}" target="_blank" rel="noopener">${esc(t("books.buy", "Buy"))}</a>` : ""}
        ${l.pdf ? `<a class="btn btn-outline btn-sm" href="${esc(l.pdf)}" target="_blank" rel="noopener">${esc(t("books.read", "Read"))}</a>` : ""}
        ${S.share ? `<button type="button" class="icon-btn" data-share data-share-title="${esc(title)}" data-share-text="${esc(author)}" data-share-url="#book-${esc(b.id)}" aria-label="${esc(t("share.label", "Share"))}: ${esc(title)}"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
      </div>
    </article>`;
  }

  function renderToolbar() {
    if (!toolbar || !books) return;
    if (books.length < 2) { toolbar.hidden = true; return; }
    const langs = [...new Set(books.map(b => b.language).filter(Boolean))];
    const cats = [...new Set(books.map(b => pick(b.category)).filter(Boolean))];
    const sel = (name, lbl, vals, fmt) => vals.length < 2 ? "" : `<label class="filter"><span>${esc(lbl)}</span><select data-bfilter="${name}"><option value="all">${esc(t("filter.all", "All"))}</option>${vals.map(v => `<option value="${esc(v)}"${state[name] === v ? " selected" : ""}>${esc(fmt(v))}</option>`).join("")}</select></label>`;
    toolbar.innerHTML = `<label class="filter filter-search"><span class="sr-only">${esc(t("books.search", "Search books"))}</span><input type="search" data-bsearch value="${esc(state.q)}" placeholder="${esc(t("books.search", "Search books"))}"></label>
      ${sel("language", t("books.language", "Language"), langs, langName)}${sel("category", t("books.category", "Category"), cats, x => x)}`;
    toolbar.hidden = false;
  }

  function render() {
    if (!books) return;
    const q = state.q.trim().toLowerCase();
    const list = books.filter(b => (state.language === "all" || b.language === state.language)
      && (state.category === "all" || pick(b.category) === state.category)
      && (!q || [pick(b.title), pick(b.author), pick(b.description), pick(b.category)].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (b.featured === true) - (a.featured === true));
    grid.innerHTML = list.map(card).join("");
    grid.hidden = !books.length;
    if (empty) empty.hidden = books.length > 0;
    if (none) { none.hidden = !books.length || list.length > 0; none.textContent = t("search.none", "No results. Try another word."); }
  }

  function open(id, opener) {
    const b = (books || []).find(x => x.id === id), dlg = $("#modal");
    if (!b || !dlg) return;
    S.wireDialog(dlg);
    dlg.dataset.owner = "book:" + id;
    renderDetail(b);
    S.openDialog(dlg, opener);
  }
  function renderDetail(b) {
    const body = $("#modal .dialog-body");
    if (!body) return;
    const title = pick(b.title) || "", l = links(b), cover = S.safeUrl(b.cover);
    body.innerHTML = `
      ${cover ? `<div class="modal-cover is-book"><img src="${esc(cover)}" alt="" loading="lazy" decoding="async"></div>` : ""}
      <p class="eyebrow">${esc([pick(b.category), b.language ? langName(b.language) : ""].filter(Boolean).join(" · "))}</p>
      <h2 class="dialog-title" id="modal-title" lang="${esc(S.pickLangCode(b.title))}">${esc(title)}</h2>
      ${pick(b.author) ? `<p class="dialog-sub">${esc(pick(b.author))}</p>` : ""}
      ${pick(b.description) ? `<p class="dialog-text" lang="${esc(S.pickLangCode(b.description))}">${esc(pick(b.description))}</p>` : ""}
      <div class="dialog-actions">
        ${l.buy ? `<a class="btn btn-green" href="${esc(l.buy)}" target="_blank" rel="noopener">${esc(t("books.buy", "Buy"))}</a>` : ""}
        ${l.pdf ? `<a class="btn btn-outline" href="${esc(l.pdf)}" target="_blank" rel="noopener">${esc(t("books.read", "Read"))}</a>` : ""}
        ${S.share ? S.share.button({ title, text: pick(b.author) || "", url: "#book-" + b.id }) : ""}
      </div>
      ${!l.buy && !l.pdf ? `<p class="dialog-note">${esc(t("books.noLinks", "Purchase and reading links will be added soon."))}</p>` : ""}`;
  }

  grid.addEventListener("click", e => { const b = e.target.closest("[data-book-open]"); if (b) open(b.dataset.bookOpen, b); });
  if (toolbar) {
    toolbar.addEventListener("input", e => { if (e.target.matches("[data-bsearch]")) { state.q = e.target.value; render(); } });
    toolbar.addEventListener("change", e => { const s = e.target.closest("[data-bfilter]"); if (s) { state[s.dataset.bfilter] = s.value; render(); } });
  }
  function routeFromHash() { const m = /^#book-([\w-]+)$/.exec(location.hash); if (m && books) open(m[1]); }
  window.addEventListener("hashchange", routeFromHash);

  S.onLang(() => safe("books (lang)", () => {
    renderToolbar(); render();
    const dlg = $("#modal");
    if (dlg && dlg.open && (dlg.dataset.owner || "").startsWith("book:")) { const b = books.find(x => "book:" + x.id === dlg.dataset.owner); if (b) renderDetail(b); }
  }));

  SHDP_DATA.getBooks().then(list => {
    if (!list) return; // static empty state stays
    books = list.filter(b => pick(b.title));
    safe("books render", () => { renderToolbar(); render(); routeFromHash(); });
  });

  S.books = { open, get list() { return books; } };
})();
