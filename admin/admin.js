/* SHDP operator dashboard.
   Reads community registrations through Supabase with the signed-in operator's session.
   Row Level Security on the server decides what is visible: a signed-in account that is
   not listed in public.operators sees nothing. The session lives in sessionStorage only
   (closed with the tab). No registration data is ever written to browser storage. */
(() => {
  const $ = s => document.querySelector(s);
  const views = { config: $("#view-config"), login: $("#view-login"), dash: $("#view-dash") };
  const show = name => Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });

  const cfg = window.SHDP_BACKEND || {};
  const url = typeof cfg.supabaseUrl === "string" && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl) ? cfg.supabaseUrl : null;
  const key = typeof cfg.supabaseAnonKey === "string" && /^[A-Za-z0-9._-]{20,}$/.test(cfg.supabaseAnonKey) && !/^sb_secret_/.test(cfg.supabaseAnonKey) ? cfg.supabaseAnonKey : null;
  if (!url || !key || !window.supabase) { show("config"); return; }

  const sb = window.supabase.createClient(url, key, {
    auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const COLS = "id,created_at,updated_at,type,name,phone,email,location,age_group,interest_area,seva_areas,skills,skills_other,contribution,availability,experience,contact_preference,message,language,consent,status,notes";
  const STATUS = { new: "New", contacted: "Contacted", follow_up: "Follow-up", completed: "Completed", archived: "Archived" };
  const TYPE = { volunteer: "Volunteer", interest: "Interest" };
  let rows = [], labels = {}, current = null;

  /* option ids -> readable English labels, from the same public config the form uses */
  fetch("../data/community.json", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => {
    if (!d) return;
    ["seva_areas", "skills", "availability", "interest_areas", "contact_preference", "age_groups"].forEach(group => {
      (d[group] || []).forEach(o => { if (o && o.id) labels[group + ":" + o.id] = (o.label && (o.label.en || o.label.te)) || o.id; });
    });
    if (rows.length) render();
  }).catch(() => {});
  const lbl = (group, id) => labels[group + ":" + id] || String(id).replace(/_/g, " ");
  const names = (group, arr) => (Array.isArray(arr) ? arr.map(x => lbl(group, x)) : []).join(", ");

  const fmtDate = iso => { try { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch (_) { return iso; } };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const interestOf = r => [names("seva_areas", r.seva_areas), names("interest_areas", r.interest_area)].filter(Boolean).join(" · ");
  const skillsOf = r => [names("skills", (r.skills || []).filter(s => s !== "other")), r.skills_other].filter(Boolean).join(", ");

  /* ---------- auth ---------- */
  async function start() {
    const { data } = await sb.auth.getSession();
    if (data && data.session) await enter(data.session); else show("login");
  }
  async function enter(session) {
    // ask the database, not the client, whether this account is an operator
    const { data: ok, error } = await sb.rpc("is_operator");
    if (error || ok !== true) {
      await sb.auth.signOut();
      show("login");
      $("#login-msg").textContent = error ? "Could not verify access. Please try again." : "This account does not have operator access.";
      return;
    }
    $("#who").textContent = session.user && session.user.email ? session.user.email : "";
    $("#session-actions").hidden = false;
    show("dash");
    await load();
  }
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#login-email").value.trim(), password = $("#login-password").value;
    const msg = $("#login-msg"), btn = $("#login-submit");
    msg.textContent = "";
    if (!email || !password) { msg.textContent = "Enter your email and password."; return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = "Sign in";
    $("#login-password").value = "";
    if (error || !data.session) { msg.textContent = "Sign-in failed. Check the email and password."; return; }
    await enter(data.session);
  });
  $("#logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    rows = []; $("#rows").replaceChildren(); $("#stats").replaceChildren();
    $("#session-actions").hidden = true;
    show("login");
  });

  /* ---------- data ---------- */
  async function load() {
    const msg = $("#dash-msg");
    msg.textContent = "";
    $("#refresh").disabled = true;
    const { data, error } = await sb.from("community_registrations").select(COLS).order("created_at", { ascending: false }).range(0, 4999);
    $("#refresh").disabled = false;
    if (error) { msg.textContent = "Could not load registrations: " + error.message; return; }
    rows = data || [];
    render();
  }
  $("#refresh").addEventListener("click", load);

  function filtered() {
    const q = $("#f-q").value.trim().toLowerCase(), type = $("#f-type").value, st = $("#f-status").value, asc = $("#f-sort").value === "asc";
    return rows.filter(r => (type === "all" || r.type === type)
        && (st === "all" || (st === "active" ? r.status !== "archived" : r.status === st))
        && (!q || [r.name, r.phone, r.email, r.location, r.message, r.contribution, r.experience, r.notes, r.skills_other].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (asc ? 1 : -1) * String(a.created_at).localeCompare(String(b.created_at)));
  }

  function render() {
    // totals
    const c = s => rows.filter(r => r.status === s).length;
    const stats = [["Total", rows.length], ["New", c("new")], ["Contacted", c("contacted")], ["Follow-up", c("follow_up")], ["Completed", c("completed")]];
    $("#stats").replaceChildren(...stats.map(([k, v]) => { const li = el("li"); li.append(el("b", null, String(v)), el("span", null, k)); return li; }));

    const list = filtered(), body = $("#rows");
    body.replaceChildren(...list.map(r => {
      const tr = el("tr");
      tr.dataset.id = r.id;
      // long text is clamped inside a span: the cell itself must stay a table cell
      const td = (text, cls) => {
        if (cls !== "clip") return el("td", cls, text || "—");
        const d = el("td", "clip"), s = el("span", null, text || "—");
        if (text) d.title = text;
        d.append(s); return d;
      };
      tr.append(td(fmtDate(r.created_at), "nowrap"), td(TYPE[r.type] || r.type, "type type-" + r.type), td(r.name, "strong"));
      const tel = el("td", "nowrap"); const a = el("a", null, r.phone); a.href = "tel:" + r.phone; tel.append(a); tr.append(tel);
      const em = el("td"); if (r.email) { const m = el("a", null, r.email); m.href = "mailto:" + r.email; em.append(m); } else em.textContent = "—"; tr.append(em);
      tr.append(td(r.location), td(interestOf(r), "clip"), td(skillsOf(r), "clip"), td(r.contribution, "clip"), td(names("availability", r.availability), "clip"));
      const sTd = el("td"), sel = el("select", "status status-" + r.status);
      sel.setAttribute("aria-label", "Status for " + r.name);
      Object.entries(STATUS).forEach(([v, l]) => { const o = el("option", null, l); o.value = v; if (v === r.status) o.selected = true; sel.append(o); });
      sel.addEventListener("change", () => setStatus(r, sel.value, sel));
      sTd.append(sel); tr.append(sTd);
      const vTd = el("td"), b = el("button", "btn btn-quiet btn-sm", "View");
      b.type = "button"; b.addEventListener("click", () => openDetail(r)); vTd.append(b); tr.append(vTd);
      return tr;
    }));
    $("#empty").hidden = list.length > 0;
    $("#count").textContent = `${list.length} of ${rows.length} shown`;
  }
  ["#f-q", "#f-type", "#f-status", "#f-sort"].forEach(s => $(s).addEventListener(s === "#f-q" ? "input" : "change", render));

  async function setStatus(r, status, control) {
    const before = r.status;
    if (control) control.disabled = true;
    const { error } = await sb.from("community_registrations").update({ status }).eq("id", r.id);
    if (control) control.disabled = false;
    if (error) {
      if (control) control.value = before;
      $("#dash-msg").textContent = "Status not saved: " + error.message;
      return false;
    }
    r.status = status;
    render();
    return true;
  }

  /* ---------- detail ---------- */
  const dlg = $("#detail");
  function openDetail(r) {
    current = r;
    $("#detail-title").textContent = r.name;
    $("#detail-sub").textContent = `${TYPE[r.type] || r.type} · ${fmtDate(r.created_at)} · ${r.language === "te" ? "Telugu" : "English"} form`;
    const pairs = [
      ["Phone", r.phone], ["Email", r.email], ["Location", r.location], ["Age group", r.age_group ? lbl("age_groups", r.age_group) : ""],
      ["Seva areas", names("seva_areas", r.seva_areas)], ["Skills", skillsOf(r)], ["What they can offer", r.contribution],
      ["Availability", names("availability", r.availability)], ["Experience", r.experience],
      ["Areas of interest", names("interest_areas", r.interest_area)], ["Stay connected by", names("contact_preference", r.contact_preference)],
      ["Message", r.message], ["Consent", r.consent ? "Given" : "No"], ["Last updated", fmtDate(r.updated_at)]
    ].filter(([, v]) => v);
    $("#detail-kv").replaceChildren(...pairs.flatMap(([k, v]) => [el("dt", null, k), el("dd", null, v)]));
    $("#detail-status").value = r.status;
    $("#detail-notes").value = r.notes || "";
    $("#detail-msg").textContent = "";
    dlg.showModal();
  }
  $("#detail-save").addEventListener("click", async () => {
    if (!current) return;
    const status = $("#detail-status").value, notes = $("#detail-notes").value.trim() || null;
    const btn = $("#detail-save"); btn.disabled = true;
    const { error } = await sb.from("community_registrations").update({ status, notes }).eq("id", current.id);
    btn.disabled = false;
    if (error) { $("#detail-msg").textContent = "Not saved: " + error.message; return; }
    current.status = status; current.notes = notes;
    render();
    dlg.close();
  });

  /* ---------- CSV export (opens in Excel, Google Sheets, LibreOffice) ---------- */
  // cells that start with = + - @ (or tab/CR) are prefixed with ' so spreadsheets never run them as formulas
  const cell = v => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  $("#export").addEventListener("click", () => {
    const list = filtered();
    const head = ["Date", "Type", "Name", "Phone", "Email", "Location", "Age Group", "Interest Area", "Skills", "Contribution", "Availability", "Experience", "Message", "Status"];
    const lines = list.map(r => [
      fmtDate(r.created_at), TYPE[r.type] || r.type, r.name, r.phone, r.email, r.location, r.age_group ? lbl("age_groups", r.age_group) : "",
      interestOf(r), skillsOf(r), r.contribution, names("availability", r.availability), r.experience, r.message, STATUS[r.status] || r.status
    ].map(cell).join(","));
    const csv = "﻿" + [head.map(cell).join(","), ...lines].join("\r\n"); // BOM keeps Telugu readable in Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    a.href = URL.createObjectURL(blob);
    a.download = `shdp-registrations-${d}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  sb.auth.onAuthStateChange(evt => { if (evt === "SIGNED_OUT") { rows = []; show("login"); } });
  start();
})();
