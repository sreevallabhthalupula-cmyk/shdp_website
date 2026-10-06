/* SHDP calendar helpers: next occurrence of recurring events, Google Calendar links
   and downloadable .ics files. Calendar data is produced ONLY when the event has a
   real date (or weekly days), a start time and an end time; nothing is guessed.
   Times are entered in the event's timezone (India, UTC+05:30, no DST) and emitted as UTC. */
(() => {
  const S = window.SHDP;
  if (!S) return;

  const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const OFFSETS = { "Asia/Kolkata": 330 }; // minutes east of UTC; extend if other zones are ever used

  const isoToUTCDate = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const utcDateToISO = d => d.toISOString().slice(0, 10);
  const weekdayCode = iso => DAY_CODES[isoToUTCDate(iso).getUTCDay()];

  const isWeekly = ev => ev && ev.recurrence && ev.recurrence.frequency === "weekly";
  const weeklyDays = ev => (isWeekly(ev) && Array.isArray(ev.recurrence.days) ? ev.recurrence.days.filter(d => DAY_CODES.includes(d)) : []);

  // Next date (YYYY-MM-DD, India time) this event happens on or after `fromISO`, or null if unknown.
  function nextOccurrence(ev, fromISO = S.todayISO()) {
    if (!ev) return null;
    if (S.isISODate(ev.date)) return ev.date >= fromISO ? ev.date : null;
    const days = weeklyDays(ev);
    if (!days.length) return null;
    const d = isoToUTCDate(fromISO);
    for (let i = 0; i < 7; i++) {
      const iso = utcDateToISO(new Date(d.getTime() + i * 86400000));
      if (days.includes(weekdayCode(iso))) return iso;
    }
    return null;
  }

  function eligible(ev) {
    if (!ev || ev.calendar === false) return false;
    if (!S.isTime(ev.start_time) || !S.isTime(ev.end_time) || ev.end_time <= ev.start_time) return false;
    if (!((ev.timezone || "Asia/Kolkata") in OFFSETS)) return false;
    return S.isISODate(ev.date) || weeklyDays(ev).length > 0;
  }

  // "YYYYMMDDTHHMMSSZ" in UTC for a local date + HH:MM in the event's timezone
  function stamp(iso, hhmm, tz) {
    const [y, m, d] = iso.split("-").map(Number);
    const [h, mi] = hhmm.split(":").map(Number);
    const ms = Date.UTC(y, m - 1, d, h, mi) - (OFFSETS[tz || "Asia/Kolkata"] || 0) * 60000;
    return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function parts(ev, lang) {
    const pick = f => (f == null ? "" : typeof f === "string" ? f : (f[lang] || f.en || ""));
    const date = S.isISODate(ev.date) ? ev.date : nextOccurrence(ev);
    if (!date) return null;
    const tz = ev.timezone || "Asia/Kolkata";
    const days = weeklyDays(ev);
    return {
      title: pick(ev.title),
      description: [pick(ev.description), S.pageUrl("event-" + ev.id)].filter(Boolean).join("\n\n"),
      location: [pick(ev.venue), pick(ev.location)].filter(Boolean).join(", "),
      start: stamp(date, ev.start_time, tz),
      end: stamp(date, ev.end_time, tz),
      rrule: !S.isISODate(ev.date) && days.length ? `FREQ=WEEKLY;BYDAY=${days.join(",")}` : null,
      uid: `${ev.id}-${date}@sriharithadharmaparishad`
    };
  }

  function googleUrl(ev, lang = S.lang) {
    if (!eligible(ev)) return null;
    const p = parts(ev, lang);
    if (!p) return null;
    const q = new URLSearchParams({ action: "TEMPLATE", text: p.title, dates: `${p.start}/${p.end}`, details: p.description, location: p.location });
    if (p.rrule) q.set("recur", "RRULE:" + p.rrule);
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }

  // RFC 5545 text escaping + line folding at 75 octets (UTF-8 safe)
  const icsText = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  function fold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = []; let cur = "", limit = 75;
    for (const ch of line) {
      if (enc.encode(cur + ch).length > limit) { out.push(cur); cur = " " + ch; limit = 75; }
      else cur += ch;
    }
    out.push(cur);
    return out.join("\r\n");
  }

  function ics(ev, lang = S.lang) {
    if (!eligible(ev)) return null;
    const p = parts(ev, lang);
    if (!p) return null;
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sri Haritha Dharma Parishad//Website//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${p.uid}`, `DTSTAMP:${now}`, `DTSTART:${p.start}`, `DTEND:${p.end}`,
      p.rrule ? `RRULE:${p.rrule}` : null,
      `SUMMARY:${icsText(p.title)}`,
      p.description ? `DESCRIPTION:${icsText(p.description)}` : null,
      p.location ? `LOCATION:${icsText(p.location)}` : null,
      `URL:${S.pageUrl("event-" + ev.id)}`,
      "END:VEVENT", "END:VCALENDAR"
    ].filter(Boolean).map(fold);
    return lines.join("\r\n") + "\r\n";
  }

  function downloadIcs(ev, lang = S.lang) {
    const text = ics(ev, lang);
    if (!text) { S.toast(S.t("toast.calendarUnavailable", "Calendar details aren't available for this event yet.")); return false; }
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${ev.id}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (err) {
      console.error("[shdp] .ics download failed:", err);
      return false;
    }
  }

  S.calendar = { nextOccurrence, eligible, googleUrl, ics, downloadIcs, weekdayCode, weeklyDays, DAY_CODES };
})();
