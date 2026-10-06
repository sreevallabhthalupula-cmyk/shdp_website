# Sri Haritha Dharma Parishad: website

Static, bilingual (English / Telugu) website for Sri Haritha Dharma Parishad (SHDP), Hyderabad.
No build step and no backend: plain HTML, CSS and JavaScript, with Three.js and GSAP from cdnjs.
Deployed on Netlify from the `main` branch: https://effortless-otter-f49e77.netlify.app/

## Run locally
```
powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 5173
```
Then open http://localhost:5173 (the JSON content does not load from `file://`).

## Editing content (no code needed)
All repeatable content lives in `data/*.json`. Edit the file on GitHub, commit to `main`, and Netlify redeploys.
Use `null` for anything not known yet: the related button or line is hidden automatically. Never guess.

| File | What it holds |
|---|---|
| `data/site.json` | Contact, social links, WhatsApp groups, volunteer / donation links, website URL |
| `data/quotes.json` | Shloka of the day (`date` = show on that day; undated = rotation) |
| `data/events.json` | Events: one-time (`date`) or recurring (`recurrence.weekly`). Calendar buttons appear only when date/day, `start_time` and `end_time` are all known |
| `data/programmes.json` | The programme switcher |
| `data/timeline.json` | Our Journey timeline; `category: "yatra"` items also fill the Teertha Yatra card |
| `data/videos.json` | Pravachanalu: add real YouTube videos (`youtube_id` = the 11 characters after `v=`) |
| `data/books.json` | Books with optional `buy_url` / `pdf_url` |
| `data/gallery.json` | Photo albums (real event photos only) |

Text fields are bilingual: `{ "en": "...", "te": "..." }`. If `te` is `null`, English is shown.
Preview a scheduled quote with `?quoteDate=YYYY-MM-DD` on the URL.

## Structure
- `index.html`: page shell, SEO text, structured data
- `css/styles.css`: design tokens (forest green + temple gold), layout, components, motion
- `js/data.js`: the only place content is loaded (swap this for Supabase later)
- `js/core.js`: shared helpers (language, safe URLs, dialogs, dates, site config)
- `js/share.js`, `js/calendar.js`: Web Share / WhatsApp / copy, Google Calendar + .ics
- `js/events.js`, `js/programmes.js`, `js/timeline.js`, `js/media.js` (videos, gallery, lightbox), `js/books.js`, `js/search.js`
- `js/main.js`: header, drawer, quote of the day + status card, language switch, Three.js hero, GSAP motion
- `js/i18n.js`: Telugu interface strings
- `manifest.webmanifest`, `sw.js`: installable app + offline shell (network-first for pages and data)
- `robots.txt`, `sitemap.xml`

## Still to fill in (real information only)
- Phone number, address, Google Maps link (`site.json` → `contact`)
- Official Facebook page URL (`social.facebook.url`)
- WhatsApp community / group invite links (`whatsapp`)
- Volunteer Google Form, donation details page (`join`)
- YouTube channel ID for the automatic "latest uploads" player (`social.youtube.channel_id`, starts with `UC`)
- Real videos, books and photo albums
- Event end times (needed for calendar buttons), venues and registration links
- Telugu translations for timeline / yatra descriptions (currently English)
- Custom domain: when connected, update `canonical`, `og:*`, JSON-LD in `index.html`, `robots.txt`, `sitemap.xml` and `links.website_url`

## Later: Supabase
The UI only talks to `window.SHDP_DATA` (`js/data.js`). To move to Supabase, re-implement those functions
(`getEvents`, `getProgrammes`, `getQuotes`, ...) to query tables with the same field names and keep returning
the same shapes. Things that need a backend then: volunteer / registration submissions, an admin editor,
photo uploads, automatic YouTube sync and WhatsApp messaging.
