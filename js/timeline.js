/* SHDP journey timeline: data/timeline.json -> horizontal scroll-snap timeline.
   The same data feeds the Teertha Yatra card (js/events.js), so nothing is duplicated. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, $$, esc, t, pick, safe } = S;

  const ol = $("#timeline"), filterEl = $("#timeline-filter"), emptyEl = $("#timeline-empty");
  if (!ol) return;

  let items = null;
  const state = { cat: "all", year: "all" };
  const CAT = { initiative: ["Initiatives", "కార్యక్రమాలు"], yatra: ["Teertha Yatras", "తీర్థ యాత్రలు"], honour: ["Honours", "గౌరవాలు"] };
  const catLabel = c => (CAT[c] ? CAT[c][S.lang === "te" ? 1 : 0] : c);

  const sizeTrack = () => ol.style.setProperty("--track-w", ol.scrollWidth + "px");

  function periodLabel(p) {
    if (!p) return "";
    if (p.ongoing && !p.start) return t("events.ongoing", "Ongoing");
    const a = p.start ? (p.start.length > 4 ? S.formatDate(p.start) : p.start) : "";
    const b = p.end ? (p.end.length > 4 ? S.formatDate(p.end) : p.end) : (p.ongoing ? t("timeline.present", "present") : "");
    return b ? `${a} – ${b}` : a;
  }
  const startYear = m => (m.period && m.period.start ? String(m.period.start).slice(0, 4) : null);
  const sortKey = m => (m.period && m.period.start ? String(m.period.start) : "9999");

  function renderFilter() {
    if (!filterEl || !items) return;
    const cats = [...new Set(items.map(m => m.category).filter(c => CAT[c]))];
    const years = [...new Set(items.map(startYear).filter(Boolean))].sort();
    const segs = cats.length > 1 ? `<div class="seg" role="group" aria-label="${esc(t("filter.type", "Type"))}">
      ${[["all", t("filter.all", "All")], ...cats.map(c => [c, catLabel(c)])].map(([v, l]) => `<button type="button" data-cat="${v}" aria-pressed="${state.cat === v}">${esc(l)}</button>`).join("")}</div>` : "";
    const yearSel = years.length > 1 ? `<label class="filter"><span>${esc(t("filter.year", "Year"))}</span><select data-year>
      <option value="all">${esc(t("filter.all", "All"))}</option>${years.map(y => `<option value="${y}"${state.year === y ? " selected" : ""}>${y}</option>`).join("")}</select></label>` : "";
    filterEl.innerHTML = segs + yearSel;
    filterEl.hidden = !(segs || yearSel);
  }

  function relatedLinks(m) {
    const r = m.related || {};
    const out = [];
    if (r.event_id && S.events) out.push(`<button type="button" class="link-arrow" data-event-open-global="${esc(r.event_id)}">${esc(t("timeline.event", "Event details"))}</button>`);
    if (r.programme_id) out.push(`<a class="link-arrow" href="#programme-${esc(r.programme_id)}">${esc(t("timeline.programme", "About the programme"))}</a>`);
    if (r.video_id) out.push(`<a class="link-arrow" href="#video-${esc(r.video_id)}">${esc(t("timeline.video", "Watch the video"))}</a>`);
    return out;
  }

  function render() {
    if (!items) return;
    const list = items.filter(m => (state.cat === "all" || m.category === state.cat) && (state.year === "all" || startYear(m) === state.year))
      .slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    ol.innerHTML = list.map(m => {
      const img = S.safeUrl(m.image), links = relatedLinks(m), more = img || links.length;
      const title = pick(m.title) || "";
      return `<li class="milestone${m.category === "yatra" ? " is-yatra" : ""}" id="milestone-${esc(m.id)}">
        <time${m.period && m.period.start ? ` datetime="${esc(m.period.start)}"` : ""}>${esc(periodLabel(m.period))}</time>
        <h3 lang="${esc(S.pickLangCode(m.title))}">${esc(title)}</h3>
        <p lang="${esc(S.pickLangCode(m.description))}">${esc(pick(m.description) || "")}</p>
        <div class="milestone-tools">
          ${more ? `<button type="button" class="milestone-toggle" aria-expanded="false" aria-controls="ms-more-${esc(m.id)}">${esc(t("timeline.more", "More"))}</button>` : ""}
          ${S.share ? `<button type="button" class="icon-btn" data-share data-share-title="${esc(title)}" data-share-text="${esc(periodLabel(m.period))}" data-share-url="#milestone-${esc(m.id)}" aria-label="${esc(t("share.label", "Share"))}: ${esc(title)}"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
        </div>
        ${more ? `<div class="milestone-more" id="ms-more-${esc(m.id)}" hidden>
          ${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ""}
          ${links.join("")}
        </div>` : ""}
      </li>`;
    }).join("");
    if (emptyEl) { emptyEl.hidden = list.length > 0; emptyEl.textContent = t("timeline.empty", "No milestones match this filter."); }
    requestAnimationFrame(sizeTrack);
  }

  ol.addEventListener("click", e => {
    const tg = e.target.closest(".milestone-toggle");
    if (tg) {
      const box = $("#" + tg.getAttribute("aria-controls"));
      const open = tg.getAttribute("aria-expanded") !== "true";
      tg.setAttribute("aria-expanded", String(open));
      tg.textContent = open ? t("timeline.less", "Less") : t("timeline.more", "More");
      if (box) box.hidden = !open;
      return;
    }
    const ev = e.target.closest("[data-event-open-global]");
    if (ev && S.events) S.events.open(ev.dataset.eventOpenGlobal, ev);
  });
  if (filterEl) {
    filterEl.addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (!b) return; state.cat = b.dataset.cat; renderFilter(); render(); });
    filterEl.addEventListener("change", e => { const s = e.target.closest("[data-year]"); if (!s) return; state.year = s.value; render(); });
  }
  $$("[data-scroll]").forEach(b => b.addEventListener("click", () => {
    ol.scrollBy({ left: +b.dataset.scroll * (ol.clientWidth * 0.8), behavior: S.reduceMotion ? "auto" : "smooth" });
  }));
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(sizeTrack, 150); });

  function routeFromHash() {
    const m = /^#milestone-([\w-]+)$/.exec(location.hash);
    if (!m || !items) return;
    state.cat = "all"; state.year = "all"; renderFilter(); render();
    const li = $("#milestone-" + CSS.escape(m[1]));
    if (li) { li.scrollIntoView({ block: "nearest", inline: "start" }); li.classList.add("is-target"); }
  }
  window.addEventListener("hashchange", routeFromHash);

  S.onLang(() => safe("timeline (lang)", () => { renderFilter(); render(); }));

  Promise.all([SHDP_DATA.getTimeline(), SHDP_DATA.getEvents()]).then(([tl]) => {
    if (!tl) { if (emptyEl) { emptyEl.hidden = false; emptyEl.textContent = t("timeline.loadError", "Our journey couldn't load right now. Please check back soon."); } return; }
    items = tl;
    safe("timeline render", () => { renderFilter(); render(); routeFromHash(); });
  });

  S.timeline = { get list() { return items; }, periodLabel };
})();
