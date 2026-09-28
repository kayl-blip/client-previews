/* reforge.js — Family Vision Solutions homepage reforge: behaviour for the design layer only.
 * 1. html.rf-scrolled once the page has scrolled (compacts the sticky glass header).
 * 2. Scroll-reveal for below-the-fold modules, staggered per section (sgen --t-reveal).
 * 3. .rf-today on the opening-hours row for the visitor's weekday.
 * Contract: this file never writes text, markup, links or content attributes. It only toggles classes and sets the
 * --rf-delay custom property (checked by tools/audit/verify-invariants.mjs A3). Without it nothing is hidden.
 */
(function () {
  'use strict';
  var root = document.documentElement;

  // 1. header state
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      root.classList.toggle('rf-scrolled', (window.pageYOffset || root.scrollTop) > 12);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3. today's hours
  var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var today = days[new Date().getDay()];
  Array.prototype.forEach.call(document.querySelectorAll('.ecp-post-hours-item.ecp-post-hours-' + today), function (li) {
    li.classList.add('rf-today');
  });

  // 2. reveal
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var content = document.querySelector('main#content .fl-builder-content-23048');
  if (!content) return;
  // every section row except the hero and the quick-link cards that overlap it
  var rows = Array.prototype.filter.call(content.children, function (r) {
    return r.classList.contains('fl-row') && !r.classList.contains('fl-node-645cdb50afff3') && !r.classList.contains('fl-node-jxa5vmq6h1fu');
  });
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

  var all = [];
  root.classList.add('rf-motion');
  rows.forEach(function (row) {
    // modules plus the split image panels (bg-photo columns carry no module)
    var units = Array.prototype.filter.call(row.querySelectorAll('.fl-module, .fl-col-bg-photo > .fl-col-content'), function (m) {
      if (m.classList.contains('fl-col-content') && m.querySelector('.fl-module')) return false; // tile columns: their module reveals
      return !m.parentElement.closest('.fl-module');   // outermost modules only
    });
    var i = 0;
    units.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;     // hidden in the source: leave untouched
      if (r.top < vh) return;                          // on screen at load: never hide it
      el.style.setProperty('--rf-delay', Math.min(i, 5) * 80 + 'ms');
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
