/* =============================================================================
   aria-repair.js — three ARIA defects axe found once it could finally run.

   WHY THESE ONLY SURFACED NOW

   Every earlier scan was blocked by the age gate, so axe-core never executed:
   A11Y-001 read 0 on six consecutive runs. With the gate suppressed the page
   became reachable and axe reported 9 violations on its first real pass. The
   score DROPPED (61 -> 59) because the scanner could finally see the site —
   these defects were always here, just unmeasured.

   All three are in third-party markup (Elementor + Swiper), generated at
   runtime, so they are repaired at runtime rather than by editing 48 pages.

   ---------------------------------------------------------------------------
   1. aria-hidden-focus  (serious — 7 of the 9 findings)

   A container marked aria-hidden="true" that still contains focusable children
   is a contradiction: screen readers are told to ignore it, but Tab still lands
   inside it. Measured on this page, 21 such containers — Swiper's inactive
   slides, Elementor's collapsed nav dropdowns, and the ticker's off-screen
   headlines. Some already carried tabindex="-1"; many did not.

   inert is the correct pairing for aria-hidden: it removes the subtree from the
   a11y tree AND makes it unfocusable, so the two states cannot disagree. This
   keeps them in sync as Swiper flips aria-hidden from slide to slide, which is
   why it is an observer and not a one-shot.

   NOTE: it deliberately does NOT touch an aria-hidden element that is neither
   focusable itself nor holds a focusable descendant — there is nothing wrong
   with those, and inert-ing them would be noise.

   ---------------------------------------------------------------------------
   2. aria-required-children  (critical)

   .elementor-loop-container carries role="list", but its slides carry
   role="group" — Swiper's own carousel semantics, with "1 / 18" labels. A
   role="list" must contain role="listitem", so the two patterns contradict.

   The list role is the one that is wrong here: this is a carousel of grouped
   cards, not a list, and Swiper's group roles are the accurate description. So
   the list role is removed rather than forcing listitem onto the slides, which
   would fight Swiper and lose its position labels.

   ---------------------------------------------------------------------------
   3. aria-valid-attr-value  (critical)

   .e-floating-bars__close-button has aria-controls="e-floating-bars", and no
   element on the page has that id — verified, getElementById returns null. The
   reference is dangling, so assistive tech cannot follow it.

   The intended target is obvious (the bar the button closes), so the id is put
   on it rather than dropping the attribute. That keeps the relationship the
   markup was clearly reaching for.
   ============================================================================= */
