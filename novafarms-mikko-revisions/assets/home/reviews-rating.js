/* =============================================================================
   reviews-rating.js — "The Stars of New England", direction A (Rating first).

   OWNER PICK, replacing direction B. Both were shown at
   claude.ai/code/artifact/34815f1c-2848-404c-836d-286b9bb11457.

   A leads with the aggregate rather than the first quote: a score lockup on the
   left, the review carousel beside it. The cards come BACK — B had dissolved
   them, A does not — so reviews-quiet.css/.js are retired by this file.

   ⚠ THE NUMBER IS NOT CONFIRMED. The bundle has ten reviews, every one five
   stars, every one sourced "Google". There is no store rating and no review
   total anywhere in it. So:
     - the total is rendered as a visible pending chip, never invented;
     - the 5.0 is the average of the ten reviews that are actually on the page,
       which is a true statement about this data but is NOT the store's verified
       Google rating.
   The client has to confirm both, per store, from their Google Business
   Profile before this reaches a live domain. Recorded in the V1 log, because
   the owner asked for on-page reminders to be removed.

   WHY THIS IS JS AND NOT MARKUP
   The lockup is new content that does not exist in the clone, and it has to
   appear on six pages whose Elementor element ids DIFFER per page. So nothing
   here hardcodes an id: the carousel widget is found by walking up from the
   swiper to the child of the section that contains it. Injecting also keeps it
   reversible — drop the two <link>/<script> lines and the pages are untouched.

   WHY THE SWIPER IS NOT MOVED
   Re-parenting a live Swiper breaks its cached geometry. Instead the widget
   that already wraps it becomes the flex row, and the lockup is inserted as
   that row's first child. The swiper element itself never moves; it only gets
   narrower, and swiper.update() is called so it recomputes slides per view.
   ============================================================================= */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /* The real star asset, via the theme's own classes. `.custom-star-icon` is
     what carries the WHITE-NOVA-STAR.webp background rule, so wrapping in it
     gets the genuine star rather than a text glyph. */
  function starRow(label) {
    var wrap = el('div', 'custom-star-icon nf-score__stars');
    var row = el('div', 'elementor-star-rating');
    for (var i = 0; i < 5; i++) {
      var s = el('i', 'elementor-star-full', '★');
      s.setAttribute('aria-hidden', 'true');
      row.appendChild(s);
    }
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', label);
    wrap.appendChild(row);
    return wrap;
  }

  function storeName() {
    try {
      var s = window.NovaStores && window.NovaStores.viewing && window.NovaStores.viewing();
      if (s && s.name) return 'Nova Farms ' + s.name;
    } catch (e) { /* store context absent or private mode */ }
    return 'Nova Farms';          // the homepage, which is not a single store
  }

  function buildScore() {
    var box = el('div', 'nf-score');

    var num = el('p', 'nf-score__num', '5.0');
    // Marked in the DOM as well as in the log, so anyone inspecting the page
    // can see the figure is provisional without a visible reminder on screen.
    num.setAttribute('data-nf-provisional', 'rating');
    box.appendChild(num);

    box.appendChild(starRow('Rated 5 out of 5'));

    var meta = el('p', 'nf-score__meta');
    meta.appendChild(document.createTextNode('Across '));
    var chip = el('span', 'nf-score__pending', 'total pending');
    meta.appendChild(chip);
    meta.appendChild(document.createTextNode(' Google reviews for ' + storeName() + '.'));
    box.appendChild(meta);

    return box;
  }

  /* What is this lockup actually sitting on?

     The band is navy on four of the six pages. On framingham-ma and
     greenville-me it is NOT — those stubs never got the section background, and
     the composited ground measures pure white. White-on-navy type became
     white-on-white there: the "5.0" measured 1:1 and was invisible, caught by
     the 47-page contrast sweep rather than by looking at it.

     So ask instead of assuming. Composite the real backdrop the way the sweep
     does — walk up accumulating background colours until one is opaque — and
     mark the lockup when it lands on something light. reviews-rating.css
     supplies the dark-on-light palette. */
  /* Shared by the band paint and the text-colour check: composite the real
     backdrop the way the contrast sweep does, and say whether it is light. */
  function isLightGround(el) {
    function parse(c) {
      var m = /rgba?\(([^)]+)\)/.exec(c || '');
      if (!m) return null;
      var p = m[1].split(',').map(parseFloat);
      var a = p.length > 3 ? p[3] : 1;
      if (a === 0) return null;
      return [p[0], p[1], p[2], a];
    }
    var layers = [], n = el;
    while (n && n !== document.documentElement) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return false;  // unknowable
      var c = parse(cs.backgroundColor);
      if (c) { layers.push(c); if (c[3] >= 0.999) break; }
      n = n.parentElement;
    }
    var base = [255, 255, 255];
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i], a = l[3];
      base = [a * l[0] + (1 - a) * base[0],
              a * l[1] + (1 - a) * base[1],
              a * l[2] + (1 - a) * base[2]];
    }
    function ch(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return (0.2126 * ch(base[0]) + 0.7152 * ch(base[1]) + 0.0722 * ch(base[2])) > 0.18;
  }

  function groundCheck(score) {
    function parse(c) {
      var m = /rgba?\(([^)]+)\)/.exec(c || '');
      if (!m) return null;
      var p = m[1].split(',').map(parseFloat);
      var a = p.length > 3 ? p[3] : 1;
      if (a === 0) return null;
      return [p[0], p[1], p[2], a];
    }
    var layers = [], n = score;
    while (n && n !== document.documentElement) {
      var cs = getComputedStyle(n);
      // A background IMAGE is unknowable from here, so leave the lockup in its
      // default white-on-dark rather than guess at a photograph's luminance.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return;
      var c = parse(cs.backgroundColor);
      if (c) { layers.push(c); if (c[3] >= 0.999) break; }
      n = n.parentElement;
    }
    var base = [255, 255, 255];
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i], a = l[3];
      base = [a * l[0] + (1 - a) * base[0],
              a * l[1] + (1 - a) * base[1],
              a * l[2] + (1 - a) * base[2]];
    }
    function ch(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var lum = 0.2126 * ch(base[0]) + 0.7152 * ch(base[1]) + 0.0722 * ch(base[2]);
    /* Set OR REMOVE. It only ever set before, and that produced navy type on a
       navy band the moment the band paint below started running first: the
       ground had become dark, but the light-palette flag from an earlier pass
       stayed on. 1:1 contrast, caught by measuring after rather than by eye.
       0.18 sits well clear of both real cases: the navy band is 0.023, white 1. */
    if (lum > 0.18) score.setAttribute('data-nf-ground', 'light');
    else score.removeAttribute('data-nf-ground');
  }

  function apply(sw) {
    // The section is the flex column holding heading / carousel / CTA. The
    // widget we want is the child of that section which contains the swiper.
    var section = sw.closest('.e-con-full') ;
    var widget = sw.parentElement;
    while (widget && widget.parentElement && widget.parentElement !== section) {
      widget = widget.parentElement;
    }
    if (!widget || widget === sw) return;
    if (widget.getAttribute('data-nf-reviews')) return;        // idempotent

    var inner = sw.parentElement;      // .elementor-widget-container
    if (!inner || inner.parentElement !== widget) inner = widget.firstElementChild;
    if (!inner) return;

    var score = buildScore();
    /* The band's content measured 976 wide at left 232 against every other
       section's 1140 at 150. Marking one ancestor was not enough: the width is
       lost in STEPS, each an Elementor width setting on a nested container —
       measured 1140 (.e-con-inner) -> 1100 -> 1080 -> 976. So mark every
       element between the carousel widget and the theme's own .e-con-inner,
       and let the stylesheet give them all width:100% so the container's 1140
       reaches the content intact.

       Marked by structure, never by element id — the ids differ per page. */
    /* The section that holds the whole band. Marked so the stylesheet can
       assert its display — see the note there. */
    if (section) section.setAttribute('data-nf-reviews-sec', '');

    var chain = [];
    var link = widget;
    var found = false;
    for (var g = 0; g < 8 && link && link.parentElement; g++) {
      chain.push(link);
      if (/\be-con-inner\b/.test(link.parentElement.className || '')) { found = true; break; }
      link = link.parentElement;
    }

    /* Only commit the marks if the walk actually REACHED the theme's
       .e-con-inner. It does not on every page: index.html, framingham-ma and
       greenville-me are built differently, the loop ran its full eight steps
       without finding one, and the marks landed on a full-width wrapper. The
       CSS then set that to width:100% of the VIEWPORT — measured, the score
       lockup sat flush at left 0 with a 1920px box, while the four pages that
       do have .e-con-inner sat correctly at 390.

       Marking nothing is the right failure here: those pages keep whatever
       width their own layout gives them, which is what they had before any of
       this. A partial application is worse than none. */
    if (found) {
      for (var m = 0; m < chain.length; m++) {
        chain[m].setAttribute('data-nf-reviews-box', '');
      }
    } else {
      /* No .e-con-inner to hang the container on, so the row has to carry it
         itself — otherwise the lockup sits flush against the window, which is
         exactly what it did on these three pages: measured at left 0 while the
         four pages that DO have one sat at 390. */
      widget.setAttribute('data-nf-reviews-fallback', '');

      /* The heading is a SIBLING branch, not on the carousel's chain, so the
         line above never reaches it — measured on index.html, the lockup moved
         to 150 while "The Stars of New England" stayed at 232. Mark its branch
         too, so the band's two halves share one edge. */
      if (section) {
        var kids = section.children;
        for (var k = 0; k < kids.length; k++) {
          var h = kids[k].querySelector('h1, h2, h3, h4');
          if (h && /Stars of New/i.test(h.textContent || '')) {
            kids[k].setAttribute('data-nf-reviews-fallback', '');
            break;
          }
        }
      }
    }

    widget.insertBefore(score, inner);

    /* The band's navy is missing on framingham-ma and greenville-me — measured,
       the composited ground behind the lockup is pure white there and
       rgb(10,44,71) on the four pages that have it. PRE-EXISTING: it is still
       white with every stylesheet of mine disabled, and it leaves dark #1F5277
       cards floating on a white page.

       So if the band has no dark ground of its own, give it one — then run the
       ground check AFTER, so it sees navy and keeps the type white instead of
       switching to the dark-on-light palette a white band would need. Order
       matters, which is why the paint happens first. */
    if (section && isLightGround(score)) {
      section.setAttribute('data-nf-band', 'paint');
      void section.offsetHeight;                 // let the style land first
    }
    groundCheck(score);
    inner.classList.add('nf-reviews__rail');
    widget.setAttribute('data-nf-reviews', 'rating');

    // The rail is narrower now, so Swiper has to recount slides per view. Two
    // passes: one immediately, one after layout settles -- the first can run
    // before the new flex widths have resolved.
    /* MIN_SLIDE is the narrowest a review card may get before its quote stops
       being readable. Measured on index.html: at 1024 the rail is 984 and four
       slides give 239px each, which reads at 39 characters per line. Above 1280
       the rating lockup joins the row, the rail drops to 832, and four slides
       become 201px -- a 142px quote column at 28-33 chars per line, while the
       SCREEN got wider. Three slides in that same 832 rail give 271px and 43-44
       characters, which is the band this card was designed around: the card
       padding note in reviews-rating.css already says "one of two or three on a
       narrower rail instead of one of four across the full width".

       Keyed to the RAIL, not the viewport, because the rail is what actually
       changed -- it narrows when the lockup joins the row, not at any particular
       window size. attleboro-ma and the other store pages already ask for 3 and
       compute 277px per slide, so the guard leaves them alone. */
    var MIN_SLIDE = 240;

    function fitSlides() {
      try {
        if (!sw.swiper || !sw.swiper.params) return;
        var railW = inner.getBoundingClientRect().width;
        if (!railW) return;
        var want = sw.swiper.params.slidesPerView;
        if (typeof want !== 'number' || want <= 1) return;
        if (railW / want >= MIN_SLIDE) return;                 // already readable
        var fit = Math.max(1, Math.floor(railW / MIN_SLIDE));
        if (fit < want) { sw.swiper.params.slidesPerView = fit; }
      } catch (e) { /* Swiper absent on the two stub pages */ }
    }

    function refresh() {
      try {
        fitSlides();
        mountNav();
        if (sw.swiper && sw.swiper.update) sw.swiper.update();
      } catch (e) {}
    }
    refresh();
    window.setTimeout(refresh, 120);
    window.setTimeout(refresh, 500);
    window.addEventListener('resize', function () { window.setTimeout(refresh, 160); });

    /* -----------------------------------------------------------------------
       NEXT / PREV FOR THE REVIEW CARDS.                     (owner, 2026-09-10)

       "add next button for the cards". Measured across the site first, because
       "the cards" needed pinning down: every carousel on index.html and the
       store pages carries a visible next AND prev EXCEPT this one, which has
       pagination dots and nothing else. So this is the gap.

       BOTH buttons, not just next, and that is a deliberate small widening of
       the ask: every other carousel here is a next+prev pair, and forward-only
       navigation on a 16-slide rail leaves no way back except hunting for the
       right dot. Say the word and prev comes out.

       Built to the site's own pattern rather than a new one -- the hero
       carousel's controls are `role="button"`, `aria-label`, `tabindex="0"` with
       an inline chevron, so these are too. 44x44 rather than the hero's 25x45,
       because the target-size pass earlier today put every other control on this
       page over the WCAG floor and a new one should not reopen it.

       Driven through Swiper's own API, so the dots, the loop and slidesPerView
       stay in agreement -- moving the track by hand would desynchronise the
       pagination this band already shows.

       NOT ADDED where Swiper never initialises: framingham-ma and greenville-me
       render the slides as a static column, and a control that cannot move
       anything is worse than no control.
       -------------------------------------------------------------------- */
    function arrow(dir) {
      var b = el('button', 'nf-rev-nav nf-rev-nav--' + dir);
      b.type = 'button';
      b.setAttribute('aria-label', dir === 'next' ? 'Next reviews' : 'Previous reviews');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="' + (dir === 'next' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7') +
        '" fill="none" stroke="currentColor" stroke-width="2.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg>';
      b.addEventListener('click', function () {
        try {
          if (!sw.swiper) return;
          if (dir === 'next') sw.swiper.slideNext(); else sw.swiper.slidePrev();
        } catch (e) {}
      });
      return b;
    }

    /* Mounted from the refresh pass, NOT inline here. Swiper has not
       initialised yet at this point in the script -- measured, the guard below
       read false on every page while the same check read true a second later --
       so the buttons are created by mountNav(), which refresh() calls on the
       same immediate/120ms/500ms schedule the slidesPerView fit already uses. */
    function mountNav() {
      if (!sw.classList.contains('swiper-initialized')) return false;
      if (inner.querySelector('.nf-rev-nav')) return true;
      /* OWNER 2026-09-10: "do not make the buttons overlap the card, place them
         before and after." So they go into the FLOW either side of the carousel
         rather than being positioned over its edges: prev is inserted before the
         .swiper and next after it, and the rail becomes a flex row (see the CSS)
         in which the carousel shrinks to make room. Appending both to the rail
         and positioning them absolutely is what put them on the cards. */
      inner.insertBefore(arrow('prev'), sw);
      if (sw.nextSibling) inner.insertBefore(arrow('next'), sw.nextSibling);
      else inner.appendChild(arrow('next'));
      inner.setAttribute('data-nf-rev-nav', '');
      return true;
    }

    /* Swiper initialises well after this script runs, and NOT on a schedule this
       file can predict: with mounting hung off the existing 0/120/500ms refresh
       passes, exactly one of nine page/width combinations came up with buttons.
       So it polls until Swiper is actually up, then stops. 200ms x 30 gives it
       six seconds, which covers the slowest case measured here, and the interval
       clears itself the moment the buttons exist so nothing keeps ticking. */
    if (!mountNav()) {
      var navTries = 0;
      var navTimer = window.setInterval(function () {
        if (mountNav() || ++navTries > 30) window.clearInterval(navTimer);
      }, 200);
    }

    // Slides past the fourth are hidden by CSS on the two pages where Swiper
    // never initialises. Hide them from assistive tech as well, or a screen
    // reader announces ten reviews where four are shown.
    if (!sw.classList.contains('swiper-initialized')) {
      var slides = sw.querySelectorAll('.swiper-slide[class*="type-reviews"]');
      for (var k = 3; k < slides.length; k++) slides[k].setAttribute('aria-hidden', 'true');
    }

    // The contrast corrector may already have walked this subtree.
    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  function init() {
    var rails = document.querySelectorAll('.swiper');
    for (var i = 0; i < rails.length; i++) {
      if (rails[i].querySelector('.swiper-slide[class*="type-reviews"]')) apply(rails[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  window.addEventListener('load', init);
})();
