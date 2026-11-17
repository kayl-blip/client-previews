# Green Haven Industries — preview

Preview: https://kayl-blip.github.io/client-previews/greenhaven-preview/
Copied from `nicoledreo/client-previews` (`greenhaven-preview/`, commit `b1ccd83`) on 2026-11-17.

## Instructions

Homepage mockup, global elements, and images. Most pages are templated, not designed one by one.

Menu embed (The Strain App): copied from the live greenhaven-nj.com/menu page. Business ID 424, location ID 331395.

```html
<script
  id="the-strain-app-embed-script"
  src="https://dashboard.thestrainapp.com/assets/js/embed.js"
  data-business-id="424"
  data-container-selector="#strain-embed"
  data-fixed-top-container-selector=".top-app-bar"
  data-gtm-id=""
  data-params="sort=featured"
  data-location-id="331395"
></script>
<div id="strain-embed"></div>
```

## How this preview uses the embed

`menu/index.html` loads the same embed (business ID 424, location ID 331395, `sort=featured`) with these differences:

| | Live greenhaven-nj.com/menu | Preview `menu/index.html` |
|---|---|---|
| `data-fixed-top-container-selector` | `.top-app-bar` | `.site-header` (the preview's header; it has no `.top-app-bar` element) |
| `defer` on the script | no | yes |
| Order | script, then `#strain-embed` div | `#strain-embed` div, then script |

Checked against the live page on 2026-11-17.
