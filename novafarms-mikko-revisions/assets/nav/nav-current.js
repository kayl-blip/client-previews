/* =============================================================================
   nav-current.js — marks the top nav link for the page you are actually on.

   See nav-current.css for the full root-cause note. The short version: the
   client's nav config paints `.elementor-item-active` the same white as the
   resting state, and the clone carries that class on only 2 of 47 pages, so the
   nav has never had a working current-page cue. This supplies one.

   WHY A SCRIPT AND NOT A CLASS IN THE HTML
   Marking it in the markup would mean rewriting the nav on all 47 pages, twice
   per page (the horizontal menu and the dropdown copy are separate DOM), and
   re-doing it every time a page is re-assembled from the clone. Matching hrefs
   at runtime is one file, is self-correcting if a href changes, and cannot
   drift out of sync with the menu. Nothing here is content, so nothing here
   needs to be indexed.

   The mark is an attribute, `data-nf-current`, not Elementor's own
   `elementor-item-active` class: that class already carries the client's
   white-on-white styling and is present, wrongly, on pages the clone happened
   to capture it from. Keeping our cue on its own channel means the two never
   have to be untangled.
   ============================================================================= */
(function () {
  'use strict';

  var ATTR = 'data-nf-current';

  // '' on a directory URL (the deployed preview serves the site at
  // /novafarms-revisions/), which is index.html.
  function here() {
    var last = (window.location.pathname.split('/').pop() || '').toLowerCase();
    return last || 'index.html';
  }

  // The file an in-bundle link points at, or null for anything that cannot be
  // "the current page": empty hrefs, fragment-only links, the Elementor popup
  // action hrefs (#elementor-action%3A...), protocol-relative and absolute URLs
  // — the Blog item points at novafarms.com and must never light up.
  function fileOf(a) {
    var href = a.getAttribute('href') || '';
    if (!href) return null;
    if (href.charAt(0) === '#') return null;
    if (href.slice(0, 2) === '//') return null;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(href)) return null;
    var path = href.split('#')[0].split('?')[0];
    var last = (path.split('/').pop() || '').toLowerCase();
    return last || 'index.html';
  }

  function clear(root) {
    var marked = root.querySelectorAll('[' + ATTR + ']');
    for (var i = 0; i < marked.length; i++) {
      // Read the value BEFORE removing it. join-vip.html and locations.html
      // carry the clone's own aria-current="page" in their markup and it is
      // correct on those two pages, so only strip aria-current from links this
      // script marked as 'page' itself.
      var was = marked[i].getAttribute(ATTR);
      marked[i].removeAttribute(ATTR);
      if (was === 'page') marked[i].removeAttribute('aria-current');
    }
  }

  function mark() {
    var header = document.querySelector('[data-elementor-type="header"]');
    if (!header) return 0;

    var page = here();
    var links = header.querySelectorAll('a.elementor-item, a.elementor-sub-item');
    var hits = 0;

    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (fileOf(a) !== page) continue;

      a.setAttribute(ATTR, 'page');
      a.setAttribute('aria-current', 'page');
      hits++;

      // Walk out to the top-level item that owns this one. A dropdown child
      // lives in `li > ul.sub-menu > li > a`, so the owning link is the first
      // `a.elementor-item` found on the way up. Every store page is a child of
      // LOCATIONS, which is how LOCATIONS lights up on all six of them.
      var node = a.parentElement;
      while (node && node !== header) {
        if (node.tagName === 'LI') {
          var top = node.querySelector(':scope > a.elementor-item');
          if (top && top !== a && !top.hasAttribute(ATTR)) {
            top.setAttribute(ATTR, 'section');
          }
        }
        node = node.parentElement;
      }
    }

    window.__navCurrent = { page: page, marked: hits };
    return hits;
  }

  function run() {
    var header = document.querySelector('[data-elementor-type="header"]');
    if (header) clear(header);
    mark();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // The mobile drawer rebuilds its own menu from store-context and the header
  // is re-read on load; re-running is idempotent because clear() precedes mark().
  window.addEventListener('load', run);

  window.NovaNavCurrent = { mark: run };
})();
