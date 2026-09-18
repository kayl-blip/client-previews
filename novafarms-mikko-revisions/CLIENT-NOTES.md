# Client notes — Nova Farms revisions preview

Preview: https://sgencms.github.io/novafarms-revisions/
Private repo, public preview URL. All 47 pages are `noindex,nofollow` and
`robots.txt` disallows everything — this is not the live site.

---

## 1. One thing was deliberately built differently from the brief

**Asked for:** a "colourblind-friendly palette" toggle.
**Built:** a toggle called **Colour-independent mode**.

Nova Farms is brand green on brand navy. That pair stays distinguishable under
the common colour deficiencies — deuteranopia, protanopia, tritanopia — so a
hue-rotation filter would repaint every photograph, every brand logo and the
Stashie marketplace block for no real accessibility gain, and would make the
site look broken to the people it claims to help.

What actually causes trouble on this site is **meaning carried by colour alone**:
inline links that are only distinguishable by being green, and the Rec Only /
Rec & Med licence badges. So the toggle underlines every inline link and adds a
text label to the badges. That is WCAG 1.4.1, and it is the real barrier here.

The panel says this in plain language under the toggle, so nobody has to take it
on trust. If the client still wants a hue filter after reading that, it is a
small addition — but it should be a decision, not a default.

---

## 2. The single largest blocker: `/stores/` returns 403

Verified live, repeatedly, from two different methods (curl with a browser
user-agent, and a real Chrome navigation):

| URL | Status |
|---|---|
| `novafarms.com/shop/newbritain/` | **200** |
| `novafarms.com/stores/ma/attleboro` | 403 |
| `novafarms.com/stores/ma/framingham` | 403 |
| `novafarms.com/stores/ma/dracut` | 403 |
| `novafarms.com/stores/nj/woodbury` | 403 |
| `novafarms.com/stores/me/greenville` | 403 |
| `novafarms.com/shop/attleboro/` | 403 |

**This is not a handful of buttons.** In this bundle it was **546 destinations**:

- 235 Order Pickup buttons in the age gate's store list — the first thing a
  visitor touches
- 176 NJ / ME loyalty sign-ups in the nav
- 78 button CTAs in page content
- 42 inline links in prose
- 15 options in the store-finder dropdown

Every one now renders as "menu link pending" instead of an error page, and all
546 carry `data-nf-was="<the original URL>"`. **Confirming the correct URL is
one change plus one scripted pass** — nothing has to be hunted for.

(The pages show 610 "pending" markers in total. The other 64 are not rewritten
client links — they are new slots the location template introduces: 54 category
tiles, 9 per store, and 10 store CTAs. They have no original URL to preserve
because they never existed before. They need the same answer, not a lookup.)

What we need: the URL that should replace `novafarms.com/stores/<state>/<slug>`.
If it is geo- or IP-gated rather than broken, that is worth knowing too.

---

## 3. Content still needed, per store

| Store | Local copy | Hero photo | Extra photos |
|---|---|---|---|
| Attleboro | on the live site | 1080×1080 interior (usable) | 2 |
| New Britain | on the live site | 1920×1080 (good) | 2 |
| Dracut | on the live site | **none usable** — 800×305 only | 1 |
| Woodbury | on the live site | **none usable** — 800×305 only | 1 |
| **Framingham** | **none — stub page** | **none usable** | 2 |
| **Greenville** | **none — stub page** | **none usable** | 2 |

Framingham and Greenville are stubs on the client's own live site: an h1, a Care
Plans block, then the footer. Twenty headings against Attleboro's thirty-four.
They have nothing to rank with.

Hero photography: only New Britain has an image large enough to fill a hero
band. The hero is therefore built as a brand farm image with the store's own
photograph inset at its native size — nothing is upscaled, and real store
photography drops straight in when it arrives.

**Also needed:** deals content (none exists anywhere in the bundle), and product
category imagery (three flower shots is all there is).

---

## 4. Brand names

Nine house brands, all nine descriptions recovered from the existing homepage —
**no brand copy needs writing**. What is missing is the names and the outbound
links.

| Logo code | Name | Site |
|---|---|---|
| HLD | **Highlands** (inferred from `smokehighlands.com`) | smokehighlands.com |
| HP | **Homies** (inferred — its own blurb names it) | needed |
| RZ, SF, ZNK, STH, HSH, MLT, CBT | **needed** | needed |

