/* =============================================================================
   deals.js — builds the mockup deals carousel into each store's deals slot.

   THESE FOUR OFFERS ARE INVENTED. No deal content exists anywhere in the
   bundle, so they demonstrate the layout only, and the UI says so above the
   rail rather than only in a code comment. Cannabis retail promotions carry
   state-by-state regulatory weight; none of this should reach a live site
   without the client's compliance review.

   The offer text is real HTML over a background image, never text baked into
   the picture -- revision 2's locked decision 4. Every word stays selectable,
   reachable by a screen reader, and scales with the text-size setting.

   No auto-advance, deliberately: a carousel that moves on its own needs a pause
   control for WCAG 2.2.2, and it takes control away from the reader for no
   gain. This moves only when asked.
   ============================================================================= */
(function () {
  'use strict';

  var DEALS = [
    { tag: 'New customers', title: 'First visit, 20% off',
      offer: 'Twenty percent off your first order at this store.',
      terms: 'Example offer. One-time use, first-time customers, cannot be combined.',
      img: 'assets/deals/deal-store-interior.jpg' },
    { tag: 'Every Friday', title: 'Flower Friday',
      offer: 'Fifteen percent off all flower, every Friday.',
      terms: 'Example offer. In-store and pickup. While supplies last.',
      img: 'assets/deals/deal-farm-rows.jpg' },
    { tag: 'Loyalty', title: 'Double points weekend',
      offer: 'Earn twice the points on everything, Saturday and Sunday.',
      terms: 'Example offer. Points & Perks members only. Enrolment is free.',
      img: 'assets/deals/deal-flower-macro.jpg' },
    { tag: 'Bundle', title: 'Five pre-rolls, $40',
      offer: 'Mix and match any five pre-rolls for forty dollars.',
      terms: 'Example offer. Selected strains. While supplies last.',
      img: 'assets/deals/deal-prerolls.jpg' }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function build(slot) {
    var store = (document.documentElement.getAttribute('data-store') || '').trim();
    var wrap = el('div', 'nf-deals');

    // The visible "Example deals" banner is removed per the owner. The four
    // offers below are STILL invented -- see the header of this file. Nothing
    // on the page says so any more, so that fact now lives only here and in
    // the handover log. Cannabis retail promotions carry state-by-state
    // regulatory weight; these need the client's copy and compliance review
    // before this reaches a live domain.

    var rail = el('ul', 'nf-deals__rail');
    rail.setAttribute('tabindex', '0');
    // NO role='group' — see category-icons.js. It overrides the <ul>'s implicit
    // list role and orphans every <li> inside (axe 'listitem', serious).
    rail.setAttribute('aria-label', 'Deals, example content');

    DEALS.forEach(function (d) {
      var li = el('li', 'nf-deals__slide');
      var card = el('article', 'nf-deal');

      var img = el('div', 'nf-deal__img');
      img.style.backgroundImage = 'url("' + d.img + '")';
      // Decorative: the offer is in the text beneath it, so an alt would just
      // repeat what the reader is about to hear.
      img.setAttribute('role', 'presentation');
      card.appendChild(img);

      card.appendChild(el('p', 'nf-deal__tag', d.tag));
      card.appendChild(el('h3', 'nf-deal__title', d.title));
      card.appendChild(el('p', 'nf-deal__offer', d.offer));
      card.appendChild(el('p', 'nf-deal__terms', d.terms));

      li.appendChild(card);
      rail.appendChild(li);
    });
    wrap.appendChild(rail);

    /* --- controls --- */
    var controls = el('div', 'nf-deals__controls');
    var prev = el('button', 'nf-deals__btn', '‹');
    var next = el('button', 'nf-deals__btn', '›');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Previous deals');
    next.setAttribute('aria-label', 'Next deals');
    var count = el('span', 'nf-deals__count');
    // aria-live so a screen-reader user hears the position change after using
    // the buttons; polite so it never interrupts.
    count.setAttribute('aria-live', 'polite');

    function page() { return rail.clientWidth; }
    function update() {
      var max = rail.scrollWidth - rail.clientWidth;
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max - 2;
      var per = Math.max(1, Math.round(rail.clientWidth / (rail.firstChild ? rail.firstChild.getBoundingClientRect().width + 14 : 1)));
      var shown = Math.min(DEALS.length, per);
      var first = Math.min(DEALS.length - shown + 1,
                    Math.floor(rail.scrollLeft / Math.max(1, page()) * shown) + 1);
      count.textContent = shown >= DEALS.length
        ? DEALS.length + ' deals'
        : first + '–' + Math.min(DEALS.length, first + shown - 1) + ' of ' + DEALS.length;
    }
    function go(dir) {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
                   document.documentElement.getAttribute('data-a11y-motion') === 'off';
      rail.scrollBy({ left: dir * page(), behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    rail.addEventListener('scroll', function () { window.setTimeout(update, 60); }, { passive: true });
    window.addEventListener('resize', update);

    controls.appendChild(prev);
    controls.appendChild(next);
    controls.appendChild(count);
    wrap.appendChild(controls);

    slot.parentNode.replaceChild(wrap, slot);
    update();
    window.setTimeout(update, 120);          // after layout settles

    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  function init() {
    var slots = document.querySelectorAll('.nf-loc__empty');
    for (var i = 0; i < slots.length; i++) {
      // only the deals slot, not any other placeholder
      if (/deals slot/i.test(slots[i].textContent || '')) build(slots[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  window.addEventListener('load', init);
})();
