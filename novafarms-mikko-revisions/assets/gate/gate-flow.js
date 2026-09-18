/* =============================================================================
   gate-flow.js — stop the age gate re-asking for a store you already picked.

   THE LOOP THIS FIXES

   The gate's own logic is:

       if (getCookie("ageVerified") === "true") { showStep(steps.step2); }

   so once age is verified, EVERY page load reopens the popup at step 2, the
   state picker. On the live site that is invisible because isPopupExcluded()
   matches on pathname -- "/shop", "/locations" -- and suppresses it. This
   clone is FLAT (attleboro-ma.html, not /locations/attleboro-ma/), so none of
   those branches ever match and the picker comes back on every navigation.

   It only became visible once the store buttons actually went somewhere:
   pick a store -> land on its page -> get asked to pick a state again.

   THE FIX, using the gate's own guard rather than fighting it

   attemptToShowPopup() already skips when hasSeenPopup() is true, which reads
   the popupShown cookie. So: once a visitor has verified their age AND we know
   which store they mean, set that cookie. The gate then suppresses itself, by
   its own rule, with no change to its code.

   "We know which store they mean" is either of:
     - they clicked a control that resolves to a store (data-nf-was carries the
       slug), or
     - the page they are on IS a store's page (NovaStores.ofThisPage()).

   Age is never skipped. popupShown is only ever set once ageVerified is
   already true, so a first-time visitor still meets the age step.
   ============================================================================= */
(function () {
  'use strict';

  var SLUG = /novafarms\.com\/(?:stores\/[a-z]{2}|shop)\/([a-z-]+)/i;

  function getCookie(name) {
    var v = '; ' + document.cookie;
    var parts = v.split('; ' + name + '=');
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + '=' + value + '; path=/; expires=' + d.toUTCString();
  }

  function ageVerified() { return getCookie('ageVerified') === 'true'; }

  function remember(slug) {
    if (!slug || !window.NovaStores) return;
    try { window.NovaStores.select(slug.toLowerCase()); } catch (e) { /* private mode */ }
  }

  // Only ever called behind an ageVerified check.
  function stopAsking() {
    setCookie('popupShown', 'true', 7);
    try { window.sessionStorage.setItem('popupClosedThisSession', 'true'); } catch (e) {}
  }

  function closeIfOpen() {
    if (typeof window.closeAgeGatePopup === 'function') {
      try { window.closeAgeGatePopup(); return; } catch (e) {}
    }
    // Fallback: the popup is an Elementor modal; hide the open one directly.
    var open = document.querySelector('.dialog-widget.dialog-lightbox-widget');
    if (open) open.style.display = 'none';
  }

  /* --- 1. a store control was used: remember it, and stop asking ----------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var el = t && t.closest ? t.closest('[data-nf-menu="local"]') : null;
    if (!el) return;
    var was = el.getAttribute('data-nf-was') || '';
    var m = SLUG.exec(was);
    if (m) remember(m[1]);
    if (ageVerified()) stopAsking();
  }, true);

  /* --- 2. the store finder is a <select>, so clicks do not describe it ----- */
  var finder = document.getElementById('stores');
  if (finder) {
    finder.addEventListener('change', function () {
      var opt = finder.options[finder.selectedIndex];
      if (!opt) return;
      var m = SLUG.exec(opt.getAttribute('data-nf-was') || '');
      if (m) remember(m[1]);
      if (ageVerified()) stopAsking();
    });
  }

  /* --- 3. already on a store's page, or already chose one: do not re-ask --- */
  function settle() {
    if (!ageVerified()) return;                 // age is never skipped
    var known = null;
    if (window.NovaStores) {
      try { known = window.NovaStores.ofThisPage() || window.NovaStores.selected(); } catch (e) {}
    }
    if (!known) return;                          // no store yet: the picker is correct
    stopAsking();
    closeIfOpen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settle);
  } else {
    settle();
  }
  // The gate opens on load, after DOMContentLoaded in some paths.
  window.addEventListener('load', function () { setTimeout(settle, 60); });
})();
