/* reforge.js — VisionMann homepage reforge: behaviour for the design layer only.
 * 1. Header: measures the No-Puff strip into --rf-strip-h (the sticky bar's offset) and toggles html.rf-scrolled.
 * 2. Hours & Locations (added section): .rf-today on each office's row for the visitor's weekday.
 * 3. Scroll-reveal for below-the-fold blocks, staggered per section.
 * Contract: this file never writes text, markup, links or content attributes. It only toggles classes and sets the
 * --rf-delay / --rf-strip-h custom properties (checked by tools/audit/verify-invariants.mjs A3). Without it nothing is hidden, and
 * with prefers-reduced-motion the reveal does nothing at all.
 */
(function () {
  'use strict';
  var root = document.documentElement;

  // 1. header (owner change 2026-10-06): the No-Puff strip scrolls away and the white bar sticks. The bar's sticky top is
  // minus the strip's height, measured here into --rf-strip-h; html.rf-scrolled adds the bar's shadow once it sticks.
  var strip = document.querySelector('header.ecp-header .fl-node-590ca41f8090a');
  function measure() { if (strip) root.style.setProperty('--rf-strip-h', strip.offsetHeight + 'px'); }
  measure();
  if (strip && 'ResizeObserver' in window) new ResizeObserver(measure).observe(strip);
  window.addEventListener('resize', measure);
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      root.classList.toggle('rf-scrolled', (window.pageYOffset || root.scrollTop) > (strip ? strip.offsetHeight : 0) + 4);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 2. today's hours
  var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  Array.prototype.forEach.call(document.querySelectorAll('.rf-visit__day[data-day="' + days[new Date().getDay()] + '"]'), function (li) {
    li.classList.add('rf-today');
  });

  // 3. reveal
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var content = document.querySelector('main#content .fl-builder-content-4828');
  if (!content) return;
  var vh = window.innerHeight || root.clientHeight;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      el.classList.add('rf-in');
      io.unobserve(el);
      var delay = parseInt(el.style.getPropertyValue('--rf-delay'), 10) || 0;
      setTimeout(function () {                        // hand the element back untouched once played
        el.classList.remove('rf-reveal', 'rf-in');
        el.style.removeProperty('--rf-delay');
      }, 800 + delay);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  // the units, grouped so each group staggers on its own: every source module of the services / contact rows (service
  // cards one by one) and the cards of each added section. The doctor cards stay put: their white surface is a grid
  // pseudo-element that cannot fade with the text (reforge-team.css).
  var groups = [
    content.querySelectorAll('.fl-node-60ede28d7a049 .fl-module:not(.fl-module-ecp-gallery), .fl-node-60ede28d7a049 .ecp-gallery-item'),
    content.querySelectorAll('.fl-node-60ede28d7a03d .fl-module'),
    content.querySelectorAll('.rf-tech__head, .rf-tech__card'),
    content.querySelectorAll('.rf-eyewear__inner'),
    content.querySelectorAll('.rf-insure__copy, .rf-insure__logo'),
    content.querySelectorAll('.rf-visit__head, .rf-visit__card, .rf-visit__alert'),
  ];
  var all = [];
  root.classList.add('rf-motion');
  groups.forEach(function (list) {
    var i = 0;
    Array.prototype.forEach.call(list, function (el) {
      if (el.parentElement && el.parentElement.closest('.rf-reveal')) return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;     // hidden in the source: leave untouched
      if (r.top < vh) return;                          // on screen at load: never hide it
      if (r.left >= (window.innerWidth || root.clientWidth) || r.right <= 0) return;   // off-screen sideways (the phone swipe row): leave it
      el.style.setProperty('--rf-delay', Math.min(i, 5) * 90 + 'ms');
      i++;
      el.classList.add('rf-reveal');
      io.observe(el);
      all.push(el);
    });
  });

  // safety nets: bfcache restore and print show everything
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) all.forEach(function (el) { el.classList.add('rf-in'); }); });
  window.addEventListener('beforeprint', function () { all.forEach(function (el) { el.classList.add('rf-in'); }); });
})();
