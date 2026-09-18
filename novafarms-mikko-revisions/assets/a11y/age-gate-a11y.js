/*!
 * Nova Farms — age-gate accessibility repair
 * ---------------------------------------------------------------------------
 * Fixes three verified WCAG 2.1 AA failures on the age-verification popup
 * (Elementor popup id 6871), which ships on all 46 pages of this site.
 *
 *   WCAG 2.1.2 No Keyboard Trap (A)   — the gate is a HARD keyboard trap.
 *   WCAG 2.4.3 Focus Order (A)        — focus never enters the dialog, is
 *                                       never restored, and the page behind it
 *                                       stays fully reachable by keyboard/AT.
 *   WCAG 4.1.2 Name, Role, Value (A)  — the dialog is exposed as
 *                                       role="document" carrying aria-modal,
 *                                       an invalid pairing, with no name.
 *
 * ROOT CAUSE (measured, not assumed)
 * ----------------------------------
 * The site's own inline gate script activates a step 200ms AFTER the popup
 * opens:
 *
 *     jQuery(document).on("elementor/popup/show", function (e, id) {
 *       if (id === 6871) setTimeout(initializePopupLogic, 200);
 *     });
 *
 * The gate's CSS hides every step until one is activated:
 *
 *     #elementor-popup-modal-6871 .step        { display:none !important; }
 *     #elementor-popup-modal-6871 .step.active { display:flex !important; }
 *
 * No step carries `active` in the static HTML (verified across all 46 pages),
 * so at the instant Elementor Pro's ModalKeyboardHandler measures the dialog
 * it finds ZERO focusable children. It then takes its null branch — stamping
 * tabindex="0" on the popup wrapper and cancelling every subsequent Tab
 * keypress window-wide. Escape is disabled by the popup's own settings and the
 * close button is display:none, so there is no way out.
 *
 * Measured before this fix: 3 Tab presses produced 0 focusin events; focus
 * stayed pinned to the wrapper div and "Yes I am" was unreachable.
 * Measured after clearing that one attribute: 2 Tabs reached noButton, then
 * yesButton.
 *
 * WHAT THIS FILE DOES
 * -------------------
 *  1. Activates the correct step IMMEDIATELY on popup show, so focusable
 *     children exist before Elementor measures — preventing the trap at its
 *     source rather than papering over it.
 *  2. Defensively clears the tabindex stamp if applied anyway (ordering
 *     between our listener and Elementor's is not guaranteed).
 *  3. Repairs dialog semantics: role="dialog" + aria-modal + an accessible
 *     name that tracks the current step.
 *  4. Moves focus into the dialog, contains it while open, and restores focus
 *     to the previously focused element on close.
 *  5. Marks the rest of the page inert + aria-hidden while the gate is open,
 *     so screen readers cannot browse the page behind a blocking overlay.
 *
 * DESIGN CONSTRAINT: this must keep working when the state-selector and
 * store-list steps (step2 / step3*) move out of the modal onto a real page.
 * It therefore never assumes any step beyond step1 exists.
 *
 * The age gate is a legal requirement for cannabis retail and is NOT removed
 * or bypassed here. Containing focus inside a modal the user must answer is
 * the expected pattern; the 2.1.2 failure was that the controls could not be
 * REACHED, not that focus was contained.
 *
 * No dependencies. Safe to load twice. Reversible: delete this file and its
 * one <script> tag per page.
 */
