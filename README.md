# Sri Haritha Dharma Parishad: website

Static website for Sri Haritha Dharma Parishad (SHDP), Hyderabad. It needs no build step: plain HTML, CSS and JS, with Three.js and GSAP loaded from cdnjs.

## Run locally
```
powershell -ExecutionPolicy Bypass -File serve.ps1
```
Then open http://localhost:5173

## Structure
- `index.html`: landing page
- `css/styles.css`: design tokens (forest green + temple gold from the logo), layout, motion
- `js/main.js`: header, programmes switcher, timeline, shloka share card, Three.js hero, scroll motion
- `js/i18n.js`: Telugu strings (English text lives in the HTML)
- `assets/img/`: images (see `IMAGE-PROMPTS.md` for replacements and sizes)

## Still to fill in
- Phone number and trust address (footer)
- WhatsApp group invite links (`data-wa-group` links and the floating button)
- YouTube video IDs for the video section
- Official Facebook page URL (header and footer currently use a search URL placeholder)

## Before launch
- Production domain: social previews need absolute URLs. In `index.html`, set `og:image` to
  `https://YOUR-DOMAIN/assets/img/guruji-hero.webp` and add
  `<meta property="og:url" content="https://YOUR-DOMAIN/">` and `<link rel="canonical" href="https://YOUR-DOMAIN/">`.
