# Image prompts for the SHDP landing page

Every image slot has a fixed aspect ratio and a CSS focal point, so nothing gets stretched or awkwardly cropped.
Generate at the size given (or larger at the **same ratio**), save under `assets/img/` with the exact filename, and it drops straight in.

**Shared style line** (paste at the end of every prompt so the set matches):
> warm golden-hour light, soft saffron and deep forest-green palette, painterly Indian devotional illustration style, rich detail, gentle atmosphere, no text, no watermark, no logos

---

## 1. Programme images (replace the current low-res 520px crops)
Slot: `.prog-stage .media`, **4:3**, generate **1600 × 1200**. Keep the subject in the centre third.

| File | Prompt |
|---|---|
| `prog-pravachanalu.jpg` | An elderly Telugu spiritual teacher in a cream kurta and yellow angavastram giving a discourse on a carved stone temple mandapam stage, seated listeners of all ages on mats facing him, oil lamps, brass kalasham, scriptures on a low wooden stand |
| `prog-bala.jpg` | Children aged 8 to 16 sitting in a semicircle in a temple courtyard, one child raising a hand to ask a question, a kind teacher answering with a smile, notebooks and a small Bhagavad Gita, banyan tree shade |
| `prog-bhajan.jpg` | Indian homemakers and seekers in a bright home study attending an online scripture class on a laptop, tanpura and a lit brass diya beside them, morning light through a window, bookshelf with palm-leaf manuscripts |
| `prog-gita.jpg` *(new file; update `main.js` entry 4)* | Children in white uniforms each holding a copy of the Bhagavad Gita, reciting together in a small temple hall with a Krishna-Arjuna chariot mural behind them |
| `prog-yoga.jpg` | Dawn Surya Namaskar session on a large open ground, rows of people of all ages on colourful mats, sun rising behind temple gopurams, mist |
| `prog-goshala.jpg` | Volunteers feeding fresh vegetables to healthy white and brown Indian cows in a clean, well-kept goshala, early-morning light, a calf in front |

## 2. Video thumbnails (temporary, until real YouTube links are added)
Slot: `.video .thumb`, **16:9**, generate **1280 × 720**.
Real thumbnails will load automatically once you give me the YouTube video IDs, so this is optional.

| File | Prompt |
|---|---|
| `thumb-deepam.jpg` | Close-up of a single brass diya flame glowing in darkness, soft bokeh of more lamps behind |
| `thumb-qa.jpg` | Young students in a circle listening intently in a temple courtyard, one standing to ask a question |
| `thumb-sundarakanda.jpg` | Hanuman flying over the ocean towards Lanka at sunset, majestic, devotional painting style |

## 3. Ashram vision banner (optional higher-res)
Slot: `.vision .bg`, full-bleed, **16:9**, generate **2400 × 1350**. Keep the bottom 35% calm (text sits there over a dark fade).
- `ashram-vision.jpg`: *A peaceful Indian ashram campus at sunrise: a giant banyan tree with an Om shrine at its base, a teacher giving a discourse under it, yoga on the lawn, a goshala with cows on one side, a children's play area, a carved stone pavilion with a bhajan group, temple shikharas in the misty background.*

## 4. Do NOT AI-generate (use real photos)
- **Jagadguru Shankaracharya Sri Sri Swayamprakasha Sachidananda Saraswathi Mahaswamiji**: an official photo from the Hariharapura Peetam. Slot is **4:5 portrait** (arched), face in the upper third. Save as `jagadguru.jpg`.
- **Real event photos** (Teertha Yatras, Yoga Day, Goshala drives) will be far stronger than AI images for the gallery and past-events pages. Collect originals from volunteers' phones.

## 5. Already in use (from your uploads)
- `guruji-hero.webp`: hero arch (4:5 crop, focal point 50% 22%)
- `guruji-seated.webp`: mentor section (4:3)
- `guruji-portrait.webp`: lead video thumbnail (16:9)
- `sunrise-himalaya.webp`: shloka band background + Teertha Yatra card
- `logo.jpg`: header/footer. A **transparent PNG** of the logo (around 512px) would look cleaner on the dark header.
