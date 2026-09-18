/* =============================================================================
   sticky-spacer-ids.js — stop Elementor's sticky placeholder duplicating ids.

   WHAT WAS MEASURED (2026-09-16, index.html at 440px, age gate dismissed)

   The site QA run reported "6 id(s) used more than once". Re-measured against
   the live DOM with the gate closed, the real number is FOUR, and all four sit
   in the same place:

       menu-1-6aea4ae   x2      ul.elementor-nav-menu   (main menu)
       menu-2-6aea4ae   x2      ul.elementor-nav-menu   (dropdown menu)
       Layer_2          x2      svg   inside the burger toggle
       Layer_1-2        x2      g     inside that same svg

   None of them is duplicated in the static HTML -- each appears exactly ONCE
   in index.html. The second copy is created at runtime: Elementor Pro's sticky
   header clones the whole header container into

       div.elementor-sticky__spacer

   a placeholder that holds the header's space open while the real header is
   position:fixed. The clone is a verbatim copy, ids included.

   WHY THIS IS NOT AN ACCESSIBILITY FIX, STATED PLAINLY

   The first version of this file also set aria-hidden and inert on the spacer,
   on the assumption that a cloned <nav> with 32 focusables was being announced
   twice. Measured, that was wrong: the spacer computes

       visibility: hidden        (440px, at rest AND with sticky engaged)

   and visibility:hidden already removes a subtree from the accessibility tree
   AND from the tab order. Screen readers never saw the clone and Tab never
   reached it. The aria-hidden line stays below because it is correct and free
   for a decorative placeholder, but it is belt-and-braces, not the repair.

   WHAT ACTUALLY BREAKS, THEN

   Duplicate ids are an HTML validity error with three concrete consequences,
   all of which apply here even though nothing is visible:

     - document.getElementById() and querySelector('#id') return the FIRST
       match in document order. The spacer is injected BEFORE the live header
       in some Elementor versions, so a script asking for #menu-1-6aea4ae can
       be handed the hidden copy and silently operate on nothing.
     - label[for] / aria-controls / aria-labelledby resolve the same way.
     - a fragment link to #id can scroll to the invisible clone.

   WHY RENAME AND NOT DELETE

   Deleting the ids would be simpler, but the burger svg refers to its own <g>
   internally. SVG uses same-document references (xlink:href="#Layer_1-2",
   url(#id) in fill/mask/clip-path/filter), so stripping the id would break the
   clone's own artwork. Renaming, and rewriting the references INSIDE the
   spacer to match, keeps the clone self-consistent while making it unique in
   the document. The live header is never touched.

   WHY A MutationObserver AND NOT A ONE-SHOT

   Elementor builds the spacer on sticky init, and rebuilds it on resize and on
   breakpoint change -- each rebuild is a fresh verbatim clone carrying the
   original ids again. A single pass at load would be undone the first time the
   viewport crossed a breakpoint. The observer is cheap: it is scoped to
   childList on <body>, and every element it renames is marked so it is never
   processed twice.
   ============================================================================= */