The names appear to be readable in the logo artwork itself, so this is likely a
five-minute confirmation rather than research.

---

## 5. Reviews moved up

Measured at 390x844, collapsed, scroll depth to the "Stars of New England"
heading:

| | Depth | Screens |
|---|---|---|
| Before | 2,832 px | 3.36 |
| First pass (story collapsed only) | 2,033 px | 2.41 |
| **Now** | **1,705 px** | **2.02** |

A 40% reduction. Reaching it took four changes, each measured rather than
guessed:

| Change | Result |
|---|---|
| Brand statement panel collapsed into the same expander | 2.41 -> 2.16 |
| Story panel padding tightened (nothing sits above it now) | 2.16 -> 2.14 |
| Inner container's `min-height: 275px` zeroed while collapsed | 2.14 -> **2.02** |

That min-height was the real obstacle. Collapsed, the panel's contents are only
173px, so a 275px floor with centred alignment was adding 102px of empty space
that no padding change could reach. It is restored the instant the disclosure
opens.

**One control, not two.** "Find out more" now reveals both the brand statement
and the origin story. Nothing was cut: both stay in the page, findable by
find-in-page and indexable, and the button correctly announces that it governs
both regions.

Fixed along the way: the teaser was mostly whitespace. Its content carried 80px
top and bottom margins, so only about 28px of the 108px teaser was actual text
— the lead paragraph the brief asked for was barely showing. It now shows 108px
of real copy.

The OPT-IN TO POINTS & PERKS band is still deliberately untouched. If reviews
ever need to land on screen one, moving it below them is the remaining lever
and would put them at roughly 1.5 screens.

---

## 5b. The homepage hero was being clipped — fixed

The store rail was cutting the hero image in two: a disconnected sliver of the
photo above it, the rest resuming below.

Cause: `index.html` and `services.html` put their hero in a container with a
negative top margin (-106px and -112px) so it slides up under a transparent
header. That is the site's own design. Inserting an opaque rail between the
header and that hero meant the photo ran up behind the rail.

The rail now cancels that pull with an equal offset, so the hero starts exactly
at the rail's bottom edge and occupies its whole container. All 47 pages were
checked: **only these two use the pattern**; the other 45 are unaffected.

One knock-on was handled: with the photo no longer behind it, the header's
accessibility scrim was compositing against the white page and rendering slate
instead of brand navy — two mismatched dark bands stacked. On these two pages
the scrim is now opaque, so the ticker, nav and store rail read as a single
block of chrome above the image.

---

## 6. Smaller open questions

- **Rhode Island** ships as a "coming soon" slot in the store rail and nav. It
  needs an opening date, or at least a year — an open-ended "coming soon" reads
  worse than no slot at all. Note that RI already has a live wholesale presence
  at `ri.stashie.com`.
- **Spelling:** the brief says "Stashi"; the live domain is **stashie.com**.
- **Two pages per store, eventually.** The revisions build evolved the existing
  `/locations/<slug>/` pages rather than creating a second URL space. Harmless
  on a `noindex` preview; before anything ships live, someone should confirm
  there is one page per store targeting each local search.
- **The loyalty app is off-site.** `mynova.club/m/novafarms` is linked from 44 of
  47 pages and is a different domain. The new nav, footer and accessibility panel
  cannot reach it. The accessibility obligation follows the visitor there, and
  this build cannot satisfy it.
- **Booking is not reproducible.** `book-med-consult-ct.html` is missing its
  Amelia booking form because it is a live server-backed application, not markup.

---

## 7. What "accessible" currently means here, precisely

- **361 measured contrast failures → 0**, across all 47 pages and 5,333 measured
  text elements, with settings off and with high contrast on. Re-measured after
  the final build: 0 failures, 0 pages overflowing horizontally, 0 broken images.
- The two states a page sweep never reaches were measured **open**, because a
  closed panel reports a clean score while its own contents are unreadable —
  that mistake was made once on this build. Accessibility panel open: 27
  elements, 0 failures. Mobile drawer open: 13 elements, 0 failures.
- Both brand greens fail against white **in both directions**, so the rule
  adopted is: never pair green with white, pair green with navy. The brand green
  itself was never altered.
