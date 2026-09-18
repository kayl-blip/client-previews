/* =============================================================================
   gate-disabled-preview.js — SUPPRESSES THE AGE GATE ON THIS PREVIEW.

   ┌───────────────────────────────────────────────────────────────────────┐
   │  THIS MUST BE REMOVED BEFORE THE SITE GOES LIVE ANYWHERE PUBLIC.      │
   │  Delete the one <script> line that loads it — that is the whole       │
   │  revert. Nothing in the age gate's own code was changed.              │
   └───────────────────────────────────────────────────────────────────────┘

   OWNER CALL 2026-09-16: "we can disable that for now since sgen will have an
   age gate so that's really not needed for now."

   WHY IT EXISTS

   Every QA scan so far measured the site THROUGH the closed gate — the tool's
   own CON-003 finding says the overlay covered 100% of the viewport and could
   not be auto-dismissed, so "findings + screenshots for this page reflect the
   gated view". That distorted six separate rules: contrast readings were taken
   against the overlay, the DOM count included the gate's markup, and every
   screenshot showed the gate rather than the page.

   HOW IT WORKS — the gate's own early-out, not a hack around it

   attemptToShowPopup() already begins:

       if (isPopupExcluded())  return;
       if (hasSeenPopup())     return;          // reads the popupShown cookie
       if (sessionStorage.getItem("popupClosedThisSession") === "true") return;

   So this sets those two flags before the gate runs. The gate then declines to
   open BY ITS OWN RULE, on its own code path, with its own debug line. Nothing
   is overridden, monkey-patched or raced.

   WHAT THIS DOES NOT DO

   - It does NOT remove the age gate. The markup and its script are still on the
     page; the popup simply never opens. Deleting the script tag restores it in
     full, for every visitor, immediately.
   - It does NOT make jQuery deferrable. The gate's ~8.6KB inline script still
     loads and still needs jQuery synchronously, and so do two other inline
     blocks. PERF-005 is unaffected by this file.
   - It does NOT verify anyone's age. If this preview is ever shared beyond the
     team, the gate must come back first.
   ============================================================================= */
(function () {
  'use strict';

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + '=' + value + '; path=/; expires=' + d.toUTCString();
  }

  try {
    // 7 days matches what the gate itself writes, so nothing here behaves
    // differently from a visitor who has already seen and closed it.
    setCookie('popupShown', 'true', 7);
  } catch (e) { /* cookies blocked — the sessionStorage flag below still applies */ }

  try {
    window.sessionStorage.setItem('popupClosedThisSession', 'true');
  } catch (e) { /* private mode */ }

  // Belt and braces: if the popup was already opened by the time this ran (the
  // gate initialises on the popup module's ready event, which can land early),
  // close it through the site's own helper rather than hiding it with CSS.
  function closeIfOpen() {
    if (typeof window.closeAgeGatePopup === 'function') {
      try { window.closeAgeGatePopup(); return; } catch (e) {}
    }
    var open = document.querySelector('.dialog-widget.dialog-lightbox-widget');
    if (open && open.style) open.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', closeIfOpen);
  } else {
    closeIfOpen();
  }
  window.addEventListener('load', function () { setTimeout(closeIfOpen, 80); });
})();
