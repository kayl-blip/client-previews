/* =============================================================================
   ⚠ SUPERSEDED 2026-09-09 AND NO LONGER LINKED. The owner moved from
   direction B to direction A ("apply A across all sections"). A keeps the
   review card, so the hairline this file existed to draw has nothing to
   separate. The live rules are in reviews-rating.css / reviews-rating.js.

   Kept rather than deleted: the measurements below are the record of what
   B actually cost and where its edge-rule trap was, and relinking is one
   line inside the `oso-reviews:css` sentinel.
   ============================================================================= */

/* =============================================================================
   reviews-quiet.js — hide the separator on whichever review is currently at
   the edge of the carousel.

   WHY THIS EXISTS

   Direction B draws a hairline in the gutter to the left of each review. In a
   static row that is a one-liner: `:not(:first-child)`. This is not a static
   row — it is a looping Swiper, and the wrapper translates, so the slide that
   is leftmost on screen is NOT the first child. CSS has no selector for
   "leftmost currently visible", so CSS alone cannot do this.

   The first attempt tried to dodge it: put the rule at a negative offset and
   let `.swiper`'s overflow:hidden clip the one that falls outside. That was an
   assumption, and it was wrong. Measured across all ten resting positions, at
   three widths:

       1440   a rule sits 5px inside the left edge at 8 of 10 positions
       1200   3px, same 8 of 10
        900   2px, same 8 of 10

   The card is inset ~19px from the container (not the 9px the slide geometry
   suggested), so `left: -14px` lands at +5 rather than outside. A single
   screenshot had caught one of the two clean positions and looked fine, which
   is exactly the kind of near-miss a systematic sweep is for.

   WHAT THIS DOES
   After the carousel settles, measure where each rule would land and switch it
   off for any card whose rule falls in the outer margin. Runs on Swiper's own
   transition end, on the wrapper's DOM transitionend (so it works even if the
   Swiper instance is not reachable), and on resize.

   Mid-slide the rules sweep past the edge along with everything else, which is
   what a moving carousel looks like. This only governs the resting state.

   IF THIS SCRIPT NEVER RUNS the reviews are unaffected — the only consequence
   is the faint edge rule it exists to suppress. It degrades to the previous
   behaviour, never to a broken section.
   ============================================================================= */
(function () {
  'use strict';

  var CARD  = '.e-con-full.e-con';
  var GUARD = 26;          // px from either edge that counts as "in the margin"

  function cards(sw) {
    return sw.querySelectorAll('.swiper-slide[class*="type-reviews"] ' + CARD);
  }

  function mark(sw) {
    var list = cards(sw);
    if (!list.length) return;
    var box = sw.getBoundingClientRect();

    // Read the offset from the stylesheet rather than repeating the number
    // here. reviews-quiet.css changes it per breakpoint (-14px wide, -11px on
    // tablet), and a copy in this file would silently drift from it.
    var off = parseFloat(getComputedStyle(list[0], '::before').left);
    if (isNaN(off)) off = -14;

    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width < 2) continue;                  // a slide with no layout
      var x = r.left - box.left + off;            // where the rule lands
      if (x < GUARD || x > box.width - 2) {
        list[i].setAttribute('data-nf-rule', 'off');
      } else {
        list[i].removeAttribute('data-nf-rule');
      }
    }
  }

  function attach(sw) {
    if (sw.getAttribute('data-nf-rulewatch')) return;   // idempotent
    sw.setAttribute('data-nf-rulewatch', '1');

    /* Deferred and debounced, and both halves earn their place.

       `slideChange` fires synchronously, BEFORE Swiper has applied the new
       transform, so measuring inside the handler reads the OLD positions and
       marks the wrong card. That showed up as a flaky sweep: 1200 clean and
       900 failing on one run, a different position the next -- the signature
       of a race, not of a geometry bug.

       setTimeout rather than requestAnimationFrame: rAF does not fire in a
       background tab, so the marker would stay stale until the tab was looked
       at. The same trap as mobile-nav.js earlier in this build.

       Two passes: one after the current task, one after layout settles. */
    var t0 = 0, t1 = 0;
    var run = function () {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      t0 = window.setTimeout(function () { mark(sw); }, 0);
      t1 = window.setTimeout(function () { mark(sw); }, 140);
    };

    // Swiper's own event, when the instance is reachable.
    if (sw.swiper && typeof sw.swiper.on === 'function') {
      sw.swiper.on('transitionEnd', run);
      sw.swiper.on('slideChangeTransitionEnd', run);
      // 'slideChange' as well, and it is not redundant: a slide change with
      // speed 0 never starts a CSS transition, so neither transitionEnd nor
      // the DOM transitionend below ever fires and the marker goes stale.
      // Caught by the sweep at 1200 -- one position kept a painted rule 21px
      // from the edge because the test jumped instantly between slides.
      sw.swiper.on('slideChange', run);
      sw.swiper.on('resize', run);
    }
    // The DOM event, which fires whether or not the instance is reachable.
    var wrap = sw.querySelector('.swiper-wrapper');
    if (wrap) wrap.addEventListener('transitionend', run);

    window.addEventListener('resize', run);

    mark(sw);
    // Swiper sets slide widths after its own layout pass; two settle-time
    // re-runs cost nothing and cover a first paint that measured too early.
    window.setTimeout(function () { mark(sw); }, 400);
    window.setTimeout(function () { mark(sw); }, 1200);
  }

  function init() {
    var rails = document.querySelectorAll('.swiper');
    for (var i = 0; i < rails.length; i++) {
      if (rails[i].querySelector('.swiper-slide[class*="type-reviews"]')) attach(rails[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  window.addEventListener('load', init);
})();
