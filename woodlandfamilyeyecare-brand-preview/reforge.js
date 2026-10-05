/* reforge.js — Woodland Family Eye Care homepage reforge: behaviour for the design layer only.
 * 1. html.rf-scrolled once the page has scrolled (compacts the sticky glass header).
 * 2. Scroll-reveal: every block below the fold glides in as it enters the window, cascading in screen order.
 * 3. .rf-today on the opening-hours row for the visitor's weekday; .rf-closed on rows whose hours read "Closed".
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
  Array.prototype.forEach.call(document.querySelectorAll('.ecp-post-hours-item'), function (li) {
    var d = li.querySelector('.ecp-post-data');
    if (d && /^\s*closed\s*$/i.test(d.textContent)) li.classList.add('rf-closed');
  });

  // 2. reveal — owner change 2026-10-05 ("let's add smooth on scroll animation"). The blocks are the builder modules and
  //    the added partials, found through the wrappers the layout flattens with display:contents; the eye-exam topics, the
  //    eyewear tiles and the welcome schedule items come in one by one; the footer's columns too. Blocks that enter
  //    together cascade in the order they sit on screen (top, then left), not in source order.
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var content = document.querySelector('main#content .fl-builder-content-2650');
  if (!content) return;
  var UNIT = '.fl-module, [data-rf-added], .fl-col-bg-photo > .fl-col-content';
  var PART = '.rf-exams__head, .rf-exams__photo, .rf-exams__item, .rf-wear__grid > *, .rf-ages__photo, .rf-ages__item';
  var vw = window.innerWidth || root.clientWidth;
  var vh = window.innerHeight || root.clientHeight;
  // every section except the hero and the quick-link cards that overlap it, then the footer
  var sections = Array.prototype.filter.call(content.children, function (s) {
    return !s.classList.contains('fl-node-5b80266e2a389') && !s.classList.contains('fl-node-5b58eba8d333e');
  });
  var footer = document.querySelector('footer.ecp-footer');
  if (footer) sections.push(footer);

  var pending = [];
  var seen = [];
  function consider(el) {
    if (el.querySelector(PART)) return;                         // split: its parts come in one by one
    for (var k = 0; k < seen.length; k++) if (seen[k] === el || seen[k].contains(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {                      // flattened by the layout: its children are the blocks
      if (window.getComputedStyle(el).display === 'contents') Array.prototype.forEach.call(el.children, consider);
      return;                                                   // otherwise hidden in the source: leave it alone
    }
    seen.push(el);
    if (r.top < vh || r.right <= 0 || r.left >= vw) return;     // on screen at load (never hide it), or off to the side
    pending.push(el);
  }
  sections.forEach(function (sec) {
    if (sec.matches(UNIT)) consider(sec);
    Array.prototype.forEach.call(sec.querySelectorAll(UNIT + ', ' + PART), consider);
  });
  if (!pending.length) return;

  root.classList.add('rf-motion');
  pending.forEach(function (el) { el.classList.add('rf-reveal'); });
  var io;
  function play(list) {
    list.sort(function (a, b) {                                 // screen order: top first, then left
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return Math.abs(ra.top - rb.top) > 24 ? ra.top - rb.top : ra.left - rb.left;
    });
    list.forEach(function (el, n) {
      var delay = Math.min(n, 6) * 90;
      io.unobserve(el);
      pending.splice(pending.indexOf(el), 1);
      el.style.setProperty('--rf-delay', delay + 'ms');
      el.classList.add('rf-in');
      setTimeout(function () {                                  // hand the element back untouched once played
        el.classList.remove('rf-reveal', 'rf-in');
        el.style.removeProperty('--rf-delay');
      }, 1000 + delay);
    });
  }
  io = new IntersectionObserver(function (entries) {
    play(entries.filter(function (e) { return e.isIntersecting && pending.indexOf(e.target) > -1; })
      .map(function (e) { return e.target; }));
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  pending.forEach(function (el) { io.observe(el); });

  // the last blocks of the page can never cross the -8% line: play what is on screen once the page bottoms out
  window.addEventListener('scroll', function () {
    if (!pending.length) return;
    var h = window.innerHeight || root.clientHeight;
    if ((window.pageYOffset || root.scrollTop) + h < root.scrollHeight - 2) return;
    play(pending.filter(function (el) { return el.getBoundingClientRect().top < h; }));
  }, { passive: true });
  // safety nets: bfcache restore and print show everything
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) play(pending.slice()); });
  window.addEventListener('beforeprint', function () { play(pending.slice()); });
})();
