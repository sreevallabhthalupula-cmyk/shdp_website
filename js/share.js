/* SHDP sharing: native Web Share where available, otherwise a small dialog with
   WhatsApp + Copy link. Any element with [data-share] becomes a share button:
     data-share-title, data-share-text, data-share-url (absolute or "#hash") */
(() => {
  const S = window.SHDP;
  if (!S) return;
  const { $, esc, t } = S;

  const whatsappHref = text => "https://wa.me/?text=" + encodeURIComponent(text);

  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (_) { /* fall through */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }

  const resolveUrl = u => (!u ? S.pageUrl() : u.startsWith("#") ? S.pageUrl(u) : u);

  function openFallback({ title, text, url }, opener) {
    const dlg = $("#share-dialog");
    if (!dlg) { copy(url).then(ok => S.toast(ok ? t("toast.linkCopied", "Link copied") : url)); return; }
    S.wireDialog(dlg);
    const body = $(".dialog-body", dlg);
    const message = [title, text, url].filter(Boolean).join("\n\n");
    body.innerHTML = `
      <h2 class="dialog-title" id="share-dialog-title">${esc(t("share.title", "Share"))}</h2>
      <p class="dialog-sub">${esc(title || "")}</p>
      <div class="share-actions">
        <a class="btn btn-green" href="${esc(whatsappHref(message))}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-whatsapp"/></svg><span>${esc(t("share.whatsapp", "WhatsApp"))}</span></a>
        <button class="btn btn-outline" type="button" data-copy-link><svg class="icon"><use href="#i-link"/></svg><span>${esc(t("share.copyLink", "Copy link"))}</span></button>
      </div>
      <p class="share-url">${esc(url)}</p>`;
    $("[data-copy-link]", body).addEventListener("click", () => copy(url).then(ok => S.toast(ok ? t("toast.linkCopied", "Link copied") : t("toast.copyFailed", "Couldn't copy. Please copy the link shown."))));
    S.openDialog(dlg, opener);
  }

  async function share(payload, opener) {
    const data = { title: payload.title || document.title, text: payload.text || "", url: resolveUrl(payload.url) };
    if (navigator.share) {
      try { await navigator.share(data); return; }
      catch (err) { if (err && err.name === "AbortError") return; /* otherwise fall back */ }
    }
    openFallback(data, opener);
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-share]");
    if (!btn) return;
    e.preventDefault();
    share({ title: btn.dataset.shareTitle, text: btn.dataset.shareText, url: btn.dataset.shareUrl }, btn);
  });

  // HTML for a standard share button (callers pass already-picked language strings)
  const button = ({ title, text, url, label, cls = "btn btn-outline btn-sm" }) =>
    `<button type="button" class="${cls}" data-share data-share-title="${esc(title)}" data-share-text="${esc(text || "")}" data-share-url="${esc(url || "")}"><svg class="icon"><use href="#i-share"/></svg><span>${esc(label || t("share.label", "Share"))}</span></button>`;

  S.share = { share, copy, whatsappHref, button, resolveUrl };
})();
