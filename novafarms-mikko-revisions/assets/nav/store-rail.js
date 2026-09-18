/* =============================================================================
   store-rail.js — renders the store indicator/switcher under the header.

   Revision 2: "a visible 'you're viewing [Store]' indicator with an easy way to
   switch". One component does both, following the 4Twenty Market reference the
   client pointed at.

   Reads everything from store-context.js. Choosing here sets the store, so the
   rail is a second entry point into the same journey the gate starts.
   ============================================================================= */
(function () {
  'use strict';

  var S = window.NovaStores;
  if (!S) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build() {
    // ofThisPage(), not viewing() and not current().
    //
    // OWNER CALL 2026-09-10, with a screenshot of the rail on the HOMEPAGE:
    // "there should not be any highlight here when user is in home. it may
    // highlight in home only when hovered on."
    //
    // viewing() is `ofThisPage() || selected()`, so on a page that is not a
    // store page it fell through to the store saved in localStorage and painted
    // that one green-and-underlined under a "VIEWING" label — on the homepage,
    // where you are viewing no store at all. The indicator was stating a
    // preference as if it were a location.
    //
    // ofThisPage() answers only "is this page a store page", so the mark now
    // appears exactly where it is true and nowhere else. The mobile drawer has
    // always used ofThisPage() for its own store list (mobile-nav.js,
    // locationsBody) — the rail was the outlier, and this aligns them.
    //
    // Consequence, deliberate: the saved store is no longer surfaced by the
    // rail on non-store pages. It is still carried by the drawer's "Shopping
    // at" block, by the deals slots and by data-store on <html>, none of which
    // change here.
    var current = S.ofThisPage();

    var rail = el('nav', 'nf-rail');
    rail.id = 'nf-rail';
    rail.setAttribute('aria-label', 'Choose a store');

    var inner = el('div', 'nf-rail__inner');

    // The indicator half, phrased for assistive tech as well as sighted users.
    var label = el('span', 'nf-rail__label', current ? 'Viewing' : 'Our stores');
    inner.appendChild(label);
    if (current) {
      inner.appendChild(el('span', 'nf-rail__sr',
        'You are viewing ' + current.name + ', ' + current.state + '.'));
    }

    S.all().forEach(function (s) {
      if (s.comingSoon) {
        inner.appendChild(el('span', 'nf-rail__soon', s.name + ' — coming soon'));
        return;
      }
      var a = el('a', 'nf-rail__item');
      a.href = s.page;
      a.appendChild(document.createTextNode(s.name));
      a.appendChild(el('span', 'nf-rail__state', s.state));
      if (current && current.id === s.id) {
        a.setAttribute('aria-current', 'true');
        // "true" is not a valid aria-current token on its own for a location;
        // spell the relationship out for screen readers.
        a.setAttribute('aria-label', s.name + ', ' + s.state + ' — currently viewing');
      }
      a.addEventListener('click', function () { S.select(s.id); });
      inner.appendChild(a);
    });

    rail.appendChild(inner);
    return rail;
  }

  function mount() {
    if (document.getElementById('nf-rail')) return;

    // Directly under the header, which is where the reference puts it and where
    // it reads as part of the chrome rather than as page content.
    var header = document.querySelector('[data-elementor-type="header"]') ||
                 document.querySelector('.elementor-location-header') ||
                 document.querySelector('header');
    if (!header || !header.parentNode) return;

    var rail = build();
    if (rail) {
      header.parentNode.insertBefore(rail, header.nextSibling);
      // Releases the 48px reservation in store-rail.css. Set only once the
      // rail is actually in the DOM, so the swap is same-frame and cannot
      // leave the page with neither the margin nor the rail.
      document.body.setAttribute('data-nf-rail-ready', '1');
    }
    reflowHero(rail);
    revealCurrent(rail);
    stickTop(rail);
  }

  /* ---------------------------------------------------------------------------
     OWNER 2026-09-10: "Let's Make this bar sticky, sticks along with the nav."

     The header IS already sticky and I nearly concluded it was not. Measuring
     `[data-elementor-type="header"]` shows `position: static` and a top of -900
     at scrollY 900, which reads as "the header scrolls away". That wrapper is
     not the sticky element. Elementor Pro sticks the inner CONTAINER and clones
     it, so the page holds two copies -- one `position: fixed` and one
     `relative` -- and only the fixed clone matters:

       page              width   fixed header      bottom edge
       attleboro-ma      1440    7600e13, z 9999   104
       attleboro-ma       375    7600e13, z 1000    89
       index             1440    4a3d33e, z 9999   138
       index              375    4a3d33e, z 1000   122

     index sits 36px lower because a ticker occupies that strip and the header
     pins beneath it rather than at 0.

     So the offset the rail needs is not a constant and not the header's HEIGHT
     -- it is the fixed header's BOTTOM EDGE in viewport coordinates, which is
     exactly what `position: sticky`'s `top` wants. Measured live rather than
     hard-coded, because it differs by page, by width, and by whether a ticker is
     above it.

     Only chrome pinned near the top counts: the accessibility trigger is also
     `position: fixed` (z-index 100001) but sits at the bottom of the viewport,
     and a floating control must not push the rail down the page.
     ------------------------------------------------------------------------ */
  /* Collect the chrome pinned to the top of the viewport, in visual order. */
  function topChrome() {
    var out = [];
    var cands = document.querySelectorAll('[data-settings*="sticky"], .elementor-sticky--active');
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (window.getComputedStyle(el).position !== 'fixed') continue;
      var r = el.getBoundingClientRect();
      if (r.height < 10) continue;
      if (r.width < 200) continue;            // not a full bar
      if (r.top > 200) continue;              // bottom-anchored chrome, not a header
      out.push({ el: el, top: r.top, bottom: r.bottom });
    }
    out.sort(function (a, b) { return a.top - b.top; });
    return out;
  }

  /* ---------------------------------------------------------------------------
     CLOSE THE GAP BETWEEN THE PINNED BARS.

     OWNER 2026-09-10: "close the 8px gap" -- page content was showing through
     between the header and the store CTA bar while scrolling.

     It is not an 8px gap. The CTA bar's `top` is hard-coded inline by
     Elementor's sticky settings -- 103px on desktop, 85px on mobile -- while the
     header's HEIGHT changes with viewport width. The two only meet at one
     particular header height:

       width   header bottom   bar top   result
       1440        104.2         103     -1.2  (bar tucked under the header)
       1200         94.9         103     +8.1  (the reported gap)
        375         89           85      -4.0  (overlap)

     So the fix is to stop the bar guessing. Each pinned bar after the first is
     re-pinned to the bottom edge of the one above it, measured live.

     ONLY GAPS ARE CLOSED, NOT OVERLAPS. A bar tucked 1.2px under the header
     shows nothing through and moving it risks a visible 1px shift for no gain,
     so anything already flush or overlapping is left exactly as it is. On
     index.html the floating ticker sits 0.5px above the header, which is inside
     the threshold and untouched.

     setProperty(..., 'important') because Elementor writes `top` as an inline
     style; an important inline declaration is the only thing that outranks a
     plain one on the same element.
     ------------------------------------------------------------------------ */
  function closeChromeGaps(bars) {
    for (var i = 1; i < bars.length; i++) {
      var gap = bars[i].top - bars[i - 1].bottom;
      if (gap <= 0.5) continue;                       // flush or overlapping already
      var want = Math.round(bars[i - 1].bottom);
      bars[i].el.style.setProperty('top', want + 'px', 'important');
      var r = bars[i].el.getBoundingClientRect();     // re-read after the move
      bars[i].top = r.top;
      bars[i].bottom = r.bottom;
    }
    return bars;
  }

  function stickTop(rail) {
    if (!rail) return;
    var bars = closeChromeGaps(topChrome());
    var best = 0;
    for (var i = 0; i < bars.length; i++) {
      if (bars[i].bottom > best) best = bars[i].bottom;
    }
    rail.style.setProperty('--nf-rail-top', Math.round(best) + 'px');
  }

  /* The header's pinned height can change -- the ticker above it on index can be
     dismissed, and the header itself resizes across breakpoints -- so the offset
     is re-read on scroll and resize, throttled to one measurement per frame. */
  var ticking = false;
  function scheduleStick() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      stickTop(document.getElementById('nf-rail'));
    });
  }
  window.addEventListener('scroll', scheduleStick, { passive: true });
  window.addEventListener('resize', scheduleStick);

  /* ---------------------------------------------------------------------------
     The rail scrolls horizontally -- 1050px of stores in a 375px viewport -- and
     it mounts scrolled to the left. For the first two stores that is fine. For
     the last two it means the "VIEWING" marker points at something the visitor
     cannot see. Measured at 375:

       page                current store   x range        visible?
       attleboro-ma        Attleboro       12..147        fully
       framingham-ma       Framingham      148..297       fully
       woodbury-nj         Woodbury        551..682       NOT AT ALL
       greenville-me       Greenville      683..821       NOT AT ALL

     At 768 Greenville is still clipped (visible but not fully). So on the two
     store pages furthest down the list, a phone visitor saw a rail labelled
     "VIEWING" with nothing marked in view -- which is the same defect the
     homepage had, arriving from the other direction.

     Scrolls the RAIL's own container, never the page: setting scrollLeft
     directly rather than scrollIntoView, which walks up and scrolls ancestors
     too and would jump the document on load. No-ops when the rail does not
     scroll or the current item is already fully visible, so the four unaffected
     pages are untouched.
     ------------------------------------------------------------------------ */
  function revealCurrent(rail) {
    if (!rail) return;
    var inner = rail.querySelector('.nf-rail__inner');
    if (!inner) return;
    var cur = inner.querySelector('.nf-rail__item[aria-current="true"]');
    if (!cur) return;
    if (inner.scrollWidth <= inner.clientWidth + 1) return;

    var ir = inner.getBoundingClientRect();
    var cr = cur.getBoundingClientRect();
    if (cr.left >= ir.left - 1 && cr.right <= ir.right + 1) return;   // already there

    // Centre it where there is room; the clamp handles the ends, so the first
    // and last stores sit flush rather than leaving a gap.
    var target = inner.scrollLeft + (cr.left - ir.left) - (inner.clientWidth - cr.width) / 2;
    inner.scrollLeft = Math.max(0, Math.min(target, inner.scrollWidth - inner.clientWidth));
  }

  /* ---------------------------------------------------------------------------
     Two pages -- index.html and services.html -- put their hero in a container
     with a NEGATIVE top margin (-106px and -112px), so it slides up underneath
     a transparent header. That is the site's own design, and inserting the rail
     between the header and that hero broke it: the rail is opaque, the hero ran
     up behind it, and the result was a disconnected sliver of the photo above
     the rail with the rest of the image resuming below. It read as a clipped
     hero. (Measured across all 47 pages -- only these two do this; the other 45
     have margin-top: 0 and are untouched by any of this.)

     The fix cancels that negative pull with an equal margin-bottom on the rail,
     so the hero starts exactly at the rail's bottom edge and occupies its whole
     container. The value is read from the live computed style rather than
     hard-coded, so the two different offsets both resolve correctly.

     Consequence handled below: with the hero no longer behind it, the header's
     translucent scrim would composite against the white page instead of the
     photo and render slate rather than brand navy -- two mismatched dark bands
     stacked. The nf-chrome-solid flag makes that scrim opaque; see
     store-rail.css.
     ------------------------------------------------------------------------ */
  function reflowHero(rail) {
    if (!rail) return;
    var main = document.querySelector('.site-main');
    if (!main) return;

    var first = null;
    var cands = main.querySelectorAll('.e-con.e-parent, .elementor-top-section');
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].getBoundingClientRect().height > 100) { first = cands[i]; break; }
    }
    if (!first) return;

    var mt = parseFloat(window.getComputedStyle(first).marginTop);
    if (!(mt < -1)) return;                       // the other 45 pages stop here

    rail.style.marginBottom = Math.abs(mt) + 'px';
    document.documentElement.classList.add('nf-chrome-solid');
  }

  function refresh() {
    var old = document.getElementById('nf-rail');
    if (!old) return mount();
    var next = build();
    if (next) { old.parentNode.replaceChild(next, old); revealCurrent(next); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  window.addEventListener('load', mount);
  window.addEventListener('novafarms:storechange', refresh);

  window.NovaRail = { mount: mount, refresh: refresh };
})();
