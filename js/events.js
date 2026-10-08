/* SHDP events: data/events.json -> "This week" list, filters, detail dialog.
   Also renders the Teertha Yatra card from data/timeline.json (category "yatra"),
   so yatras live in one place only. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, $$, esc, t, pick, safe } = S;

  const list = $("#event-list"), empty = $("#event-empty"), toolbar = $("#event-toolbar");
  if (!list) return;

  let events = null;          // null = not loaded / failed
  const state = { view: "upcoming", year: "all", type: "all", mode: "all" };

  const MODE = { online: ["Online", "ఆన్‌లైన్"], "in-person": ["In person", "ప్రత్యక్షంగా"], hybrid: ["Online + in person", "ఆన్‌లైన్ + ప్రత్యక్షంగా"] };
  const TYPE = { class: ["Class", "తరగతి"], seva: ["Seva", "సేవ"], yatra: ["Yatra", "యాత్ర"], festival: ["Festival", "పండుగ"], discourse: ["Discourse", "ప్రవచనం"], workshop: ["Workshop", "కార్యశాల"] };
  const label = (map, key) => { const v = map[key]; return v ? (S.lang === "te" ? v[1] : v[0]) : (key ? key.charAt(0).toUpperCase() + key.slice(1) : ""); };
  const modeLabel = m => label(MODE, m), typeLabel = ty => label(TYPE, ty);

  const C = () => S.calendar;
  const occurrence = ev => (C() ? C().nextOccurrence(ev) : (S.isISODate(ev.date) ? ev.date : null));
  const isRecurring = ev => ev.recurrence && (ev.recurrence.frequency === "weekly" || ev.recurrence.frequency === "ongoing");
  const isPast = ev => !isRecurring(ev) && S.isISODate(ev.date) && ev.date < S.todayISO();
  const isValid = ev => isRecurring(ev) || S.isISODate(ev.date);
  const yearOf = ev => (occurrence(ev) || ev.date || "").slice(0, 4) || null;

  function registrationUrl(ev) {
    const site = S.site || {};
    return S.safeUrl(ev.registration_url) || S.safeUrl(S.getPath(site, "registration.default_url"));
  }
  function mapUrl(ev) {
    const direct = S.safeUrl(ev.map_url);
    if (direct) return direct;
    const loc = pick(ev.location);
    return loc ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(loc) : null;
  }
  function timeText(ev) {
    if (!S.isTime(ev.start_time)) return "";
    const end = S.isTime(ev.end_time) ? " – " + S.formatTime(ev.end_time) : "";
    return S.formatTime(ev.start_time) + end + " IST";
  }

  /* ---------- date anchor: the visual centre of each card ---------- */
  function badge(ev) {
    const occ = occurrence(ev) || (S.isISODate(ev.date) ? ev.date : null);
    const days = C() ? C().weeklyDays(ev) : [];
    if (occ && (S.isISODate(ev.date) || days.length === 1)) {
      const today = occ === S.todayISO();
      const top = today ? t("events.today", "Today") : S.formatDate(occ, { weekday: "short" });
      const bottom = isPast(ev) ? S.formatDate(occ, { month: "short", year: "numeric" }) : S.formatDate(occ, { month: "short" });
      return `<div class="ev-date${today ? " is-today" : ""}"><small>${esc(top)}</small><b>${esc(S.formatDate(occ, { day: "numeric" }))}</b><small>${esc(bottom)}</small></div>`;
    }
    if (days.length > 1) {
      // e.g. Mon–Sat, localised from the first/last weekday codes
      const ref = { SU: "2026-10-04", MO: "2026-10-05", TU: "2026-10-06", WE: "2026-10-07", TH: "2026-10-08", FR: "2026-10-09", SA: "2026-10-10" };
      const range = S.formatDate(ref[days[0]], { weekday: "short" }) + "–" + S.formatDate(ref[days[days.length - 1]], { weekday: "short" });
      return `<div class="ev-date is-range"><small>${esc(t("events.weekly", "Weekly"))}</small><b>${esc(range)}</b></div>`;
    }
    const small = ev.recurrence && ev.recurrence.frequency === "ongoing" ? t("events.ongoing", "Ongoing") : t("events.weekly", "Weekly");
    return `<div class="ev-date is-range"><small>${esc(small)}</small><b>${esc(typeLabel(ev.type))}</b></div>`;
  }

  /* ---------- list ---------- */
  function filtered() {
    return (events || []).filter(isValid).filter(ev => (state.view === "past" ? isPast(ev) : !isPast(ev)))
      .filter(ev => state.type === "all" || ev.type === state.type)
      .filter(ev => state.mode === "all" || ev.mode === state.mode || (ev.mode === "hybrid" && state.mode !== "all"))
      .filter(ev => state.year === "all" || yearOf(ev) === state.year)
      .map((ev, i) => ({ ev, i, occ: occurrence(ev) || ev.date || "" }))
      .sort((a, b) => {
        if (state.view === "past") return (b.occ || "").localeCompare(a.occ || "");
        if (!a.occ !== !b.occ) return a.occ ? -1 : 1;           // known dates first
        return (a.occ || "").localeCompare(b.occ || "") || a.i - b.i;
      })
      .map(x => x.ev);
  }

  function row(ev) {
    const reg = registrationUrl(ev), past = isPast(ev);
    const meta = [
      timeText(ev) && `<span><svg class="icon" aria-hidden="true"><use href="#i-clock"/></svg>${esc(timeText(ev))}</span>`,
      pick(ev.venue) && `<span><svg class="icon" aria-hidden="true"><use href="#i-${ev.mode === "in-person" ? "pin" : "video"}"/></svg>${esc(pick(ev.venue))}</span>`
    ].filter(Boolean).join("");
    return `<li class="ev-card${past ? " is-past" : ""} type-${esc(ev.type || "other")}" id="event-${esc(ev.id)}">
      ${badge(ev)}
      <div class="ev-body">
        <p class="ev-type"><span class="ev-dot" aria-hidden="true"></span>${esc(typeLabel(ev.type))} · ${esc(modeLabel(ev.mode))}</p>
        <h3 lang="${esc(S.pickLangCode(ev.title))}">${esc(pick(ev.title))}</h3>
        ${meta ? `<p class="ev-meta">${meta}</p>` : ""}
        ${pick(ev.schedule) || pick(ev.audience) ? `<p class="ev-sub">${esc([pick(ev.schedule), pick(ev.audience)].filter(Boolean).join(" · "))}</p>` : ""}
        <div class="ev-actions">
          ${reg && !past ? `<a class="btn btn-green btn-sm" href="${esc(reg)}" target="_blank" rel="noopener">${esc(t("events.register", "Register free"))}</a>` : ""}
          <button class="btn btn-outline btn-sm" type="button" data-event-open="${esc(ev.id)}">${esc(past ? t("events.recap", "Recap") : t("events.details", "Details"))}</button>
        </div>
      </div>
    </li>`;
  }

  function renderToolbar() {
    if (!toolbar || !events) return;
    const valid = events.filter(isValid);
    const years = [...new Set(valid.map(yearOf).filter(Boolean))].sort().reverse();
    const types = [...new Set(valid.map(e => e.type).filter(Boolean))];
    const modes = [...new Set(valid.map(e => e.mode).filter(Boolean))];
    const opt = (v, txt, cur) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(txt)}</option>`;
    const select = (name, lbl, values, fmt) => values.length < 2 ? "" : `
      <label class="filter"><span>${esc(lbl)}</span>
        <select data-filter="${name}">${opt("all", t("filter.all", "All"), state[name])}${values.map(v => opt(v, fmt(v), state[name])).join("")}</select>
      </label>`;
    toolbar.innerHTML = `
      <div class="seg" role="group" aria-label="${esc(t("events.show", "Show"))}">
        <button type="button" data-view="upcoming" aria-pressed="${state.view === "upcoming"}">${esc(t("events.upcoming", "Upcoming"))}</button>
        <button type="button" data-view="past" aria-pressed="${state.view === "past"}">${esc(t("events.past", "Past"))}</button>
      </div>
      ${select("year", t("filter.year", "Year"), years, v => v)}
      ${select("type", t("filter.type", "Type"), types, typeLabel)}
      ${select("mode", t("filter.mode", "Mode"), modes, modeLabel)}`;
    toolbar.hidden = false;
  }

  function renderList() {
    if (!events) return;
    const items = filtered();
    list.innerHTML = items.map(row).join("");
    if (empty) {
      empty.hidden = items.length > 0;
      if (!items.length) empty.textContent = state.view === "past"
        ? t("events.emptyPast", "Past event recaps will appear here.")
        : t("events.emptyUpcoming", "No upcoming events match these filters.");
    }
  }

  /* ---------- detail dialog ---------- */
  function openEvent(id, opener) {
    const ev = (events || []).find(e => e.id === id);
    const dlg = $("#modal");
    if (!ev || !dlg) return;
    S.wireDialog(dlg);
    dlg.dataset.owner = "event:" + id;
    renderDetail(ev);
    S.openDialog(dlg, opener);
  }

  function renderDetail(ev) {
    const dlg = $("#modal"), body = dlg && $(".dialog-body", dlg);
    if (!body) return;
    const occ = occurrence(ev), reg = registrationUrl(ev), wa = S.safeUrl(ev.whatsapp_url), map = mapUrl(ev);
    const cal = C() && C().eligible(ev) ? C().googleUrl(ev) : null;
    const title = pick(ev.title), desc = pick(ev.description) || "";
    const when = [occ ? S.formatDate(occ, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "", pick(ev.schedule), timeText(ev)].filter(Boolean).join(" · ");
    const cover = S.safeUrl(ev.cover_image);
    const gallery = Array.isArray(ev.gallery) ? ev.gallery.filter(g => g && S.safeUrl(g.src || g)) : [];
    const shareText = [title, when].filter(Boolean).join(" · ");
    body.innerHTML = `
      ${cover ? `<div class="modal-cover"><img src="${esc(cover)}" alt="" loading="lazy" decoding="async"></div>` : ""}
      <p class="eyebrow">${esc(typeLabel(ev.type))} · ${esc(modeLabel(ev.mode))}</p>
      <h2 class="dialog-title" id="modal-title" lang="${esc(S.pickLangCode(ev.title))}">${esc(title)}</h2>
      ${desc ? `<p class="dialog-text" lang="${esc(S.pickLangCode(ev.description))}">${esc(desc)}</p>` : ""}
      <dl class="detail-list">
        ${when ? `<div><dt>${esc(t("events.when", "When"))}</dt><dd>${esc(when)}</dd></div>` : ""}
        ${pick(ev.venue) ? `<div><dt>${esc(t("events.where", "Where"))}</dt><dd>${esc([pick(ev.venue), pick(ev.location)].filter(Boolean).join(", "))}</dd></div>` : ""}
        ${pick(ev.audience) ? `<div><dt>${esc(t("events.for", "For"))}</dt><dd>${esc(pick(ev.audience))}</dd></div>` : ""}
      </dl>
      ${gallery.length ? `<div class="mini-gallery">${gallery.map((g, i) => `<button type="button" data-event-photo="${i}"><img src="${esc(S.safeUrl(g.src || g))}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>` : ""}
      <div class="dialog-actions">
        ${reg ? `<a class="btn btn-green" href="${esc(reg)}" target="_blank" rel="noopener">${esc(t("events.register", "Register free"))}</a>` : ""}
        ${wa ? `<a class="btn btn-outline" href="${esc(wa)}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-whatsapp"/></svg><span>${esc(t("events.whatsappGroup", "WhatsApp group"))}</span></a>` : ""}
        ${cal ? `<a class="btn btn-outline" href="${esc(cal)}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-calendar"/></svg><span>${esc(t("cal.google", "Google Calendar"))}</span></a>
                 <button class="btn btn-outline" type="button" data-event-ics="${esc(ev.id)}"><svg class="icon"><use href="#i-download"/></svg><span>${esc(t("cal.ics", "Download .ics"))}</span></button>` : ""}
        ${map ? `<a class="btn btn-outline" href="${esc(map)}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-pin"/></svg><span>${esc(t("events.map", "Map"))}</span></a>` : ""}
        ${S.share ? S.share.button({ title, text: shareText, url: "#event-" + ev.id }) : ""}
        ${S.share ? `<a class="btn btn-outline" href="${esc(S.share.whatsappHref([title, when, S.pageUrl("event-" + ev.id)].filter(Boolean).join("\n")))}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-whatsapp"/></svg><span>${esc(t("share.whatsapp", "WhatsApp"))}</span></a>` : ""}
      </div>
      ${!reg ? `<p class="dialog-note">${esc(t("events.noRegistration", "No registration needed online yet. Join a WhatsApp group or write to us for details."))}</p>` : ""}`;
    $$("[data-event-photo]", body).forEach(b => b.addEventListener("click", () => {
      if (S.lightbox) S.lightbox.open(gallery.map(g => ({ src: S.safeUrl(g.src || g), caption: pick(g.caption) || "" })), +b.dataset.eventPhoto, b);
    }));
  }

  /* ---------- yatra route from the timeline ----------
     The four most recent yatras, oldest to newest, as stations on one path.
     Purely symbolic: nodes are evenly spaced, not placed on a map. */
  function renderYatras(timeline) {
    const ul = $("#yatra-list");
    if (!ul) return;
    const yatras = (timeline || []).filter(m => m.category === "yatra" && m.period && m.period.start)
      .sort((a, b) => String(b.period.start).localeCompare(String(a.period.start))).slice(0, 4).reverse();
    if (!yatras.length) { ul.innerHTML = `<li class="yatra-empty">${esc(t("yatra.empty", "Yatra details will appear here."))}</li>`; return; }
    const last = yatras.length - 1;
    ul.innerHTML = yatras.map((m, i) => `<li class="yatra-stop${i === last ? " is-latest" : ""}" style="--i:${i}">
        <span class="yatra-node" aria-hidden="true"></span>
        <time datetime="${esc(m.period.start)}">${esc(S.formatDate(m.period.start))}</time>
        <b lang="${esc(S.pickLangCode(m.title))}">${esc(pick(m.title))}</b>
        <span class="yatra-desc" lang="${esc(S.pickLangCode(m.description))}">${esc(pick(m.description) || "")}</span>
        ${i === last ? `<span class="yatra-latest">${esc(t("yatra.latest", "Most recent"))}</span>` : ""}
      </li>`).join("");
  }

  /* ---------- wiring ---------- */
  list.addEventListener("click", e => {
    const b = e.target.closest("[data-event-open]");
    if (b) openEvent(b.dataset.eventOpen, b);
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-event-ics]");
    if (!b || !events) return;
    const ev = events.find(x => x.id === b.dataset.eventIcs);
    if (ev && C()) C().downloadIcs(ev);
  });
  if (toolbar) {
    toolbar.addEventListener("click", e => {
      const b = e.target.closest("[data-view]");
      if (!b) return;
      state.view = b.dataset.view;
      renderToolbar(); renderList();
    });
    toolbar.addEventListener("change", e => {
      const s = e.target.closest("[data-filter]");
      if (!s) return;
      state[s.dataset.filter] = s.value;
      renderList();
    });
  }

  function routeFromHash() {
    const m = /^#event-([\w-]+)$/.exec(location.hash);
    if (m && events) openEvent(m[1]);
  }
  window.addEventListener("hashchange", routeFromHash);

  let timelineCache = null;
  S.onLang(() => safe("events (lang)", () => {
    renderToolbar(); renderList(); renderYatras(timelineCache);
    const dlg = $("#modal");
    if (dlg && dlg.open && (dlg.dataset.owner || "").startsWith("event:")) {
      const ev = (events || []).find(e => "event:" + e.id === dlg.dataset.owner);
      if (ev) renderDetail(ev);
    }
  }));

  Promise.all([SHDP_DATA.getEvents(), S.siteReady]).then(([evs]) => {
    if (!evs) {
      if (empty) { empty.hidden = false; empty.textContent = t("events.loadError", "Event details couldn't load right now. Please check back soon, or follow us on YouTube."); }
      return;
    }
    events = evs;
    safe("events render", () => { renderToolbar(); renderList(); routeFromHash(); });
  });
  SHDP_DATA.getTimeline().then(tl => { timelineCache = tl; safe("yatra card", () => renderYatras(tl)); });

  S.events = { open: openEvent, get list() { return events; }, typeLabel, modeLabel };
})();
