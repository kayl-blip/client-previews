/* =============================================================================
   hero-cta.js — put the store's two CTAs in the hero, stacked on the right.

   OWNER: "stack these CTAs here on the right side of the hero and length of
   CTAs should be equal."

   The pair already exists as the first .nf-loc__cta-row, immediately below the
   hero. This MOVES that node rather than building a second copy, so there is
   one set of links, one set of hrefs, and nothing to keep in sync. Document
   order still puts them after the store name and address, which is the right
   reading order — the visual move is horizontal, not a reorder.

   The second .nf-loc__cta-row, in the "Ready to shop <store>?" band lower down,
   is deliberately left where it is. It gets centre-stacked by CSS instead.
   ============================================================================= */
(function () {
  'use strict';

  function init() {
    var hero = document.querySelector('.nf-hero');
    if (!hero || hero.getAttribute('data-nf-hero-cta')) return;   // idempotent
    var inner = hero.querySelector('.nf-hero__inner');
    if (!inner) return;

    // The FIRST cta row on the page is the one directly under the hero.
    var row = document.querySelector('.nf-loc__cta-row');
    if (!row || hero.contains(row)) return;

    // Its section becomes empty once the row leaves; drop it so the page does
    // not keep a heading-less band with nothing in it.
    var section = row.closest('.nf-loc__sec');

    row.classList.add('nf-hero__cta');
    inner.appendChild(row);
    hero.setAttribute('data-nf-hero-cta', 'true');

    if (section && !section.querySelector('a, p, h2, h3, img, ul')) {
      section.setAttribute('data-nf-empty', 'true');
    }

    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  window.addEventListener('load', init);
})();
