/* =============================================================================
   container-fit.js — stop one cloned container outgrowing the whole page.

   OWNER ASK 2026-09-10: "optimize adaptability to any screen size."

   THE DEFECT. This site has two container systems and only one of them is
   capped. Measured on attleboro-ma.html:

     block                                  1440        1920        2560
     authored rail (max-width 1180)      1180@130    1180@370    1180@690
     authored rows / photos (1140)       1140@150    1140@390    1140@710
     cloned e-con-full, --width:80%      1152@144    1536@192    2048@256
                        max-width:none

   The last one is the store-header block -- store name, address, hours, phone,
   GET DIRECTIONS. It is 6px out of line at 1440, 198px at 1920 and 454px at
   2560, so on a wide screen the store's own name starts nearly half a thousand
   pixels left of the address strip directly above it.

   WHY THIS IS A SCRIPT AND NOT A STYLESHEET, WHICH I TRIED FIRST.
   `--width: 80%` is set by a per-element Elementor rule
   (`.elementor-6871 .elementor-element.elementor-element-e2777e7{--width:80%}`),
   never inline, so no attribute selector can reach it, and CSS cannot select on
   a custom property's VALUE.

   The obvious blanket rule is worse than the defect. I measured
   `.site-main .e-con-full{max-width:1140px}` before writing anything and it
   collapsed the page's full-bleed sections: index.html went from 14 full-bleed
   containers to 3, attleboro-ma from 8 to 5. The theory that full-bleed blocks
   would defend themselves with an explicit `max-width:100%` is FALSE -- most of
   them also compute `max-width: none`, so a blanket cap cannot tell a
   deliberately full-bleed band from an accidentally uncapped column.

   So the discrimination has to happen at runtime, where the actual numbers are.
   The test is deliberately narrow: a PERCENTAGE width strictly between 0 and
   100 (100% means the author meant full bleed), no cap of its own, and a
   rendered width past the site's own 1140 measure. Everything else is left
   exactly as it is.

   Tag once and never untag: this file's CSS gives tagged elements a max-width,
   so re-running the test against a tagged element would see the cap it just
   applied and bounce. Percentages reflow on their own and the cap is a static
   1140px, so there is nothing to recompute on resize.
   ============================================================================= */
(function () {
  'use strict';

  var CAP = 1140;

  function tag() {
    /* .e-con-inner is included explicitly: Elementor's boxed container is
       `<div class="e-con e-con-boxed"><div class="e-con-inner">`, so the inner
       is a CHILD of an .e-con and never matches .e-con itself. The brands band
       carries its percentage cap there, which is why an earlier version of this
       scan measured it as uncapped and still never tagged it. */
    var els = document.querySelectorAll('.site-main .e-con, .site-main .e-con-inner');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-nf-overwide')) continue;      // idempotent

      var cs = window.getComputedStyle(el);

      /* Two ways a container ends up uncapped, and both need catching.

         (a) `--width: 80%` with `max-width: none` -- the cloned store-header
             block on the six store pages.
         (b) `max-width: 80%`, from `--content-width: 80%` -- the brands band on
             index.html, whose own `--container-max-width` is 1140px and is
             simply overridden by the percentage. Measured at 1440/1600/1920/2560
             it renders 1152@144, 1280@160, 1536@192 and 2048@256, so the copy
             column and the tile grid drift apart as the screen grows: the gap
             between them measures 41px at 1440, 145 at 1600, 332 at 1920 and
             638 at 2560 -- a third of a 2560 screen is empty band.

         An explicit PX max-width is left alone: something already decided that
         element's bound and it is not this file's business. 100% either way is
         full bleed and stays full bleed. */
      var mw = cs.maxWidth;
      var wv = (cs.getPropertyValue('--width') || '').trim();
      var pctOf = function (v) {
        var m = /^(\d+(?:\.\d+)?)%$/.exec((v || '').trim());
        return m ? parseFloat(m[1]) : null;
      };
      var widthPct = pctOf(wv);
      var capPct = pctOf(mw);

      var uncapped =
        (mw === 'none' && widthPct !== null && widthPct > 0 && widthPct < 100) ||
        (capPct !== null && capPct > 0 && capPct < 100);

      if (!uncapped) continue;

      var r = el.getBoundingClientRect();
      if (r.height < 40) continue;
      if (r.width <= CAP + 5) continue;                       // already in measure

      el.setAttribute('data-nf-overwide', '');
    }
  }

  /* --------------------------------------------------------------------------
     NOT FIXED HERE, AND THE REASON IS WORTH KEEPING.

     services.html's bulk-pricing grid keeps two tracks while the panel around it
     changes shape, so its cells collapse in the MIDDLE of the range:

       768   198px cells, 4 lines
       1024  258px, 4
       1025   88px, 8      <- panel switches to a side-by-side row
       1280  118px, 8
       1440  137px, 5
       1920  194px, 4

     "7g (1/4 oz): 2% OFF" over eight lines is a real defect and
     `repeat(auto-fit, minmax(200px,1fr))` fixes it exactly -- measured, 1025 goes
     to 194px/4 lines, 1280 to 255px/4, 1440 to 292px/4.

     But it cannot be TARGETED. `.e-grid` is on 45 of the 47 pages, so a blanket
     rule restructures the site to fix one component. I tried tagging grids whose
     tracks had collapsed below a threshold, and the two cases overlap in exactly
     the dimension the test uses:

       services  1025 track  97.97   1280 track 131.42   1440 track 152.42
       index     1025 track 139.92   1100 track 145.55   1280 track 157.64

     services at 1440 (152.42) is WIDER than index at 1025 (139.92), so no single
     track threshold takes every broken cell without also taking index.html's
     three-column block -- which is not broken: widening its cells left its line
     count at 7, identical before and after. At a 160px threshold the tag
     restructured the homepage from three columns to two for no reading benefit,
     which is a worse trade than the defect it was fixing.

     Distinguishing them needs a content-aware test (a short label wrapping to
     eight lines is broken; seven lines of list items in a 140px column is a
     designed three-up), and that is a heuristic I am not willing to run across 45
     pages of grids on the strength of one component. Left for a targeted fix
     against services.html's own markup, and reported rather than half-shipped.
     ------------------------------------------------------------------------ */

  function run() { tag(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.addEventListener('load', run);

  window.NovaContainerFit = { tag: run };
})();