(function () {
  'use strict';

  var POPUP_ID  = 6871;
  var MODAL_SEL = '#elementor-popup-modal-' + POPUP_ID;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
                  'select:not([disabled]),textarea:not([disabled]),summary,' +
                  '[tabindex]:not([tabindex="-1"])';

  // Accessible names per step. Unknown steps fall back to a generic name so
  // this keeps working if steps are added, renamed, or moved to a page.
  var STEP_LABELS = {
    step1: 'Age verification',
    step2: 'Choose your state',
    step3Massachusetts: 'Choose a Massachusetts store',
    step3NewJersey:     'Choose a New Jersey store',
    step3Connecticut:   'Choose a Connecticut store',
    step3Maine:         'Choose a Maine store',
    step3RhodeIsland:   'Rhode Island'
  };

  var lastFocusedBeforeOpen = null;
  var backgroundHidden      = [];
  var isOpen                = false;
  var observer              = null;

  function modal() { return document.querySelector(MODAL_SEL); }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? m[1] : null;
  }

  function isVisible(el) {
    if (!el) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  function activeStep() {
    var m = modal();
    return m ? m.querySelector('.step.active') : null;
  }

  function focusablesIn(root) {
    if (!root) return [];
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), isVisible);
  }

  /* ------------------------------------------------------------------
   * 1. Activate a step immediately so focusables exist before Elementor
   *    measures. This is the actual root-cause repair. Mirrors the site's
   *    own selection logic exactly.
   * --------------------------------------------------------------- */
  function ensureActiveStep() {
    var m = modal();
    if (!m) return;
    if (m.querySelector('.step.active')) return; // site logic already ran

    var step1 = m.querySelector('#step1');
    var step2 = m.querySelector('#step2');
    var target = (getCookie('ageVerified') === 'true' && step2) ? step2 : step1;

    // If step1 was moved out of the modal, fall back to whatever step remains,
    // so the dialog is never left with zero focusable children.
    if (!target) target = m.querySelector('.step');
    if (target) target.classList.add('active');
  }

  /* ------------------------------------------------------------------
   * 2 + 3. Clear the trap stamp and repair dialog semantics.
   * --------------------------------------------------------------- */
  function repairSemantics() {
    var m = modal();
    if (!m) return;

    // role="document" + aria-modal is invalid; aria-modal is only honoured on
    // dialog/alertdialog. Screen readers were not treating this as modal.
    if (m.getAttribute('role') !== 'dialog') m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');

    var step = activeStep();
    var label = (step && STEP_LABELS[step.id]) || 'Age verification';
    m.setAttribute('aria-label', label);

    // Programmatically focusable, but never a phantom tab stop.
    if (m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1');

    // Remove the null-branch stamp wherever Elementor put it. Both the outer
    // modal and the inner .elementor-<id> wrapper have been observed carrying
    // it, so clear any non-interactive div holding tabindex="0".
    var stamped = m.querySelectorAll('div[tabindex="0"]');
    Array.prototype.forEach.call(stamped, function (el) {
      el.removeAttribute('tabindex');
    });
  }

  /* ------------------------------------------------------------------
   * 5. Hide the rest of the page from AT while the gate is open.
   * --------------------------------------------------------------- */
  function hideBackground() {
    var m = modal();
    if (!m) return;
    backgroundHidden = [];
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === m || el.contains(m)) return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
      // The accessibility trigger stays reachable while the gate is up. Owner's
      // locked decision, and the reason for it: someone who needs bigger text or
      // a dyslexia-friendly face needs those to read the gate ITSELF. Making the
      // help unreachable until you are past the barrier is the catch-22 this
      // whole revision exists to remove.
      if (el.hasAttribute('data-a11y-exempt')) return;
      if (el.hasAttribute('aria-hidden') || el.hasAttribute('inert')) return;
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
      backgroundHidden.push(el);
    });
  }

  function restoreBackground() {
    backgroundHidden.forEach(function (el) {
      el.removeAttribute('aria-hidden');
      el.removeAttribute('inert');
    });
    backgroundHidden = [];
  }

  /* ------------------------------------------------------------------
   * 4. Move focus in, and keep it in, while the gate is open.
   * --------------------------------------------------------------- */
  function focusFirst() {
    var items = focusablesIn(activeStep());
    if (!items.length) items = focusablesIn(modal());
    if (items.length) {
      items[0].focus();
      return true;
    }
    // Nothing focusable at all — focus the dialog itself so the user is at
    // least inside it and its name is announced.
    var m = modal();
    if (m) { m.setAttribute('tabindex', '-1'); m.focus(); }
    return false;
  }

  // Capture phase, so this runs before Elementor's window-level Tab handler,
  // which cancels Tab while it believes the dialog has no focusable children.
  // The accessibility panel runs its own focus trap. While it is open this one
  // must stand down completely: the panel inerts the gate modal when it opens,
  // and a .focus() call into an inert subtree fails SILENTLY -- the branch below
  // would then preventDefault every Tab and move focus nowhere, freezing the
  // keyboard entirely. Measured: six consecutive Tabs all reported the panel's
  // close button, defaultPrevented true each time.
  function panelIsOpen() {
    var p = document.querySelector('.a11y-panel');
    return !!(p && !p.hasAttribute('hidden') && isVisible(p));
  }

  function onKeydown(e) {
    if (!isOpen || e.key !== 'Tab') return;
    if (panelIsOpen()) return;
    var m = modal();
    if (!m || !isVisible(m)) return;

    var items = focusablesIn(activeStep());
    if (!items.length) items = focusablesIn(m);

    // The owner's locked decision is that the accessibility button stays
    // reachable WHILE the gate is open -- someone who needs larger type or a
    // dyslexia-friendly face needs it to read the gate itself. It was already
    // exempt from the inert pass and clickable, but it sat OUTSIDE this cycle,
    // so a keyboard user never reached it: 45 Tab presses only ever visited the
    // two age buttons. Appending it puts it at the end of the cycle.
    var trigger = document.querySelector('.a11y-trigger');
    if (trigger && isVisible(trigger)) items = items.concat([trigger]);

    if (!items.length) return;

    var first = items[0];
    var last  = items[items.length - 1];
    var here  = document.activeElement;

    // Drive the move ourselves so behaviour is deterministic regardless of
    // what Elementor's handler does with this same event.
    if (!m.contains(here)) {
      e.preventDefault();
      first.focus();
      return;
    }
    if (e.shiftKey && here === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && here === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------
   * Re-apply when the visible step changes (state click, back, etc.)
   * --------------------------------------------------------------- */
  function watchStepChanges() {
    var m = modal();
    if (!m || observer) return;
    var pending = false;
    observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        if (!isOpen) return;
        repairSemantics();
        var step = activeStep();
        if (step && !step.contains(document.activeElement)) focusFirst();
      });
    });
    observer.observe(m, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocusedBeforeOpen =
      (document.activeElement && document.activeElement !== document.body)
        ? document.activeElement : null;

    ensureActiveStep();
    repairSemantics();
    hideBackground();
    watchStepChanges();

    // One frame later, after Elementor's own focus handling, take ownership of
    // focus and clear any stamp it applied after us.
    window.requestAnimationFrame(function () {
      repairSemantics();
      focusFirst();
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (observer) { observer.disconnect(); observer = null; }
    restoreBackground();
    if (lastFocusedBeforeOpen && document.contains(lastFocusedBeforeOpen)) {
      try { lastFocusedBeforeOpen.focus(); } catch (e) {}
    }
    lastFocusedBeforeOpen = null;
  }

  /* ------------------------------------------------------------------
   * Wiring. Prefer Elementor's hooks; fall back to observing the DOM so this
   * still works if jQuery or Elementor Pro is unavailable.
   * --------------------------------------------------------------- */
  document.addEventListener('keydown', onKeydown, true);

  function bindElementorHooks() {
    if (typeof window.jQuery !== 'function') return false;
    window.jQuery(document).on('elementor/popup/show', function (event, id) {
      if (id === POPUP_ID) open();
    });
    window.jQuery(document).on('elementor/popup/hide', function (event, id) {
      if (id === POPUP_ID) close();
    });
    return true;
  }

  function watchForModal() {
    var mo = new MutationObserver(function () {
      var m = modal();
      var visible = !!m && isVisible(m);
      if (visible && !isOpen) open();
      else if (!visible && isOpen) close();
    });
    mo.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
    });
  }

  function init() {
    bindElementorHooks();
    watchForModal();
    // If the gate is already on screen by the time we run, handle it now.
    if (modal() && isVisible(modal())) open();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