(function () {
  'use strict';

  var FOCUSABLE = 'a[href],button,input,select,textarea,iframe,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
  var SUPPORTS_INERT = 'inert' in HTMLElement.prototype;

  /* --- 1. keep inert in sync with aria-hidden ----------------------------- */
  function syncHidden(root) {
    var scope = (root && root.querySelectorAll) ? root : document;

    var hidden = scope.querySelectorAll('[aria-hidden="true"]');
    for (var i = 0; i < hidden.length; i++) {
      var el = hidden[i];
      // Nested inside an already-inert ancestor? Nothing to do.
      if (el.closest && el.closest('[data-nf-inert="1"]') && el.getAttribute('data-nf-inert') !== '1') continue;

      /* SELF, not just descendants. The first version asked only
         `el.querySelector(FOCUSABLE)` and therefore skipped the commonest shape
         of this defect: an element that IS the focusable thing and is itself
         aria-hidden. The ticker is exactly that —
         <a class="e-floating-bars__headline" aria-hidden="true" href="...">,
         focusable, with no focusable descendants — and axe still reported six of
         them after the first pass because of this. */
      var selfFocusable = el.matches && el.matches(FOCUSABLE);
      if (!selfFocusable && !el.querySelector(FOCUSABLE)) continue;
      if (el.getAttribute('data-nf-inert') === '1') continue;

      el.setAttribute('data-nf-inert', '1');
      if (SUPPORTS_INERT) {
        el.inert = true;
      } else {
        var targets = [];
        if (selfFocusable) targets.push(el);
        var f = el.querySelectorAll(FOCUSABLE);
        for (var j = 0; j < f.length; j++) targets.push(f[j]);
        for (var t = 0; t < targets.length; t++) {
          if (!targets[t].hasAttribute('data-nf-tab-was')) {
            targets[t].setAttribute('data-nf-tab-was', targets[t].getAttribute('tabindex') || '');
          }
          targets[t].setAttribute('tabindex', '-1');
        }
      }
    }

    /* The other direction matters just as much: when Swiper makes a slide
       active it REMOVES aria-hidden, and that slide's links must become
       reachable again or the carousel becomes a keyboard trap in reverse. */
    var released = scope.querySelectorAll('[data-nf-inert="1"]');
    for (var k = 0; k < released.length; k++) {
      var r = released[k];
      if (r.getAttribute('aria-hidden') === 'true') continue;
      r.removeAttribute('data-nf-inert');
      if (SUPPORTS_INERT) {
        r.inert = false;
      } else {
        var was = [].slice.call(r.querySelectorAll('[data-nf-tab-was]'));
        if (r.hasAttribute('data-nf-tab-was')) was.push(r);
        for (var m = 0; m < was.length; m++) {
          var prev = was[m].getAttribute('data-nf-tab-was');
          if (prev) was[m].setAttribute('tabindex', prev);
          else was[m].removeAttribute('tabindex');
          was[m].removeAttribute('data-nf-tab-was');
        }
      }
    }
  }

  /* --- 2. the carousel is not a list -------------------------------------- */
  function fixLoopRole() {
    var lists = document.querySelectorAll('.elementor-loop-container[role="list"]');
    for (var i = 0; i < lists.length; i++) {
      // Only strip it when the children really are not listitems — if a future
      // Elementor build emits proper listitems, leave its markup alone.
      if (lists[i].querySelector('[role="listitem"]')) continue;
      lists[i].removeAttribute('role');
      lists[i].setAttribute('data-nf-role-removed', 'list');
    }
  }

  /* --- 3. make aria-controls resolve -------------------------------------- */
  function fixDanglingControls() {
    var btns = document.querySelectorAll('[aria-controls]');
    for (var i = 0; i < btns.length; i++) {
      var want = (btns[i].getAttribute('aria-controls') || '').trim();
      if (!want || document.getElementById(want)) continue;   // already resolves

      // Only repair the case we understand: the floating bar's close button.
      if (want === 'e-floating-bars') {
        var bar = btns[i].closest('.e-floating-bars') ||
                  document.querySelector('.e-floating-bars');
        if (bar && !bar.id) {
          bar.id = want;
          bar.setAttribute('data-nf-id-added', '1');
        }
      }
    }
  }

  /* --- 4. a <ul role="group"> is not a list, so its <li> are orphaned -------
     Same defect as the two this project owned and has now fixed at source
     (deals.js, category-icons.js): a role on a <ul> REPLACES its implicit list
     role, and every <li> inside becomes an orphan (axe "listitem", serious).
     Elementor does it to its nav dropdowns — 20 items on a location page — and
     that markup is generated, so it is corrected here instead.

     Only 'group' is removed, and only from a <ul>/<ol> that actually holds <li>
     children. A deliberate role on a <div>, or a <ul> genuinely used as
     something that is not a list, is left alone. */
  function fixListRoles() {
    var lists = document.querySelectorAll('ul[role="group"],ol[role="group"]');
    for (var i = 0; i < lists.length; i++) {
      var hasLi = false, kids = lists[i].children;
      for (var c = 0; c < kids.length; c++) { if (kids[c].tagName === 'LI') { hasLi = true; break; } }
      if (!hasLi) continue;
      lists[i].removeAttribute('role');
      lists[i].setAttribute('data-nf-role-removed', 'group');
    }
  }

  /* --- 5. iframes need an accessible name -----------------------------------
     Three on a location page, all lazy-loaded embeds whose src is still
     about:blank when axe runs, so there is nothing for a reader to announce.
     The title is derived from the REAL destination (data-lazy-src) where there
     is one, and falls back to a generic label rather than inventing specifics. */
  function fixFrameTitles() {
    var frames = document.querySelectorAll('iframe:not([title])');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var src = f.getAttribute('data-lazy-src') || f.getAttribute('src') || '';
      var label = 'Embedded content';
      if (/youtube|youtu\.be|vimeo/i.test(src)) label = 'Embedded video';
      else if (/google\.[a-z.]+\/maps|maps\.google|\/maps\//i.test(src)) label = 'Map';
      else if (/recaptcha/i.test(src)) label = 'reCAPTCHA verification';
      f.setAttribute('title', label);
      f.setAttribute('data-nf-title-added', '1');
    }
  }

  /* --- 6. mark real keyboard navigation --------------------------------------
     Elementor focuses the floating bar on load (FloatingBarsHandler.focusOnLoad,
     confirmed from the call stack), and PROGRAMMATIC focus matches
     :focus-visible exactly as keyboard focus does — so a mouse user was shown a
     focus ring around the ticker before touching anything, and its bottom edge
     read as a stray green line under the band.

     a11y-base.css suppresses that ring only while this flag is absent. The
     first Tab sets it, and from then on the ring behaves normally for the bar
     and for everything else — a keyboard user tabbing to the ticker still gets
     a ring. Elementor keeps its announcement focus either way.

     Tab only, deliberately: it is the focus-navigation key, so typing into a
     form field does not flip the page into "keyboard mode". Shift+Tab is Tab. */
  function markKeyboard(e) {
    if (e.key !== 'Tab') return;
    document.documentElement.setAttribute('data-nf-kbd', '');
    window.removeEventListener('keydown', markKeyboard, true);
  }
  window.addEventListener('keydown', markKeyboard, true);

  function run() {
    try { fixLoopRole(); } catch (e) {}
    try { fixListRoles(); } catch (e) {}
    try { fixFrameTitles(); } catch (e) {}
    try { fixDanglingControls(); } catch (e) {}
    try { syncHidden(document); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.addEventListener('load', function () { setTimeout(run, 120); });

  /* Swiper flips aria-hidden as slides move, and Elementor builds its dropdowns
     late, so this has to keep watching. Coalesced to one pass per frame. */
  if ('MutationObserver' in window) {
    var pending = false;
    var schedule = window.requestAnimationFrame
      ? function (fn) { window.requestAnimationFrame(fn); }
      : function (fn) { window.setTimeout(fn, 16); };

    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      schedule(function () { pending = false; run(); });
    }).observe(document.documentElement, {
      subtree: true, childList: true,
      attributes: true, attributeFilter: ['aria-hidden', 'role', 'aria-controls', 'title'],
    });
  }
})();