- **107 genuinely broken keyboard focus rings restored** (of 457 raw
  `outline:none` declarations — most were harmless).
- **Zero flashing risk** — 741 animation declarations examined, none faster than
  3Hz. Nothing needed fixing there.
- Reduced motion now reaches Slider Revolution, Swiper and the ticker, which the
  site's own 154 `prefers-reduced-motion` blocks covered none of.
- The accessibility button stays reachable **while the age gate is open**, so a
  visitor who needs bigger text can turn it on before being asked to read the
  gate.

This is WCAG 2.1 AA work, measured. Whether it satisfies a specific demand
letter is a question for the client's counsel, not for us.

---

## 8. The site QA run: 87 findings, 19 of them not real

A site QA scan was run against the preview on 2026-09-16 and reported 105 issues.
SEO and Security were excluded by the owner, leaving 87. Every one was
re-measured by hand before anything was changed, and the single most important
result is that **the scan measured the site through the closed age gate**.

The tool said so itself, in its own CON-003 finding: the age-gate popup covered
100% of the viewport and could not be auto-dismissed, so "findings + screenshots
for this page reflect the gated view". That one fact invalidates a large part of
the report.

**19 findings are not real.** Re-measured with the gate dismissed:

| Reported | n | What the measurement actually shows |
|---|---|---|
| Element wider than viewport | 12 | The page does not scroll horizontally at any width. `scrollWidth - clientWidth = 0` at 440, 768, 1024 and 1280. Every element it flagged is *inside* a carousel track or the store rail, both of which are deliberate horizontal scrollers. |
| Text below AA contrast | 3 | Sampled from the rendered pixels: the SHOP button is white on brand navy at **15.63:1**, and "BUILT FROM FRIENDSHIP" is **14.34:1**. The tool read them as 1.00:1 because it never composited the header's navy scrim. |
| `<img>` without a src | 1 | There are none. The thing it flagged is a line of *JavaScript text* inside the YouTube embed script, which its HTML parser read as markup. |
| Link has no href | 1 | Same cause, same script. There are no href-less links on the page. |
| Excessive DOM size | 1 | 1,425 elements with the gate closed, against its 1,500 threshold. The 1,598 it measured included the gate's own markup. |
| Redirect chain | 1 | `/index.html` → `/` is the preview server tidying a URL, not anything in the site. |

A seventh, **"faux bold — requested weight never loaded"**, was also tested and is
wrong: rendering the same heading at weight 800 and at weight 900 produces
**identical pixels — 0 of 504,000 bytes differ**, because the browser resolves the
800 request to the real Black Extended cut. Nothing is being synthesised, so
nothing was changed.

**Three findings were left alone on purpose.** Two are the `/stores/` 403s, which
are the owner's own call from 2026-09-09 ("replace all placeholder buttons/links
with actual links even if redirects to nowhere") — section 2 above. The third is
indeed.com, which returns 403 to automated checks but not to browsers.

### What was actually fixed

- **Duplicate ids.** Real, and the cause was worth finding: Elementor's sticky
  header clones the whole header into a hidden placeholder, ids and all. So
  `getElementById` could hand a script the *invisible* copy of the main menu
  instead of the live one. The clone's ids are now made unique at runtime.
- **Controls too small to hit.** Three were genuinely under this build's 24px
  floor and are fixed: the carousel arrows, the ticker headline, and the
  standalone "Leave a Review" link. The carousel dots remain at 18px wide — that
  is the documented residual from the earlier pass and still needs a design
  decision, not a stylesheet.
- **17 stylesheets became 1.** The fix-layer CSS is now served as a single file
  per page family. Proven not to change a single pixel on any of the six page
  families — literally zero subpixels differ against the previous build.
- **Images now defer properly.** The 11 images that appeared to be lazy-loading
  were all inside `<noscript>`, so none of them ever ran. 133 images across the
  site now defer natively, and the store pages preload their own hero image.

On the homepage that is: **17 stylesheets → 1, 92 requests → 77, duplicate ids
4 → 0, no horizontal overflow, no console errors.**

### One thing to change about how QA is run

Re-run the scan with the `ageVerified` and `popupShown` cookies pre-set. Without
them the crawler only ever sees the age gate, and a good share of the report
describes the gate rather than the site. The gate itself was not weakened to make
a scanner happy.
