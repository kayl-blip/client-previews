# raichattorneys.com

Cloned from source on 2026-08-31T20:22:09.250Z.
Static, no build step.

## Pages

| File | Source |
| --- | --- |
| `index.html` | `https://raichattorneys.com/` |
| `about-us.html` | `https://raichattorneys.com/about-us/` |
| `about-our-founder.html` | `https://raichattorneys.com/about-us/about-our-founder/` |
| `case-result.html` | `https://raichattorneys.com/case-result/` |
| `contact-us.html` | `https://raichattorneys.com/contact-us/` |
| `las-vegas.html` | `https://raichattorneys.com/location/las-vegas/` |
| `media-and-awards.html` | `https://raichattorneys.com/media-and-awards/` |
| `mergers-acquisitions.html` | `https://raichattorneys.com/mergers-acquisitions/` |
| `nevada-llc-and-business-formation.html` | `https://raichattorneys.com/nevada-llc-and-business-formation/` |
| `partnership-disputes.html` | `https://raichattorneys.com/partnership-disputes/` |
| `service.html` | `https://raichattorneys.com/service/` |
| `asset-purchase-or-sale.html` | `https://raichattorneys.com/services/asset-purchase-or-sale/` |
| `business-sale-attorney.html` | `https://raichattorneys.com/services/business-sale-attorney/` |
| `commercial-law.html` | `https://raichattorneys.com/services/commercial-law/` |
| `contract-attorney.html` | `https://raichattorneys.com/services/contract-attorney/` |
| `general-counseling.html` | `https://raichattorneys.com/services/general-counseling/` |
| `litigation.html` | `https://raichattorneys.com/services/litigation/` |
| `negotiations.html` | `https://raichattorneys.com/services/negotiations/` |
| `terms-and-conditions.html` | `https://raichattorneys.com/terms-and-conditions/` |
| `video-library.html` | `https://raichattorneys.com/video-library/` |
| `wills-trusts-estate-planning.html` | `https://raichattorneys.com/wills-trusts-estate-planning/` |

## Files

```
raichattorneys.com/
├── README.md
├── audit.json
├── chrome.css                 (shared chrome stylesheet)
├── index.html
├── about-us.html
├── about-our-founder.html
├── case-result.html
├── contact-us.html
├── las-vegas.html
├── media-and-awards.html
├── mergers-acquisitions.html
├── nevada-llc-and-business-formation.html
├── partnership-disputes.html
├── service.html
├── asset-purchase-or-sale.html
├── business-sale-attorney.html
├── commercial-law.html
├── contract-attorney.html
├── general-counseling.html
├── litigation.html
├── negotiations.html
├── terms-and-conditions.html
├── video-library.html
├── wills-trusts-estate-planning.html
└── <mirrored-source-asset-tree>/
```

## Tech notes for development

- Pure static, no build step, no dependencies.
- Shared chrome CSS in `chrome.css` (linked from each page).
- Page-specific styles in inline `<style>` block in each HTML.
- Internal nav hrefs rewritten to point at sibling pages.
- Asset paths mirror source URL structure verbatim (per scope §K.1).
- Tracking scripts (GA, GTM, FB pixel, Hotjar, etc.) stripped at emit.

## License / ownership

This is a clone of source content. Verify rights before publishing.
