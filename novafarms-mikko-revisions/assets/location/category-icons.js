/* =============================================================================
   category-icons.js — an icon for each "Shop by category" card.

   The bundle has NO category imagery. CLIENT-NOTES records three flower shots
   as the entire product-photo library, so nothing exists for vapes, edibles,
   concentrates, topicals, tinctures, beverages or accessories. These are
   therefore authored as inline SVG rather than sourced: no request, no icon
   font, no dependency, and they take currentColor so the contrast corrector and
   the high-contrast setting both keep working on them.

   Injected rather than written into the markup because it is 9 cards x 6 pages
   = 54 places, and one map here is one place to change. If this script never
   runs the cards still read correctly -- they keep their text label, which is
   the part that carries the meaning.

   Deliberately simple, single-stroke shapes: at 20px, detail turns to noise.
   ============================================================================= */
(function () {
  'use strict';

  var S = 'stroke="currentColor" stroke-width="1.6" fill="none" ' +
          'stroke-linecap="round" stroke-linejoin="round"';

  function svg(body) {
    return '<svg class="nf-loc__cat-icon" viewBox="0 0 24 24" width="20" height="20" ' +
           'aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  // Keys are matched case-insensitively against the card's own text.
  var ICONS = {
    'flower':       svg('<path ' + S + ' d="M12 12c0-4 1.5-7 3-9 1.5 3 1.5 6 0 9M12 12c-3-2.6-5-5.4-6-8 3 .6 5.6 2.4 7.4 4.6M12 12c3.4-1 6.6-1 9.4-.4-2 2.2-4.6 3.4-7.6 3.6M12 12c-3.4-1-6.6-1-9.4-.4 2 2.2 4.6 3.4 7.6 3.6M12 12v9"/>'),
    'pre-rolls':    svg('<path ' + S + ' d="M3 17.5 15.5 5a2.5 2.5 0 0 1 3.5 3.5L6.5 21H3z"/><path ' + S + ' d="M14 6.5 17.5 10"/>'),
    'vapes':        svg('<rect ' + S + ' x="6" y="2.5" width="8" height="19" rx="4"/><path ' + S + ' d="M10 6v4M17 8h4M19 6v4"/>'),
    'edibles':      svg('<rect ' + S + ' x="3.5" y="6.5" width="17" height="11" rx="3"/><path ' + S + ' d="M8 10.5h.01M12 13.5h.01M16 10.5h.01"/>'),
    'concentrates': svg('<path ' + S + ' d="M12 3c3.5 4.2 5.5 7 5.5 9.5A5.5 5.5 0 0 1 6.5 12.5C6.5 10 8.5 7.2 12 3z"/>'),
    'topicals':     svg('<path ' + S + ' d="M9 3h6v3H9zM6.5 6.5h11v14a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path ' + S + ' d="M9.5 12h5"/>'),
    'tinctures':    svg('<path ' + S + ' d="M10 2.5h4v3h-4zM8.5 5.5h7v4l1.5 3v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8l1.5-3z"/><path ' + S + ' d="M9.5 15h5"/>'),
    'beverages':    svg('<path ' + S + ' d="M6 3h12l-1.2 17a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9z"/><path ' + S + ' d="M6.6 9.5h10.8"/>'),
    'accessories':  svg('<circle ' + S + ' cx="12" cy="12" r="8"/><circle ' + S + ' cx="12" cy="12" r="3"/><path ' + S + ' d="M12 4v2M12 18v2M4 12h2M18 12h2"/>')
  };

  function iconFor(label) {
    var k = (label || '').trim().toLowerCase();
    if (ICONS[k]) return ICONS[k];
    for (var name in ICONS) if (k.indexOf(name) === 0) return ICONS[name];
    return null;
  }

  function init() {
    var cards = document.querySelectorAll('.nf-loc__cat');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.querySelector('.nf-loc__cat-icon')) continue;      // idempotent
      var label = (c.textContent || '').trim();
      var ico = iconFor(label);
      if (!ico) continue;
      // Wrap the existing text so icon and label can sit on one baseline
      // without the icon inheriting the label's own spacing.
      c.innerHTML = ico + '<span class="nf-loc__cat-label">' + label + '</span>';
    }

    // A horizontally scrollable region has to be reachable by keyboard, or a
    // keyboard user cannot see the cards past the fold (WCAG 2.1.1).
    var rails = document.querySelectorAll('.nf-loc__cats');
    for (var j = 0; j < rails.length; j++) {
      var r = rails[j];
      if (r.hasAttribute('tabindex')) continue;
      r.setAttribute('tabindex', '0');
      // NO role='group' HERE. It was set to label this focusable scroll region,
      // but role overrides the <ul>'s implicit list role, which orphans every <li>
      // inside it (axe 'listitem', serious). A <ul> can carry tabindex AND
      // aria-label and stay a list, which is what it actually is.
      r.setAttribute('aria-label', 'Shop by category');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  window.addEventListener('load', init);
})();
