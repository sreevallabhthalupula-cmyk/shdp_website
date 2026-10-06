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
  const vGrid = $("#video-grid"), vFeatured = $("#video-featured"), vEmpty = $("#video-empty"), vToolbar = $("#video-toolbar"), vNone = $("#video-noresults");
  const YT_ID = /^[\w-]{11}$/;
  let videos = null;
  const vState = { q: "", category: "all", series: "all" };

  const thumbOf = v => S.safeUrl(v.thumbnail) || `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`;
  const watchUrl = v => `https://www.youtube.com/watch?v=${v.youtube_id}`;
  const fmtDuration = d => (typeof d === "string" && /^\d{1,2}(:\d{2}){1,2}$/.test(d) ? d : "");

  function card(v, lead) {
    const title = pick(v.title) || "";
    const meta = [pick(v.category), pick(v.series), v.published_date && S.isISODate(v.published_date) ? S.formatDate(v.published_date) : ""].filter(Boolean).join(" · ");
    return `<article class="vcard${lead ? " is-lead" : ""}" id="video-${esc(v.id)}">
      <div class="vthumb">
        <button type="button" class="vplay" data-video-play="${esc(v.id)}" aria-label="${esc(t("videos.play", "Play"))}: ${esc(title)}">
          <img src="${esc(thumbOf(v))}" alt="" loading="lazy" decoding="async" width="480" height="360" onerror="this.remove()">
          <span class="play"><svg class="icon"><use href="#i-play"/></svg></span>
          ${fmtDuration(v.duration) ? `<span class="dur">${esc(v.duration)}</span>` : ""}
        </button>
      </div>
      <h3 lang="${esc(S.pickLangCode(v.title))}">${esc(title)}</h3>
      ${meta ? `<p class="theme">${esc(meta)}</p>` : ""}
      <div class="vactions">
        <a class="link-arrow" href="${esc(watchUrl(v))}" target="_blank" rel="noopener">${esc(t("videos.onYoutube", "Watch on YouTube"))}</a>
        ${S.share ? `<button type="button" class="icon-btn" data-share data-share-title="${esc(title)}" data-share-url="${esc(watchUrl(v))}" aria-label="${esc(t("share.label", "Share"))}: ${esc(title)}"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
      </div>
    </article>`;
  }

  function play(btn, id) {
    const v = (videos || []).find(x => x.id === id);
    const box = btn.closest(".vthumb");
    if (!v || !box) return;
    const src = v.youtube_id ? `https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&rel=0` : v.embed_src;
    box.innerHTML = `<iframe src="${esc(src)}" title="${esc(pick(v.title) || "YouTube video")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`;
    const f = $("iframe", box); if (f) f.focus();
  }

  function renderToolbar() {
    if (!vToolbar || !videos) return;
    if (videos.length < 2) { vToolbar.hidden = true; return; }
    const cats = [...new Set(videos.map(v => pick(v.category)).filter(Boolean))];
    const series = [...new Set(videos.map(v => pick(v.series)).filter(Boolean))];
    const sel = (name, lbl, vals) => vals.length < 2 ? "" : `<label class="filter"><span>${esc(lbl)}</span><select data-vfilter="${name}"><option value="all">${esc(t("filter.all", "All"))}</option>${vals.map(x => `<option${vState[name] === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>`;
    vToolbar.innerHTML = `<label class="filter filter-search"><span class="sr-only">${esc(t("videos.search", "Search videos"))}</span>
        <input type="search" data-vsearch value="${esc(vState.q)}" placeholder="${esc(t("videos.search", "Search videos"))}"></label>
      ${sel("category", t("videos.category", "Category"), cats)}${sel("series", t("videos.series", "Series"), series)}`;
    vToolbar.hidden = false;
  }

  function renderVideos() {
    if (!vGrid || !videos) return;
    const q = vState.q.trim().toLowerCase();
    const sorted = videos.slice().sort((a, b) => String(b.published_date || "").localeCompare(String(a.published_date || "")));
    const match = sorted.filter(v => (vState.category === "all" || pick(v.category) === vState.category)
      && (vState.series === "all" || pick(v.series) === vState.series)
      && (!q || [pick(v.title), pick(v.description), pick(v.category), pick(v.series), ...(v.tags || [])].join(" ").toLowerCase().includes(q)));
    const filtering = q || vState.category !== "all" || vState.series !== "all";
    const lead = !filtering ? (sorted.find(v => v.featured) || sorted[0]) : null;
    if (vFeatured) vFeatured.innerHTML = lead ? card(lead, true) : "";
    vGrid.innerHTML = match.filter(v => v !== lead).map(v => card(v)).join("");
    if (vNone) { vNone.hidden = match.length > 0; vNone.textContent = t("search.none", "No results. Try another word."); }
  }

  function renderUploads(site) {
    // automatic "latest uploads" playlist when a real channel ID (UC...) is configured
    const box = $("#video-uploads");
    const id = S.getPath(site || {}, "social.youtube.channel_id");
    if (!box || typeof id !== "string" || !/^UC[\w-]{22}$/.test(id)) return;
    const list = "UU" + id.slice(2);
    box.innerHTML = `<div class="vthumb"><button type="button" class="vplay" data-playlist="${esc(list)}" aria-label="${esc(t("videos.uploads", "Play latest uploads"))}">
      <img src="assets/img/guruji-portrait.webp" alt="" loading="lazy" decoding="async"><span class="play"><svg class="icon"><use href="#i-play"/></svg></span></button></div>
      <p class="theme">${esc(t("videos.uploadsNote", "Latest uploads from the YouTube channel"))}</p>`;
    box.hidden = false;
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-video-play]");
    if (b) { play(b, b.dataset.videoPlay); return; }
    const p = e.target.closest("[data-playlist]");
    if (p) {
      const box = p.closest(".vthumb");
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(p.dataset.playlist)}&autoplay=1" title="${esc(t("videos.uploads", "Latest uploads"))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    }
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
    if (v && videos) { const el = $("#video-" + CSS.escape(v[1])); if (el) el.scrollIntoView({ block: "center" }); }
    const a = /^#album-([\w-]+)$/.exec(location.hash);
    if (a && albums) { const al = albums.find(x => x.id === a[1]); if (al) lbOpen(albumImages(al), 0); }
  }
  window.addEventListener("hashchange", routeFromHash);

  S.onLang(() => safe("media (lang)", () => { renderToolbar(); renderVideos(); renderGallery(); }));

  Promise.all([SHDP_DATA.getVideos(), S.siteReady]).then(([vs, site]) => {
    safe("uploads playlist", () => renderUploads(site));
    if (!vs) return; // keep the static "watch on YouTube" panel
    videos = vs.filter(v => {
      const ok = v.youtube_id && YT_ID.test(v.youtube_id);
      if (!ok) console.warn(`[shdp] videos.json: "${v.id}" skipped (missing or invalid youtube_id).`);
      return ok;
    });
    if (!videos.length) return; // no real videos yet: the empty state stays
    safe("videos render", () => {
      if (vEmpty) vEmpty.hidden = true;
      renderToolbar(); renderVideos(); routeFromHash();
    });
  });
  SHDP_DATA.getGallery().then(as => {
    if (!as) { if (gEmpty) gEmpty.hidden = false; return; }
    albums = as;
    safe("gallery render", () => { renderGallery(); routeFromHash(); });
  });

  S.media = { get videos() { return videos; }, get albums() { return albums; } };
})();
