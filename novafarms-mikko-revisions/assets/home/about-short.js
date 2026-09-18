/* =============================================================================
   about-short.js — a short homepage About, with Learn More.

   Owner asked for a shorter version of the story block with a "Learn More" CTA.

   WHAT IS KEPT AND WHAT MOVES

   The block is the green star, a bold statement ("IT ALL BEGAN WITH A GROUP OF
   FRIENDS...") and two paragraphs of detail. The statement is the brand thesis
   and stays. The two detail paragraphs are what make it long, and they ALREADY
   EXIST on visit-us.html -- verified, both paragraphs are on that page and on
   team.html. So Learn More has a real destination and nothing is lost from the
   site by shortening the homepage.

   That distinction matters. An earlier attempt collapsed this block behind a
   "Find out more" expander and shipped a teaser window that contained zero
   words -- its first child is the star IMAGE, so the 108px window showed the
   star and whitespace. This does not repeat that: the paragraphs are hidden
   outright and the reader is sent to a page that actually holds them, rather
   than to a fold that pretends to.

   Done in JS rather than by editing the markup because the block is the
   client's own Elementor content and this stays reversible -- remove the two
   injected lines from index.html and the page is exactly as it was.
   ============================================================================= */
(function () {
  'use strict';

  var PANEL = '.elementor-element-a968cca';      // the About row — now removed
  var STATEMENT = '.elementor-element-0747d94'; // BUILT FROM FRIENDSHIP / ...
  var HREF  = 'visit-us.html';

  function shorten(panel) {
    if (panel.getAttribute('data-nf-short')) return;      // idempotent

    // The statement is the paragraph carrying the <strong>. Everything after it
    // in the same container is detail.
    var strong = panel.querySelector('strong');
    if (!strong) return;
    var lead = strong.closest('p') || strong.parentElement;
    if (!lead) return;

    var host = lead.parentElement;
    var hidden = 0;
    var sibs = Array.prototype.slice.call(host.children);
    var seenLead = false;
    for (var i = 0; i < sibs.length; i++) {
      if (sibs[i] === lead) { seenLead = true; continue; }
      if (!seenLead) continue;
      // Only hide things that actually carry prose, so any decorative element
      // between them survives.
      if ((sibs[i].textContent || '').trim().length > 30) {
        sibs[i].setAttribute('data-nf-short-hidden', '');
        hidden++;
      }
    }
    if (!hidden) return;                                   // nothing to shorten

    var a = document.createElement('a');
    a.className = 'nf-about-more';
    a.href = HREF;
    a.textContent = 'Learn More';
    // The link text alone would read as "Learn More" out of context in a screen
    // reader's link list, which is exactly the pattern WCAG 2.4.4 warns about.
    a.setAttribute('aria-label', 'Learn more about Nova Farms');
    host.appendChild(a);

    panel.setAttribute('data-nf-short', 'true');

    // The contrast corrector may have already walked this subtree.
    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  /* OWNER CALL: the About row goes entirely, and Learn More moves up into the
     statement panel.

     Why the link has to MOVE rather than just disappear with the row: it is
     the only route from the homepage to the full story on visit-us.html. The
     row's own closing clause — "nurtured by sunlight, sustained by healthy
     soil, and shared with purpose" — exists nowhere else in the build, but the
     statement panel it now sits under already says ROOTED IN THE EARTH and
     SHARED WITH PURPOSE, so the sentiment survives in the place the link now
     lives.

     Measured before this: reviews sat 2.03 screens down on mobile and 2.41 on
     desktop, against targets of 2.0 and 1.9. Removing the row is the only
     option of the three tested that clears BOTH. */
  function moveLearnMore() {
    var stmt = document.querySelector(STATEMENT);
    if (!stmt || stmt.getAttribute('data-nf-learnmore')) return;

    // the block inside the panel that actually holds the star and the lines
    var host = null;
    var kids = stmt.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].querySelector('img, p')) { host = kids[i]; break; }
    }
    if (!host) return;

    var a = document.createElement('a');
    a.className = 'nf-about-more nf-statement-more';
    a.href = HREF;
    a.textContent = 'Learn More';
    // "Learn More" alone is exactly the link text WCAG 2.4.4 warns about — out
    // of context in a screen reader's link list it says nothing.
    a.setAttribute('aria-label', 'Learn more about Nova Farms');
    host.appendChild(a);

    stmt.setAttribute('data-nf-learnmore', 'true');
    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  function init() {
    // The About row is hidden by CSS; nothing is shortened in place any more.
    moveLearnMore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
})();
