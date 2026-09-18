# novafarms — internal preview (revisions build)

Static preview of a Nova Farms site rebuild. **Not the live site.** The live site is the
client's own; this repo exists for internal review only.

- **Preview URL:** https://sgencms.github.io/novafarms-revisions/
- **Pages:** all **46** in-scope pages.
- **Blog is out of scope** and was never fetched — 42 posts, 12 `/blog/reviews/`,
  6 `/blog/locations-cpt/`, plus the `/blog/` landing page (61 URLs).

## Page inventory

| Group | Count |
|---|---|
| Home | 1 |
| Locations hub + store pages | 7 |
| `/visit-us/` hub + local landing pages | 19 |
| Pharmacy | 4 |
| Medical (CT) | 4 |
| Loyalty / VIP | 3 |
| Shop | 2 |
| Standalone (wholesale, review, budtender, customer-education, privacy-policy, invest) | 6 |

## Why this preview is neutered

A pixel-accurate copy of a live business site is an impersonation and SEO hazard if
published as-is. None of the following render, so the verified pixel output is unchanged:

| Change | Count | Reason |
|---|---|---|
| JSON-LD removed | 72 | carried real business name, address, phone, review ratings as machine-readable data |
| `og:image*` removed | 184 | social unfurlers ignore robots meta and would render the real brand's card |
| `twitter:*` removed | 274 | same |
| `robots` → `noindex,nofollow` | 46 pages | keep it out of search results |
| `canonical` → preview URL | 46 pages | canonicalising to the live domain would tell Google the client's own site is the duplicate |
| `og:url` → preview URL | 46 pages | same |

`robots.txt` disallows all crawling. `.nojekyll` is required: GitHub Pages would otherwise
strip `_xorigin/` (Jekyll excludes paths beginning with `_`).

## Known imperfections

- **Third-party embeds need the network** and cannot be localised: Google Maps, Terpli,
  Canva (attleboro/dracut/woodbury), Dutchie menu + Surfside SDK (shop/newbritain).
- **`invest-successful-submission.html`** references two Slider Revolution layer images by a
  mirrored path while images are routed to `assets/in-pages/`. Both files ARE in the bundle
  and no `<img>` renders broken; the redundant reference 404s silently.
- Amelia's `public.js` is an ES module. Under bare `file://` browsing it fails CORS
  (`ERR_FAILED`); over HTTP — including this preview — it loads normally.

## Verification

Full 46-page pixel diff against the live site at 6 viewports: **43 of 46 pages pass** the
0.95 gate, 12 of them at exactly 100.000%. Stage 5 audit: **12/12 gates, 0 hard issues,
0 soft issues**. Offline check with every non-`file://` request blocked, all 46 pages:
root font-size 16px, **0 broken images, 0 horizontal overflow, 0 uncaught page errors**.

### The 3 pages that did not pass

| Page | Result | Cause |
|---|---|---|
| `framingham-ma.html` | 85.7% → **96.8% on re-measure** | Google Maps tiles had not finished loading in the first capture. Passes on re-capture; 5 of 6 viewports were already 99.0–100.000%. |
| `greenville-me.html` | 5 of 6 viewports 99.4–100.000%; 1024px unstable | Same Maps embed. That one viewport has scored 83.1%, 84.5%, 91.9% and 99.4% across runs — the variance is the third-party map, not the page. |
| `book-med-consult-ct.html` | 54–77% at every viewport | **A real gap.** The live page renders the Amelia booking form; the clone renders header and footer only. Amelia is a Vue app that loads its data from a live WordPress AJAX endpoint, so it cannot be reproduced statically. Serving over HTTP instead of `file://` changes nothing — verified. |

The booking page is the only page in the set with genuinely missing content. It is a
server-backed application, not markup, and is outside what a static clone can carry.
