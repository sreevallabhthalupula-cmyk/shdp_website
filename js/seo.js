/* SHDP structured data for search engines, built from the same data the page shows.
   - VideoObject for each published video in data/videos.json (real IDs, titles and dates only).
   Events are not marked up yet: schema.org Event needs a real start date, and the current
   events are weekly / ongoing without dates. Nothing here is invented. */
(() => {
  const S = window.SHDP;
  if (!S || !window.SHDP_DATA) return;
  const YT_ID = /^[\w-]{11}$/;
  const ORG = "https://effortless-otter-f49e77.netlify.app/#org";

  function add(data) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.dataset.generated = "seo";
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  SHDP_DATA.getVideos().then(videos => S.safe("seo videos", () => {
    const list = (videos || []).filter(v => v && YT_ID.test(v.youtube_id || "") && S.isISODate(v.published_date) && (v.title && (typeof v.title === "string" || v.title.en)));
    if (!list.length) return;
    add({
      "@context": "https://schema.org",
      "@graph": list.map(v => {
        const name = typeof v.title === "string" ? v.title : v.title.en;
        const desc = v.description && (typeof v.description === "string" ? v.description : v.description.en);
        return {
          "@type": "VideoObject",
          "name": name,
          "description": desc || `${name}. Pravachanam from Sri Haritha Dharma Parishad.`,
          "thumbnailUrl": `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`,
          "uploadDate": v.published_date,
          "embedUrl": `https://www.youtube-nocookie.com/embed/${v.youtube_id}`,
          "contentUrl": `https://www.youtube.com/watch?v=${v.youtube_id}`,
          "publisher": { "@id": ORG }
        };
      })
    });
  }));
})();
