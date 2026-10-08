/* SHDP media: Pravachanalu videos (click-to-load YouTube), photo gallery, lightbox.
   No YouTube iframe is created until a visitor presses play. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, $$, esc, t, pick, safe } = S;

  /* =============== lightbox (shared) =============== */
  const lb = $("#lightbox");
  let lbItems = [], lbIndex = 0;
  function lbShow(i) {
    if (!lb || !lbItems.length) return;
    lbIndex = (i + lbItems.length) % lbItems.length;
    const it = lbItems[lbIndex];
    const img = $(".lb-img", lb), cap = $(".lb-caption", lb), count = $(".lb-count", lb);
    if (img) { img.src = it.src; img.alt = it.caption || ""; }
    if (cap) { cap.textContent = it.caption || ""; cap.hidden = !it.caption; }
    if (count) count.textContent = lbItems.length > 1 ? `${lbIndex + 1} / ${lbItems.length}` : "";
    $$(".lb-nav", lb).forEach(b => (b.hidden = lbItems.length < 2));
    const next = lbItems[(lbIndex + 1) % lbItems.length];
    if (next && next.src !== it.src) { const p = new Image(); p.src = next.src; } // preload one ahead only
  }
  function lbOpen(items, index = 0, opener) {
    if (!lb) return;
    lbItems = (items || []).filter(x => x && S.safeUrl(x.src));
    if (!lbItems.length) return;
    S.wireDialog(lb);
    lbShow(index);
    S.openDialog(lb, opener);
  }
  if (lb) {
    lb.addEventListener("click", e => {
      if (e.target.closest("[data-lb-prev]")) lbShow(lbIndex - 1);
      if (e.target.closest("[data-lb-next]")) lbShow(lbIndex + 1);
    });
    lb.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") { e.preventDefault(); lbShow(lbIndex - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); lbShow(lbIndex + 1); }
    });
    let x0 = null;
    lb.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") x0 = e.clientX; });
    lb.addEventListener("pointerup", e => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    });
  }
  S.lightbox = { open: lbOpen };

  /* =============== videos =============== */
  const vGrid = $("#video-grid"), vEmpty = $("#video-empty"), vToolbar = $("#video-toolbar"), vNone = $("#video-noresults"), vMore = $("#video-more");
  const vCats = $("#video-cats"), vCatNote = $("#video-cat-note"), vCatEmpty = $("#video-cat-empty");
  const YT_ID = /^[\w-]{11}$/;
  const PAGE = 6; // cards shown before "Show more"
  let videos = null, uploadsList = null, shown = PAGE, categories = [];
  // a video's category is a category id from data/videos.json "categories" (older free-text values still work)
  const catId = v => (typeof v.category === "string" ? v.category : pick(v.category)) || null;
  const catOf = id => categories.find(c => c.id === id) || null;
  const catLabel = id => { const c = catOf(id); return c ? pick(c.label) || id : id; };
  const vState = { q: "", category: "all", series: "all", language: "all" };
  const LANGS = { te: ["Telugu", "తెలుగు"], en: ["English", "ఇంగ్లీష్"], sa: ["Sanskrit", "సంస్కృతం"] };
  const langName = c => (LANGS[c] ? LANGS[c][S.lang === "te" ? 1 : 0] : c);

  const thumbOf = v => S.safeUrl(v.thumbnail) || `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`;
  const watchUrl = v => `https://www.youtube.com/watch?v=${v.youtube_id}`;
  const fmtDuration = d => (typeof d === "string" && /^\d{1,2}(:\d{2}){1,2}$/.test(d) ? d : "");
  // titles on YouTube are often mixed Telugu + English: mark Telugu script so it gets the Telugu font
  const scriptLang = s => (/[\u0C00-\u0C7F]/.test(s || "") ? "te" : "en");

  function card(v) {
    const title = pick(v.title) || "";
    const meta = [pick(v.series) || (catId(v) ? catLabel(catId(v)) : ""), v.language ? langName(v.language) : "", v.published_date && S.isISODate(v.published_date) ? S.formatDate(v.published_date) : ""].filter(Boolean).join(" · ");
    return `<article class="vcard" id="video-${esc(v.id)}">
      <div class="vthumb">
        <button type="button" class="vplay" data-video-play="${esc(v.id)}" aria-label="${esc(t("videos.play", "Play"))}: ${esc(title)}">
          <img src="${esc(thumbOf(v))}" alt="" loading="lazy" decoding="async" width="480" height="360" onerror="this.remove()">
          <span class="play"><svg class="icon"><use href="#i-play"/></svg></span>
          ${fmtDuration(v.duration) ? `<span class="dur">${esc(v.duration)}</span>` : ""}
        </button>
      </div>
      <div class="vbody">
        ${meta ? `<p class="vmeta">${esc(meta)}</p>` : ""}
        <h3 lang="${scriptLang(title)}">${esc(title)}</h3>
        <div class="vactions">
          <a class="btn-text" href="${esc(watchUrl(v))}" target="_blank" rel="noopener">${esc(t("videos.onYoutube", "Watch on YouTube"))}</a>
          ${S.share ? `<button type="button" class="icon-btn" data-share data-share-title="${esc(title)}" data-share-url="${esc(watchUrl(v))}" aria-label="${esc(t("share.label", "Share"))}: ${esc(title)}"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
        </div>
      </div>
    </article>`;
  }

  // Player opens in the shared dialog; the iframe is created only now and removed on close.
  function openPlayer(src, title, opener, extra) {
    const dlg = $("#modal"), body = dlg && $(".dialog-body", dlg);
    if (!body) { window.open(src.replace("youtube-nocookie.com/embed/", "youtube.com/watch?v="), "_blank", "noopener"); return; }
    S.wireDialog(dlg);
    dlg.dataset.owner = "video";
    dlg.classList.add("is-player");
    body.innerHTML = `<div class="player-frame"><iframe src="${esc(src)}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe></div>
      <h2 class="dialog-title" id="modal-title" lang="${scriptLang(title)}">${esc(title)}</h2>${extra || ""}`;
    if (!dlg._playerCleanup) {
      dlg._playerCleanup = true;
      dlg.addEventListener("close", () => { if (dlg.classList.contains("is-player")) { dlg.classList.remove("is-player"); const b = $(".dialog-body", dlg); if (b) b.innerHTML = ""; } });
    }
    S.openDialog(dlg, opener);
  }

  function play(btn, id) {
    const v = (videos || []).find(x => x.id === id);
    if (!v) return;
    const title = pick(v.title) || "YouTube video";
    const extra = `<div class="dialog-actions">
        <a class="btn btn-outline" href="${esc(watchUrl(v))}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-youtube"/></svg><span>${esc(t("videos.onYoutube", "Watch on YouTube"))}</span></a>
        ${S.share ? S.share.button({ title, url: watchUrl(v), cls: "btn btn-outline" }) : ""}
      </div>`;
    openPlayer(`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&rel=0`, title, btn, extra);
  }

  function renderToolbar() {
    if (!vToolbar || !videos) return;
    if (videos.length < 2 && !uploadsList) { vToolbar.hidden = true; return; }
    // categories with a definition get the selector above; only undefined free-text ones stay a dropdown
    const cats = [...new Set(videos.map(catId).filter(c => c && !catOf(c)))];
    const series = [...new Set(videos.map(v => pick(v.series)).filter(Boolean))];
    const langs = [...new Set(videos.map(v => v.language).filter(Boolean))];
    const sel = (name, lbl, vals, fmt = x => x) => vals.length < 2 ? "" : `<label class="filter"><span>${esc(lbl)}</span><select data-vfilter="${name}"><option value="all">${esc(t("filter.all", "All"))}</option>${vals.map(x => `<option value="${esc(x)}"${vState[name] === x ? " selected" : ""}>${esc(fmt(x))}</option>`).join("")}</select></label>`;
    vToolbar.innerHTML = `${videos.length > 1 ? `<label class="filter filter-search"><span class="sr-only">${esc(t("videos.search", "Search videos"))}</span>
        <input type="search" data-vsearch value="${esc(vState.q)}" placeholder="${esc(t("videos.search", "Search videos"))}"></label>` : ""}
      ${sel("category", t("videos.category", "Category"), cats)}${sel("series", t("videos.series", "Series"), series)}${sel("language", t("books.language", "Language"), langs, langName)}
      ${uploadsList ? `<button type="button" class="btn btn-outline btn-sm toolbar-end" data-playlist="${esc(uploadsList)}"><svg class="icon"><use href="#i-play"/></svg><span>${esc(t("videos.uploads", "Play latest uploads"))}</span></button>` : ""}`;
    vToolbar.hidden = false;
  }

  function renderVideos() {
    if (!vGrid || !videos) return;
    const q = vState.q.trim().toLowerCase();
    const sorted = videos.slice().sort((a, b) => (b.featured === true) - (a.featured === true) || String(b.published_date || "").localeCompare(String(a.published_date || "")));
    const match = sorted.filter(v => (vState.category === "all" || catId(v) === vState.category)
      && (vState.series === "all" || pick(v.series) === vState.series)
      && (vState.language === "all" || v.language === vState.language)
      && (!q || [pick(v.title), pick(v.description), pick(v.category), pick(v.series), ...(v.tags || [])].join(" ").toLowerCase().includes(q)));
    const filtering = q || vState.category !== "all" || vState.series !== "all" || vState.language !== "all";
    const list = filtering ? match : match.slice(0, shown);
    vGrid.innerHTML = list.map(card).join("");
    vGrid.classList.toggle("is-single", list.length === 1);
    if (vMore) {
      const rest = match.length - list.length;
      vMore.hidden = filtering || rest <= 0;
      vMore.textContent = `${t("videos.more", "Show more videos")} (${rest})`;
    }
    // a defined category with nothing in it yet: a calm "being gathered" panel instead of "no results"
    const catEmpty = !match.length && !!catOf(vState.category) && !q && vState.series === "all" && vState.language === "all";
    if (vCatEmpty) {
      vCatEmpty.hidden = !catEmpty;
      const tt = $("#video-cat-empty-title", vCatEmpty);
      if (tt) tt.textContent = t("videos.catEmpty", "Pravachanalu for {cat} are being gathered and will appear here soon.").replace("{cat}", catLabel(vState.category));
    }
    if (vNone) { vNone.hidden = match.length > 0 || catEmpty; vNone.textContent = t("search.none", "No results. Try another word."); }
  }

  function renderCats() {
    if (!vCats || !videos) return;
    if (!categories.length) { vCats.hidden = true; return; }
    const count = id => videos.filter(v => catId(v) === id).length;
    const items = [{ id: "all", label: t("videos.catAll", "All Pravachanalu"), n: videos.length }, ...categories.map(c => ({ id: c.id, label: pick(c.label) || c.id, n: count(c.id) }))];
    vCats.innerHTML = items.map(i => `<button type="button" class="vcat" data-vcat="${esc(i.id)}" aria-pressed="${vState.category === i.id}">
      <span class="vcat-label">${esc(i.label)}</span><span class="vcat-count" aria-hidden="true">${i.n}</span><span class="sr-only">, ${i.n} ${esc(t("videos.countLabel", "videos"))}</span></button>`).join("");
    vCats.hidden = false;
    const c = catOf(vState.category);
    if (vCatNote) { const d = c && pick(c.description); vCatNote.textContent = d || ""; vCatNote.hidden = !d; }
  }
  if (vCats) vCats.addEventListener("click", e => {
    const b = e.target.closest("[data-vcat]");
    if (!b || vState.category === b.dataset.vcat) return;
    vState.category = b.dataset.vcat;
    shown = PAGE;
    renderCats(); renderVideos();
  });
  // arrow keys move between categories (one tab stop feel, but every button stays reachable)
  if (vCats) vCats.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const bs = $$("[data-vcat]", vCats), i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length].focus();
  });

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-video-play]");
    if (b) { play(b, b.dataset.videoPlay); return; }
    const p = e.target.closest("[data-playlist]");
    if (p) openPlayer(`https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(p.dataset.playlist)}&autoplay=1`, t("videos.uploadsNote", "Latest uploads from the YouTube channel"), p);
  });
  if (vMore) vMore.addEventListener("click", () => {
    const before = shown;
    shown += PAGE * 2;
    renderVideos();
    const next = vGrid && vGrid.children[before];
    const btn = next && $(".vplay", next);
    if (btn) btn.focus({ preventScroll: true });
  });
  if (vToolbar) {
    vToolbar.addEventListener("input", e => { if (e.target.matches("[data-vsearch]")) { vState.q = e.target.value; renderVideos(); } });
    vToolbar.addEventListener("change", e => { const s = e.target.closest("[data-vfilter]"); if (s) { vState[s.dataset.vfilter] = s.value; renderVideos(); } });
  }

  /* =============== gallery =============== */
  const gGrid = $("#gallery-grid"), gEmpty = $("#gallery-empty");
  let albums = null;
  const albumImages = a => (Array.isArray(a.images) ? a.images : []).map(im => ({ src: S.safeUrl(im && (im.src || im)), caption: pick(im && im.caption) || "" })).filter(x => x.src);

  function renderGallery() {
    if (!gGrid || !albums) return;
    const usable = albums.filter(a => albumImages(a).length);
    gGrid.innerHTML = usable.map(a => {
      const imgs = albumImages(a), cover = S.safeUrl(a.cover) || imgs[0].src, title = pick(a.title) || "";
      return `<button type="button" class="album" id="album-${esc(a.id)}" data-album="${esc(a.id)}">
        <span class="album-cover"><img src="${esc(cover)}" alt="" loading="lazy" decoding="async"></span>
        <span class="album-title" lang="${esc(S.pickLangCode(a.title))}">${esc(title)}</span>
        <span class="album-meta">${esc([S.isISODate(a.date) ? S.formatDate(a.date) : "", `${imgs.length} ${t("gallery.photos", "photos")}`].filter(Boolean).join(" · "))}</span>
      </button>`;
    }).join("");
    gGrid.hidden = !usable.length;
    if (gEmpty) gEmpty.hidden = usable.length > 0;
  }
  if (gGrid) gGrid.addEventListener("click", e => {
    const b = e.target.closest("[data-album]"); if (!b) return;
    const a = albums.find(x => x.id === b.dataset.album);
    if (a) lbOpen(albumImages(a), 0, b);
  });

  function routeFromHash() {
    const v = /^#video-([\w-]+)$/.exec(location.hash);
    if (v && videos) {
      const idx = videos.findIndex(x => x.id === v[1]);
      if (idx >= shown) { shown = idx + 1; renderVideos(); } // make sure the card is rendered
      const el = $("#video-" + CSS.escape(v[1])); if (el) el.scrollIntoView({ block: "center" });
    }
    const a = /^#album-([\w-]+)$/.exec(location.hash);
    if (a && albums) { const al = albums.find(x => x.id === a[1]); if (al) lbOpen(albumImages(al), 0); }
  }
  window.addEventListener("hashchange", routeFromHash);

  S.onLang(() => safe("media (lang)", () => { renderCats(); renderToolbar(); renderVideos(); renderGallery(); }));

  Promise.all([SHDP_DATA.getVideos(), S.siteReady, SHDP_DATA.getVideoCategories()]).then(([vs, site, cats]) => {
    categories = Array.isArray(cats) ? cats : [];
    // automatic "latest uploads" playlist only from a real channel ID (UC + 22 chars)
    const ch = S.getPath(site || {}, "social.youtube.channel_id");
    if (typeof ch === "string" && /^UC[\w-]{22}$/.test(ch)) uploadsList = "UU" + ch.slice(2);
    if (!vs) return; // keep the static "watch on YouTube" panel
    videos = vs.filter(v => {
      const ok = v.youtube_id && YT_ID.test(v.youtube_id);
      if (!ok) console.warn(`[shdp] videos.json: "${v.id}" skipped (missing or invalid youtube_id).`);
      return ok;
    });
    if (!videos.length) return; // no real videos yet: the empty state stays
    safe("videos render", () => {
      if (vEmpty) vEmpty.hidden = true;
      renderCats(); renderToolbar(); renderVideos(); routeFromHash();
    });
  });
  SHDP_DATA.getGallery().then(as => {
    if (!as) { if (gEmpty) gEmpty.hidden = false; return; }
    albums = as;
    safe("gallery render", () => { renderGallery(); routeFromHash(); });
  });

  S.media = { get videos() { return videos; }, get albums() { return albums; } };
})();
