/* SHDP Serve & Connect: one form, two modes (Volunteer / Express interest).
   - Options (seva areas, skills, availability, interests...) come from data/community.json.
   - Submissions go straight to the protected Supabase function submit_registration()
     with the public anon key (js/supabase-config.js). Nothing personal is kept in the
     browser: no localStorage, no cookies, no URL parameters.
   - Without backend configuration the form is replaced by an honest "opens shortly" note. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const { $, $$, esc, t, pick, safe } = S;

  const form = $("#serve-form");
  if (!form) return;
  const body = $("#serve-body", form), done = $("#serve-done", form), closed = $("#serve-closed", form);
  const status = $("#serve-status", form), submitBtn = $("#serve-submit", form);
  const modeSet = $(".serve-mode", form);

  const cfg = window.SHDP_BACKEND || {};
  const backendUrl = typeof cfg.supabaseUrl === "string" && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl) ? cfg.supabaseUrl : null;
  const anonKey = typeof cfg.supabaseAnonKey === "string" && /^[A-Za-z0-9._-]{20,}$/.test(cfg.supabaseAnonKey) && !/^sb_secret_/.test(cfg.supabaseAnonKey) ? cfg.supabaseAnonKey : null;
  const open = !!(backendUrl && anonKey);

  let options = null;
  const mode = () => (($("input[name=type]:checked", form) || {}).value === "interest" ? "interest" : "volunteer");

  /* ---------- options from data/community.json ---------- */
  function renderOptions() {
    if (!options) return;
    $$("[data-options]", form).forEach(box => safe("serve options", () => {
      const list = Array.isArray(options[box.dataset.options]) ? options[box.dataset.options] : [];
      if (box.tagName === "SELECT") {
        const keep = box.value;
        box.innerHTML = `<option value="">${esc(t("serve.choose", "Choose…"))}</option>` +
          list.map(o => `<option value="${esc(o.id)}">${esc(pick(o.label) || o.id)}</option>`).join("");
        box.value = keep;
        return;
      }
      const name = box.dataset.name;
      const picked = new Set($$("input:checked", box).map(i => i.value));
      const tiles = box.classList.contains("seva-tiles");
      box.innerHTML = list.map(o => {
        const id = `sfo-${name}-${o.id}`.replace(/[^\w-]/g, ""); // own prefix: never collides with fixed field ids
        const label = esc(pick(o.label) || o.id);
        const chk = picked.has(o.id) ? " checked" : "";
        if (tiles) {
          const icon = /^i-[\w-]+$/.test(o.icon || "") ? o.icon : "i-leaf";
          return `<label class="tile" for="${id}"><input type="checkbox" id="${id}" name="${esc(name)}" value="${esc(o.id)}"${chk}>
            <span class="tile-face"><svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg>
            <span><b>${label}</b>${o.note ? `<small>${esc(pick(o.note) || "")}</small>` : ""}</span></span></label>`;
        }
        return `<label class="chip" for="${id}"><input type="checkbox" id="${id}" name="${esc(name)}" value="${esc(o.id)}"${chk}${o.other ? " data-other" : ""}><span>${label}</span></label>`;
      }).join("");
      box.closest(".choice-block") && (box.closest(".choice-block").hidden = !list.length);
    }));
    syncOther();
  }

  /* ---------- mode ---------- */
  function applyMode() {
    const m = mode();
    $$("[data-for]", form).forEach(el => { el.hidden = el.dataset.for !== m; });
    const loc = $("#sf-location", form);
    if (loc) { loc.required = m === "volunteer"; if (m !== "volunteer") clearErr(loc); }
    form.dataset.mode = m;
  }
  function setMode(m, interest) {
    const r = $(`input[name=type][value="${m === "interest" ? "interest" : "volunteer"}"]`, form);
    if (r) r.checked = true;
    applyMode();
    if (interest) {
      const box = $(`input[name=interest_area][value="${CSS.escape(interest)}"]`, form);
      if (box) box.checked = true; else form.dataset.pendingInterest = interest;
    }
  }
  form.addEventListener("change", e => {
    if (e.target.name === "type") applyMode();
    if (e.target.matches("[data-other]")) syncOther();
    if (e.target.id === "sf-age") { const n = $("#sf-age-note", form); if (n) n.hidden = e.target.value !== "under_18"; }
    if (e.target.closest(".field") && e.target.getAttribute("aria-invalid") === "true") validateField(e.target);
  });
  form.addEventListener("input", e => { if (e.target.getAttribute("aria-invalid") === "true") validateField(e.target); });
  function syncOther() {
    const other = $("[data-other]", form), wrap = $("#sf-skills-other-wrap", form);
    if (wrap) wrap.hidden = !(other && other.checked);
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-serve-mode]");
    if (a) setMode(a.dataset.serveMode, a.dataset.serveInterest);
  });

  /* ---------- validation (mirrors the database checks) ---------- */
  function normalizePhone(raw) {
    let p = String(raw || "").replace(/[\s().-]/g, "");
    if (/^[6-9]\d{9}$/.test(p)) p = "+91" + p;
    else if (/^0[6-9]\d{9}$/.test(p)) p = "+91" + p.slice(1);
    else if (/^00[1-9]\d{7,14}$/.test(p)) p = "+" + p.slice(2);
    if (!/^\+[1-9]\d{7,14}$/.test(p) || /^(\d)\1{7,}$/.test(p.slice(1)) || /^\+(\d)\1+$/.test(p)) return null;
    return p;
  }
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const MSG = {
    name: () => t("serve.errName", "Please enter your name."),
    phone: () => t("serve.errPhone", "Please enter a valid phone number. Indian mobile numbers have 10 digits; others need the country code, like +44."),
    email: () => t("serve.errEmail", "This email address does not look right."),
    location: () => t("serve.errLocation", "Please tell us your city or area."),
    consent: () => t("serve.errConsent", "Please tick the box so we may contact you.")
  };
  function errEl(input) { return $("#" + input.id + "-err", form); }
  function setErr(input, msg) {
    const el = errEl(input);
    input.setAttribute("aria-invalid", "true");
    if (el) { el.textContent = msg; el.hidden = false; }
  }
  function clearErr(input) {
    const el = errEl(input);
    input.removeAttribute("aria-invalid");
    if (el) { el.textContent = ""; el.hidden = true; }
  }
  function validateField(input) {
    const v = (input.value || "").trim();
    let bad = null;
    if (input.name === "name" && v.replace(/\s+/g, " ").length < 2) bad = "name";
    if (input.name === "phone" && !normalizePhone(v)) bad = "phone";
    if (input.name === "email" && v && (v.length > 254 || !EMAIL.test(v))) bad = "email";
    if (input.name === "location" && input.required && !v) bad = "location";
    if (input.name === "consent" && !input.checked) bad = "consent";
    bad ? setErr(input, MSG[bad]()) : clearErr(input);
    return !bad;
  }
  function validateAll() {
    const fields = ["sf-name", "sf-phone", "sf-email", "sf-location", "sf-consent"].map(id => $("#" + id, form)).filter(Boolean);
    const bad = fields.filter(f => !validateField(f));
    if (bad.length) bad[0].focus();
    return !bad.length;
  }

  /* ---------- submit ---------- */
  const values = name => $$(`input[name="${name}"]:checked`, form).filter(i => !i.closest("[hidden]")).map(i => i.value);
  const val = name => { const el = form.elements[name]; return el && !el.closest("[hidden]") ? String(el.value || "").trim() : ""; };

  function payload() {
    const m = mode();
    const p = {
      type: m, name: val("name").replace(/\s+/g, " "), phone: normalizePhone(val("phone")), email: val("email") || null,
      location: val("location") || null, age_group: val("age_group") || null, message: val("message") || null,
      consent: !!(form.elements.consent && form.elements.consent.checked), language: S.lang, website: (form.elements.website || {}).value || ""
    };
    if (m === "volunteer") Object.assign(p, {
      seva_areas: values("seva_areas"), skills: values("skills"),
      skills_other: values("skills").includes("other") ? val("skills_other") || null : null,
      contribution: val("contribution") || null, availability: values("availability"), experience: val("experience") || null
    });
    else Object.assign(p, { interest_area: values("interest_area"), contact_preference: values("contact_preference") });
    return p;
  }

  const ERR = {
    rate_limited: () => t("serve.errRate", "We have already received several requests from you today. Thank you, the team will be in touch."),
    invalid_phone: MSG.phone, invalid_email: MSG.email, invalid_name: MSG.name, invalid_location: MSG.location, consent_required: MSG.consent
  };
  function setBusy(on) {
    form.classList.toggle("is-busy", on);
    form.setAttribute("aria-busy", String(on));
    if (submitBtn) { submitBtn.disabled = on; const l = $(".btn-label", submitBtn); if (l) l.textContent = on ? t("serve.sending", "Sending…") : t("serve.submit", "Send my details"); }
  }
  function showStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg || "";
    status.className = "serve-status" + (kind ? " is-" + kind : "");
  }

  async function send(p) {
    const headers = { "Content-Type": "application/json", apikey: anonKey };
    // legacy anon keys are JWTs and go in Authorization too; new publishable keys use apikey only
    if (!/^sb_publishable_/.test(anonKey)) headers.Authorization = "Bearer " + anonKey;
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(backendUrl + "/rest/v1/rpc/submit_registration", {
        method: "POST", headers, body: JSON.stringify({ payload: p }), signal: ctrl ? ctrl.signal : undefined,
        credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer"
      });
      if (res.ok) return { ok: true };
      let code = "server";
      try { const j = await res.json(); if (j && typeof j.message === "string" && ERR[j.message]) code = j.message; } catch (_) {}
      return { ok: false, code };
    } catch (_) {
      return { ok: false, code: "network" };
    } finally { if (timer) clearTimeout(timer); }
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!open || form.classList.contains("is-busy")) return;
    showStatus("");
    if (!validateAll()) { showStatus(t("serve.fixErrors", "Please check the highlighted fields."), "error"); return; }
    const p = payload();
    setBusy(true);
    const r = p.website ? { ok: true } : await send(p); // honeypot filled: pretend success, send nothing
    setBusy(false);
    if (r.ok) {
      body.hidden = true; if (modeSet) modeSet.hidden = true;
      done.hidden = false;
      requestAnimationFrame(() => done.classList.add("is-shown"));
      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: "center", behavior: S.reduceMotion ? "auto" : "smooth" });
      return;
    }
    if (ERR[r.code] && r.code.startsWith("invalid_")) {
      const field = { invalid_phone: "sf-phone", invalid_email: "sf-email", invalid_name: "sf-name", invalid_location: "sf-location" }[r.code];
      const el = field && $("#" + field, form);
      if (el) { setErr(el, ERR[r.code]()); el.focus(); }
    }
    showStatus(ERR[r.code] ? ERR[r.code]() : r.code === "network"
      ? t("serve.errNetwork", "Could not send. Please check your internet connection and try again. Your answers are still here.")
      : t("serve.errServer", "Something went wrong on our side. Please try again in a few minutes, or email us."), "error");
  });

  const again = $("#serve-again", form);
  if (again) again.addEventListener("click", () => {
    form.reset();
    $$("[aria-invalid]", form).forEach(clearErr);
    done.classList.remove("is-shown"); done.hidden = true;
    body.hidden = false; if (modeSet) modeSet.hidden = false;
    applyMode(); syncOther(); showStatus("");
    const n = $("#sf-name", form); if (n) n.focus();
  });

  /* ---------- start ---------- */
  applyMode();
  if (!open) {
    // honest closed state: no fields to fill that could not be sent
    body.hidden = true; if (modeSet) modeSet.hidden = true; if (closed) closed.hidden = false;
    form.classList.add("is-closed");
    S.siteReady.then(site => {
      const email = site && S.getPath(site, "contact.email");
      const a = $("#serve-closed-email", form);
      if (a && typeof email === "string" && email.includes("@")) a.href = "mailto:" + email;
    });
  }
  SHDP_DATA.getCommunityOptions().then(o => {
    options = o;
    safe("serve render", () => {
      renderOptions();
      if (form.dataset.pendingInterest) { setMode("interest", form.dataset.pendingInterest); delete form.dataset.pendingInterest; }
    });
  });
  S.onLang(() => safe("serve (lang)", () => {
    renderOptions();
    // messages already on screen follow the new language too
    $$('[aria-invalid="true"]', form).forEach(validateField);
    if (status && status.classList.contains("is-error") && $$('[aria-invalid="true"]', form).length) showStatus(t("serve.fixErrors", "Please check the highlighted fields."), "error");
  }));

  S.community = { setMode, get open() { return open; } };
})();
