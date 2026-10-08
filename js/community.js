/* SHDP Serve & Connect: a short form for volunteers and members who want to take part.
   Submissions go to Netlify Forms (form name "serve-connect"): they are stored privately in the
   Netlify dashboard and can be downloaded there as CSV for Excel. Nothing personal is kept in the
   browser (no localStorage, no cookies, no URL parameters). Without JavaScript the form still
   posts normally to Netlify. */
(() => {
  const S = window.SHDP;
  if (!S) return;
  const { $, $$, t, safe } = S;

  const form = $("#serve-form");
  if (!form) return;
  const body = $("#serve-body", form), done = $("#serve-done", form), modeSet = $(".serve-mode", form);
  const status = $("#serve-status", form), submitBtn = $("#serve-submit", form);

  /* ---------- validation ---------- */
  function normalizePhone(raw) {
    let p = String(raw || "").replace(/[\s().-]/g, "");
    if (/^[6-9]\d{9}$/.test(p)) p = "+91" + p;
    else if (/^0[6-9]\d{9}$/.test(p)) p = "+91" + p.slice(1);
    else if (/^00[1-9]\d{7,14}$/.test(p)) p = "+" + p.slice(2);
    if (!/^\+[1-9]\d{7,14}$/.test(p) || /^(\d)\1{7,}$/.test(p.slice(1))) return null;
    return p;
  }
  const MSG = {
    name: () => t("serve.errName", "Please enter your name."),
    phone: () => t("serve.errPhone", "Please enter a valid phone number. Indian mobile numbers have 10 digits; others need the country code, like +44."),
    service: () => t("serve.errService", "Please tell us briefly how you would like to help or take part.")
  };
  const errEl = input => $("#" + input.id + "-err", form);
  function setErr(input, msg) { input.setAttribute("aria-invalid", "true"); const e = errEl(input); if (e) { e.textContent = msg; e.hidden = false; } }
  function clearErr(input) { input.removeAttribute("aria-invalid"); const e = errEl(input); if (e) { e.textContent = ""; e.hidden = true; } }
  function validateField(input) {
    const v = (input.value || "").trim();
    let bad = null;
    if (input.name === "name" && v.replace(/\s+/g, " ").length < 2) bad = "name";
    if (input.name === "phone" && !normalizePhone(v)) bad = "phone";
    if (input.name === "service" && v.length < 2) bad = "service";
    bad ? setErr(input, MSG[bad]()) : clearErr(input);
    return !bad;
  }
  const fields = () => ["sf-name", "sf-phone", "sf-service"].map(id => $("#" + id, form)).filter(Boolean);
  form.addEventListener("input", e => { if (e.target.getAttribute("aria-invalid") === "true") validateField(e.target); });

  function setBusy(on) {
    form.classList.toggle("is-busy", on);
    form.setAttribute("aria-busy", String(on));
    if (!submitBtn) return;
    submitBtn.disabled = on;
    const l = $(".btn-label", submitBtn);
    if (l) l.textContent = on ? t("serve.sending", "Sending…") : t("serve.submit", "Send my details");
  }
  function showStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg || "";
    status.className = "serve-status" + (kind ? " is-" + kind : "");
  }

  /* ---------- submit (Netlify expects url-encoded fields, including form-name) ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (form.classList.contains("is-busy")) return;
    showStatus("");
    const bad = fields().filter(f => !validateField(f));
    if (bad.length) { bad[0].focus(); showStatus(t("serve.fixErrors", "Please check the highlighted fields."), "error"); return; }

    const data = new FormData(form);
    data.set("name", String(data.get("name") || "").trim().replace(/\s+/g, " "));
    data.set("phone", normalizePhone(data.get("phone")));
    data.set("service", String(data.get("service") || "").trim());
    data.set("language", S.lang === "te" ? "Telugu" : "English");

    setBusy(true);
    let ok = false;
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data).toString(),
        credentials: "same-origin", cache: "no-store"
      });
      ok = res.ok;
    } catch (_) { ok = false; }
    setBusy(false);

    if (ok) {
      body.hidden = true; if (modeSet) modeSet.hidden = true;
      done.hidden = false;
      requestAnimationFrame(() => done.classList.add("is-shown"));
      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: "center", behavior: S.reduceMotion ? "auto" : "smooth" });
    } else {
      showStatus(t("serve.errSend", "Could not send just now. Please check your connection and try again, or email sriharithadharmaparishad@gmail.com. Your answers are still here."), "error");
    }
  });

  const again = $("#serve-again", form);
  if (again) again.addEventListener("click", () => {
    form.reset();
    fields().forEach(clearErr);
    done.classList.remove("is-shown"); done.hidden = true;
    body.hidden = false; if (modeSet) modeSet.hidden = false;
    showStatus("");
    const n = $("#sf-name", form); if (n) n.focus();
  });

  /* header / drawer "Volunteer" and yatra buttons pre-select the right option */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-serve-mode]");
    if (!a) return;
    const r = $$('input[name="interested_as"]', form)[a.dataset.serveMode === "interest" ? 1 : 0];
    if (r) r.checked = true;
  });

  // messages already on screen follow a language switch
  S.onLang(() => safe("serve (lang)", () => {
    const invalid = $$('[aria-invalid="true"]', form);
    invalid.forEach(validateField);
    if (status && status.classList.contains("is-error")) showStatus(invalid.length ? t("serve.fixErrors", "Please check the highlighted fields.")
      : t("serve.errSend", "Could not send just now. Please check your connection and try again, or email sriharithadharmaparishad@gmail.com. Your answers are still here."), "error");
  }));
})();