(function () {
  'use strict';

  var PREFIX = 'nf-sticky-ghost-';
  var DONE = 'data-nf-ids-scoped';

  /* Attributes whose value is a bare id reference. */
  var ID_REF_ATTRS = [
    'for', 'aria-controls', 'aria-labelledby', 'aria-describedby',
    'aria-owns', 'aria-flowto', 'aria-activedescendant', 'list', 'headers'
  ];

  /* Attributes whose value may contain url(#id) -- SVG paint/geometry refs. */
  var URL_REF_ATTRS = [
    'fill', 'stroke', 'clip-path', 'mask', 'filter', 'marker-start',
    'marker-mid', 'marker-end', 'style'
  ];

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* Rewrite every same-document reference to `oldId` found INSIDE `root`.
     Scoped to the spacer on purpose: the live header keeps the original id, so
     anything outside still resolves to the real control. */
  function rewriteRefs(root, oldId, newId) {
    var i, j, el, v;

    for (i = 0; i < ID_REF_ATTRS.length; i++) {
      var attr = ID_REF_ATTRS[i];
      var hits = root.querySelectorAll('[' + attr + ']');
      for (j = 0; j < hits.length; j++) {
        el = hits[j];
        v = el.getAttribute(attr);
        if (!v) continue;
        // headers/aria-labelledby can hold a space-separated id list.
        var parts = v.split(/\s+/);
        var changed = false;
        for (var k = 0; k < parts.length; k++) {
          if (parts[k] === oldId) { parts[k] = newId; changed = true; }
        }
        if (changed) el.setAttribute(attr, parts.join(' '));
      }
    }

    /* href="#id" and xlink:href="#id" */
    var anchors = root.querySelectorAll('[href], [*|href]');
    for (j = 0; j < anchors.length; j++) {
      el = anchors[j];
      v = el.getAttribute('href');
      if (v === '#' + oldId) el.setAttribute('href', '#' + newId);
      v = el.getAttribute('xlink:href');
      if (v === '#' + oldId) el.setAttribute('xlink:href', '#' + newId);
    }

    /* url(#id) inside paint and geometry attributes, and inline style. */
    var urlRe = new RegExp('url\\((["\']?)#' + escapeRe(oldId) + '\\1\\)', 'g');
    for (i = 0; i < URL_REF_ATTRS.length; i++) {
      var uattr = URL_REF_ATTRS[i];
      var uhits = root.querySelectorAll('[' + uattr + ']');
      for (j = 0; j < uhits.length; j++) {
        el = uhits[j];
        v = el.getAttribute(uattr);
        if (v && v.indexOf('#' + oldId) !== -1) {
          el.setAttribute(uattr, v.replace(urlRe, 'url($1#' + newId + '$1)'));
        }
      }
    }

    /* <style> blocks carried inside a cloned svg. */
    var styles = root.querySelectorAll('style');
    for (j = 0; j < styles.length; j++) {
      var t = styles[j].textContent;
      if (t && t.indexOf('#' + oldId) !== -1) {
        styles[j].textContent = t
          .replace(urlRe, 'url($1#' + newId + '$1)')
          .replace(new RegExp('#' + escapeRe(oldId) + '\\b', 'g'), '#' + newId);
      }
    }
  }

  var counter = 0;

  function scope(spacer) {
    if (!spacer || spacer.getAttribute(DONE) === '1') return;
    spacer.setAttribute(DONE, '1');

    /* Decorative placeholder.
       aria-hidden ALONE WAS A MISTAKE AND AXE CAUGHT IT. The first version set
       only aria-hidden="true" here, reasoning that visibility:hidden already
       removed the subtree from the a11y tree so the attribute was free. It is
       not free: aria-hidden on a container that still holds focusable children
       is itself a WCAG violation (axe "aria-hidden-focus", serious), and this
       spacer holds 32 of them — a whole cloned header. Measured once the age
       gate stopped blocking axe from running at all.

       inert is the correct pairing: it removes the subtree from the a11y tree
       AND makes every descendant non-focusable, so the two states agree.
       Browsers without inert still have visibility:hidden doing the work, and
       the explicit tabindex fallback below covers the focus half for them. */
    spacer.setAttribute('aria-hidden', 'true');
    if ('inert' in HTMLElement.prototype) {
      spacer.inert = true;
    } else {
      var foc = spacer.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      for (var f = 0; f < foc.length; f++) {
        if (!foc[f].hasAttribute('data-nf-tab-was')) {
          foc[f].setAttribute('data-nf-tab-was', foc[f].getAttribute('tabindex') || '');
        }
        foc[f].setAttribute('tabindex', '-1');
      }
    }

    var withIds = spacer.querySelectorAll('[id]');
    if (spacer.id) {
      // The spacer itself can carry the cloned container's id.
      var own = spacer.id;
      spacer.id = PREFIX + (counter++) + '-' + own;
    }
    for (var i = 0; i < withIds.length; i++) {
      var el = withIds[i];
      var oldId = el.id;
      if (!oldId || oldId.indexOf(PREFIX) === 0) continue;
      var newId = PREFIX + (counter++) + '-' + oldId;
      el.id = newId;
      rewriteRefs(spacer, oldId, newId);
    }
  }

  function sweep() {
    var spacers = document.querySelectorAll('.elementor-sticky__spacer');
    for (var i = 0; i < spacers.length; i++) scope(spacers[i]);
  }

  /* requestAnimationFrame must be called with `this` === window. Pulling it out
     of the object -- `(window.requestAnimationFrame || window.setTimeout)(fn)` --
     calls it unbound and throws "Illegal invocation" in Chrome, which inside a
     MutationObserver callback would kill the re-sweep silently. Wrap, don't
     extract. */
  var schedule = window.requestAnimationFrame
    ? function (fn) { window.requestAnimationFrame(fn); }
    : function (fn) { window.setTimeout(fn, 16); };

  function start() {
    sweep();
    if (!('MutationObserver' in window)) return;
    var pending = false;
    var mo = new MutationObserver(function (records) {
      /* Cheap guard: only re-sweep when a node was actually added. */
      for (var i = 0; i < records.length; i++) {
        if (records[i].addedNodes && records[i].addedNodes.length) {
          if (pending) return;
          pending = true;
          schedule(function () {
            pending = false;
            sweep();
          });
          return;
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  /* Elementor initialises sticky on window load in some paths. */
  window.addEventListener('load', function () { setTimeout(sweep, 80); });
  window.addEventListener('resize', function () { setTimeout(sweep, 200); });
})();
