/* SHDP programmes: data/programmes.json -> switcher (list + stage).
   Keyboard: arrow keys move between programmes. Mouse hover previews on desktop only
   (real mouse pointers, never keyboard or touch). On the single-column layout a tap
   brings the stage into view. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, $$, esc, t, pick, safe } = S;

  const listEl = $("#prog-list"), media = $("#prog-media"), panel = $("#prog-panel"), stage = $(".prog-stage"), filterEl = $("#prog-filter");
  if (!listEl || !panel) return;

  let all = null, shown = [], current = null, mode = "all";

  const MODE = { online: ["Online", "ఆన్‌లైన్"], "in-person": ["In person", "ప్రత్యక్షంగా"], hybrid: ["Online + in person", "ఆన్‌లైన్ + ప్రత్యక్షంగా"] };
  const modeLabel = m => (MODE[m] ? MODE[m][S.lang === "te" ? 1 : 0] : "");

  function ensureImages() {
    if (!media || !all) return;
    all.forEach(p => {
      const src = S.safeUrl(p.image);
      if (!src || $(`img[data-prog="${CSS.escape(p.id)}"]`, media)) return;
      const img = new Image();
      img.src = src; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      img.dataset.prog = p.id;
      if (p.image_position) img.style.objectPosition = p.image_position;
      img.classList.add("is-out");
      img.onerror = () => img.remove(); // missing image: the stage keeps its background colour
      media.appendChild(img);
    });
  }

  function renderFilter() {
    if (!filterEl || !all) return;
    const modes = [...new Set(all.map(p => p.mode).filter(Boolean))];
    const opts = ["online", "in-person"].filter(m => modes.includes(m) || modes.includes("hybrid"));
    if (opts.length < 2) { filterEl.hidden = true; return; }
    filterEl.innerHTML = `<div class="seg" role="group" aria-label="${esc(t("filter.mode", "Mode"))}">
      ${[["all", t("filter.all", "All")], ...opts.map(m => [m, modeLabel(m)])].map(([v, l]) => `<button type="button" data-mode="${v}" aria-pressed="${mode === v}">${esc(l)}</button>`).join("")}</div>`;
    filterEl.hidden = false;
  }

  function renderList() {
    shown = (all || []).filter(p => mode === "all" || p.mode === mode || p.mode === "hybrid");
    if (!shown.length) {
      listEl.innerHTML = `<li class="empty-state">${esc(t("prog.empty", "No programmes match this filter."))}</li>`;
      return;
    }
    if (!current || !shown.some(p => p.id === current)) current = shown[0].id;
    listEl.innerHTML = shown.map(p => {
      const sel = p.id === current;
      return `<li class="prog-item" role="presentation">
        <button class="prog-btn" role="tab" id="prog-tab-${esc(p.id)}" aria-selected="${sel}" aria-controls="prog-panel" tabindex="${sel ? 0 : -1}" data-id="${esc(p.id)}">
          <span><span class="name" lang="${esc(S.pickLangCode(p.title))}">${esc(pick(p.title))}</span><span class="when">${esc(pick(p.schedule) || "")}${p.mode ? ` · ${esc(modeLabel(p.mode))}` : ""}</span></span>
          <svg class="icon"><use href="#i-arrow"/></svg>
        </button>
      </li>`;
    }).join("");
  }

  function renderPanel(animate) {
    const p = (all || []).find(x => x.id === current);
    if (!p) { panel.innerHTML = ""; return; }
    if (media) $$("img", media).forEach(img => img.classList.toggle("is-out", img.dataset.prog !== p.id));
    panel.setAttribute("aria-labelledby", "prog-tab-" + p.id);
    const reg = S.safeUrl(p.registration_url), wa = S.safeUrl(p.whatsapp_url);
    const ev = p.event_id && S.events && S.events.list ? S.events.list.find(e => e.id === p.event_id) : null;
    const meta = [["prog.for", "For", p.audience], ["prog.where", "Where", p.location], ["prog.fee", "Fee", p.fee]]
      .filter(([, , v]) => pick(v)).map(([k, en, v]) => `<div><dt>${esc(t(k, en))}</dt><dd>${esc(pick(v))}</dd></div>`).join("");
    panel.innerHTML = `
      <h3 lang="${esc(S.pickLangCode(p.title))}">${esc(pick(p.title))}</h3>
      ${p.mode ? `<p class="prog-mode"><span class="mode-chip mode-${esc(p.mode)}">${esc(modeLabel(p.mode))}</span></p>` : ""}
      <p lang="${esc(S.pickLangCode(p.description))}">${esc(pick(p.description) || "")}</p>
      ${meta ? `<dl>${meta}</dl>` : ""}
      <div class="prog-actions">
        ${reg ? `<a class="btn btn-gold btn-sm" href="${esc(reg)}" target="_blank" rel="noopener">${esc(t("events.register", "Register free"))}</a>` : ""}
        ${wa ? `<a class="btn btn-ghost-light btn-sm" href="${esc(wa)}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-whatsapp"/></svg><span>${esc(t("events.whatsappGroup", "WhatsApp group"))}</span></a>` : ""}
        ${ev ? `<button class="btn btn-ghost-light btn-sm" type="button" data-event-open-global="${esc(ev.id)}"><svg class="icon"><use href="#i-calendar"/></svg><span>${esc(t("prog.schedule", "Schedule & details"))}</span></button>` : ""}
        ${S.share ? S.share.button({ title: pick(p.title), text: pick(p.schedule) || "", url: "#programme-" + p.id, cls: "btn btn-ghost-light btn-sm" }) : ""}
      </div>`;
    if (animate && !S.reduceMotion && window.gsap) gsap.from(panel.children, { y: 14, opacity: 0, duration: 0.5, stagger: 0.06, ease: "expo.out" });
  }

  function select(id, { focus = false, reveal = false, animate = true } = {}) {
    if (!all || !all.some(p => p.id === id)) return;
    const changed = id !== current;
    current = id;
    $$(".prog-btn", listEl).forEach(b => { const on = b.dataset.id === id; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    if (focus) { const b = $(`.prog-btn[data-id="${CSS.escape(id)}"]`, listEl); if (b) b.focus(); }
    if (changed) renderPanel(animate);
    if (reveal) revealStage();
  }

  function revealStage() {
    if (!stage || !window.matchMedia("(max-width: 960px)").matches) return;
    const r = stage.getBoundingClientRect();
    if (r.top < 90 || r.top > window.innerHeight * 0.6) stage.scrollIntoView({ block: "start", behavior: S.reduceMotion ? "auto" : "smooth" });
  }

  listEl.addEventListener("click", e => { const b = e.target.closest(".prog-btn"); if (b) select(b.dataset.id, { reveal: true }); });
  listEl.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (min-width: 961px)").matches) return;
    const b = e.target.closest(".prog-btn"); if (b) select(b.dataset.id);
  });
  listEl.addEventListener("keydown", e => {
    const i = shown.findIndex(p => p.id === current);
    if (i < 0) return;
    const go = d => { e.preventDefault(); select(shown[(i + d + shown.length) % shown.length].id, { focus: true }); };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(-1);
    else if (e.key === "Home") { e.preventDefault(); select(shown[0].id, { focus: true }); }
    else if (e.key === "End") { e.preventDefault(); select(shown[shown.length - 1].id, { focus: true }); }
  });
  if (filterEl) filterEl.addEventListener("click", e => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    mode = b.dataset.mode; renderFilter(); renderList(); renderPanel(false);
  });
  panel.addEventListener("click", e => {
    const b = e.target.closest("[data-event-open-global]");
    if (b && S.events) S.events.open(b.dataset.eventOpenGlobal, b);
  });

  function routeFromHash() {
    const m = /^#programme-([\w-]+)$/.exec(location.hash);
    if (!m || !all) return;
    mode = "all"; renderFilter(); renderList();
    select(m[1], { animate: false });
    const sec = $("#programmes"); if (sec) sec.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", routeFromHash);

  S.onLang(() => safe("programmes (lang)", () => { renderFilter(); renderList(); renderPanel(false); }));

  // wait for events too, so the "Schedule & details" link can be offered
  Promise.all([SHDP_DATA.getProgrammes(), SHDP_DATA.getEvents()]).then(([list]) => {
    if (!list || !list.length) {
      panel.innerHTML = `<p>${esc(list ? t("prog.empty", "Programme details will appear here soon.") : t("prog.loadError", "Programme details couldn't load right now. Please check back soon."))}</p>`;
      return;
    }
    all = list;
    safe("programmes render", () => { ensureImages(); renderFilter(); renderList(); renderPanel(false); routeFromHash(); });
  });

  S.programmes = { select, get list() { return all; } };
})();
