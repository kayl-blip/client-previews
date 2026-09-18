/* =============================================================================
   a11y-panel.js — revision 1 Phase C.

   Five settings plus cookie consent, in one dialog. Settings persist and are
   re-applied by the inline snippet in <head> before first paint; this file owns
   the UI and the two settings that need measurement rather than CSS.

   Built last, deliberately, so it can be tested against the finished nav,
   location template and brands page rather than against a moving target.
   ============================================================================= */
(function () {
  'use strict';

  var KEY = 'novafarms:a11y';
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
                  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  var panel = null, box = null, trigger = null, lastFocused = null, inerted = [];

  /* ------------------------------------------------------------- settings */
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  // The CSS-only settings are just attributes on <html>. The two that need to
  // measure the page (text scale, high contrast) are applied in JS below.
  function apply(s) {
    var r = document.documentElement;
    s.font   ? r.setAttribute('data-a11y-font', 'atkinson') : r.removeAttribute('data-a11y-font');
    s.cues   ? r.setAttribute('data-a11y-cues', 'on')       : r.removeAttribute('data-a11y-cues');
    s.motion ? r.setAttribute('data-a11y-motion', 'off')    : r.removeAttribute('data-a11y-motion');
    applyScale(s.scale || 0);
    applyContrast(!!s.contrast);
    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  /* --------------------------------------------------------- text scaling */
  // This site sizes type in px almost everywhere, so raising the root font-size
  // moves nothing. Instead each text element's computed size is read once,
  // remembered, and re-applied scaled. Reverting restores the original exactly
  // rather than guessing at it.
  var SCALES = [1, 1.15, 1.3];

  function textNodes() {
    return Array.prototype.filter.call(
      document.querySelectorAll('body *:not(script):not(style):not(.a11y-panel):not(.a11y-panel *):not(.a11y-trigger):not(.a11y-trigger *)'),
      function (el) {
        if (el.closest('.a11y-panel') || el.closest('.a11y-trigger')) return false;
        // exclude icon fonts: scaling those moves glyphs out of their boxes
        var c = (el.className || '').toString();
        if (/eicon|fa-|amelia|swiper-button|sr7/.test(c)) return false;

        // font-size:0 is how this site HIDES a glyph it has replaced with an
        // image. The review stars do exactly that: each <i> holds a literal
        // "\u2605" but is set to font-size 0, with the Nova star applied as a
        // background image (.custom-star-icon .elementor-star-rating i).
        // Scaling such an element resurrects the character on top of the image
        // -- two different stars in the same 24px box. Leave them alone.
        if (parseFloat(getComputedStyle(el).fontSize) === 0) return false;
        for (var i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3 && el.childNodes[i].nodeValue.trim()) return true;
        }
        return false;
      });
  }

  // Line-height has to scale with the type, not just the type.
  //
  // The bundle carries 627 px line-height declarations (the other 2,658 are
  // unitless and follow font-size on their own). Scaling font-size while a px
  // line-height stays fixed pushes glyphs into each other -- measured at 760px
  // wide, an element reached font-size 39px inside a line-height 20px box.
  // Unitless values are left alone precisely because they already track.
  function applyScale(step) {
    var factor = SCALES[step] || 1;
    var els = textNodes();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var cs = getComputedStyle(el);

      if (!el.hasAttribute('data-a11y-fs0')) {
        // NOT `|| 16`: parseFloat('0px') is 0, which is falsy, so a
        // deliberately hidden 0px glyph was being recorded as 16 and then
        // scaled into view. Guard NaN only.
        var fs0 = parseFloat(cs.fontSize);
        el.setAttribute('data-a11y-fs0', isNaN(fs0) ? 16 : fs0);
        // 'normal' computes to a used value in px but is not an authored px
        // line-height; scaling it would fight the browser's own metrics.
        var lhDeclared = el.style.lineHeight || '';
        var lh = parseFloat(cs.lineHeight);
        el.setAttribute('data-a11y-lh0', (isNaN(lh) || cs.lineHeight === 'normal') ? '' : lh);
      }

      var base = parseFloat(el.getAttribute('data-a11y-fs0'));
      var lh0  = el.getAttribute('data-a11y-lh0');

      // Optional per-element ceiling: data-a11y-fsmax="56".
      //
      // For display headings whose line breaks are part of the design. The
      // OPT-IN band's headline sits in a 385px column; at 1.30x it reaches
      // 62.4px, and "to POINTS" then needs 427.8px, so it drops to a fourth
      // line. The column cannot widen -- its container is only 405px -- so the
      // size is capped instead. Body copy is never capped; this is opt-in per
      // element and only ever applies to headings the owner has called out.
      var cap = parseFloat(el.getAttribute('data-a11y-fsmax'));

      if (factor === 1) {
        el.style.removeProperty('font-size');
        el.style.removeProperty('line-height');
      } else {
        var size = base * factor;
        if (!isNaN(cap) && size > cap) size = cap;
        el.style.setProperty('font-size', size.toFixed(1) + 'px', 'important');
        // Line-height follows the size actually used, not the uncapped one, or
        // a capped heading would sit in over-tall lines.
        if (lh0) {
          var lhFactor = base ? (size / base) : factor;
          el.style.setProperty('line-height', (parseFloat(lh0) * lhFactor).toFixed(1) + 'px', 'important');
        }
      }
    }
  }

  /* --------------------------------------------------------- high contrast */
  // Reuses the backdrop measurement a11y-base.js already does: rather than
  // inverting colours (which would wreck photographs and the brand), each piece
  // of text is pushed to black or white -- whichever its own painted backdrop
  // calls for. Backgrounds and images are untouched.
  // Deliberately NOT reimplemented here. a11y-base.js already measures the
  // painted backdrop, including the header scrim's ::before layer and alpha
  // compositing. A second copy in this file drifted from it and produced black
  // text on the navy scrim at 2.35:1. Use the one that knows about everything.
  function backdrop(el) {
    if (typeof window.a11yBackdrop !== 'function') return null;   // base absent
    var r = window.a11yBackdrop(el);
    // It returns {rgb, overImage}; over an image there is nothing to measure.
    return (!r || r.overImage) ? null : r.rgb;
  }
  function lum(rgb) {
    if (typeof window.a11yLuminance === 'function') return window.a11yLuminance(rgb);
    var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }

  function applyContrast(on) {
    var els = textNodes();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!on) { el.style.removeProperty('color'); el.removeAttribute('data-a11y-hc'); continue; }
      var bg = backdrop(el);
      if (!bg) continue;                       // over an image: leave it alone
      var target = lum(bg) > 0.4 ? '#000000' : '#FFFFFF';
      el.style.setProperty('color', target, 'important');
      el.setAttribute('data-a11y-hc', '1');
    }
  }

  /* --------------------------------------------------------------- consent
     Driving the plugin's own API was the right instinct — one source of truth
     beats a second, fake one — but it did not survive contact with this clone,
     and the failure was silent in the worst way.

     MEASURED on the built pages:
       window.pressidiumCookieConsent          EXISTS, with accept/get/run/set
       api.getConfig()                         null   <- never run()
       api.accept('all')                       THROWS TypeError:
                                               "Cannot read properties of
                                               undefined (reading
                                               'querySelectorAll')"

     The object is there because the plugin's script was cloned; the WordPress
     bootstrap that calls run(config) was not, so it has no config and no DOM
     of its own. accept() then throws while trying to update that DOM — and
     because the old handler called it unguarded, the throw aborted the handler
     BEFORE the line that refreshed the label. That is why clicking "Accept
     all" left the panel reading "No choice recorded yet": not one bug but two,
     an uninitialised plugin and an unguarded call that hid it.

     So: use the plugin when it is genuinely running, and otherwise keep our
     own record. On the client's live WordPress getConfig() returns a config,
     the plugin owns consent, and the fallback below never engages. */

  var STORE = 'nf_consent';

  function cc() { return window.pressidiumCookieConsent || null; }

  // "Present" is not the same as "running". Only a plugin with a config can
  // actually record anything, so that is the test — not typeof api.accept.
  function pluginLive() {
    var api = cc();
    if (!api || typeof api.getConfig !== 'function') return null;
    try { return api.getConfig() ? api : null; } catch (e) { return null; }
  }

  function readConsent() {
    // Cookie first: in the real world a consent record IS a cookie, and it is
    // the artifact a server would read. localStorage mirrors it for the case
    // where cookies are blocked but storage is not.
    try {
      var m = new RegExp('(?:^|; )' + STORE + '=([^;]*)').exec(document.cookie);
      if (m) return JSON.parse(decodeURIComponent(m[1]));
    } catch (e) { /* malformed or blocked */ }
    try {
      var v = window.localStorage.getItem(STORE);
      if (v) return JSON.parse(v);
    } catch (e) { /* private mode */ }
    return null;
  }

  function writeConsent(choice) {
    var rec = { choice: choice, at: new Date().toISOString() };
    var packed = encodeURIComponent(JSON.stringify(rec));
    try {
      document.cookie = STORE + '=' + packed +
        ';path=/;max-age=31536000;SameSite=Lax';
    } catch (e) { /* cookies blocked */ }
    try { window.localStorage.setItem(STORE, JSON.stringify(rec)); } catch (e) {}
    return rec;
  }

  // Returns the record so callers can reflect it. Never throws: a plugin that
  // blows up must not stop us recording the visitor's choice.
  function setConsent(choice) {
    var api = pluginLive();
    if (api) {
      try { api.accept(choice === 'all' ? 'all' : []); } catch (e) { /* logged below */ }
    }
    return writeConsent(choice);
  }

  function consentChoice() {
    var api = pluginLive();
    if (api) {
      try {
        var cats = api.get('categories');
        if (Array.isArray(cats)) return cats.length ? 'all' : 'necessary';
      } catch (e) {}
    }
    var rec = readConsent();
    return rec ? rec.choice : null;
  }

  function consentText() {
    var api = pluginLive();
    if (api) {
      try {
        var cats = api.get('categories');
        if (Array.isArray(cats)) {
          return cats.length ? 'Accepted: ' + cats.join(', ') + '.'
                             : 'Necessary cookies only.';
        }
      } catch (e) {}
    }
    var rec = readConsent();
    if (!rec) return 'No choice recorded yet.';
    var when = '';
    try {
      when = ', saved ' + new Date(rec.at).toLocaleDateString(undefined,
        { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {}
    return (rec.choice === 'all' ? 'All cookies accepted' : 'Necessary cookies only') +
           when + '. You can change this at any time.';
  }

  /* ------------------------------------------------------------------ UI */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function toggleRow(label, hint, key, s, onChange) {
    var b = el('button', 'a11y-switch');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(!!s[key]));
    var t = el('span');
    t.appendChild(el('span', 'a11y-switch__text', label));
    t.appendChild(el('span', 'a11y-switch__hint', hint));
    var track = el('span', 'a11y-switch__track');
    track.appendChild(el('span', 'a11y-switch__dot'));
    var word = el('span', null, s[key] ? 'On' : 'Off');
    track.appendChild(word);
    b.appendChild(t); b.appendChild(track);
    b.addEventListener('click', function () {
      s[key] = !s[key];
      b.setAttribute('aria-checked', String(!!s[key]));
      word.textContent = s[key] ? 'On' : 'Off';
      write(s); apply(s); onChange && onChange();
    });
    return b;
  }

  function build() {
    var s = read();

    panel = el('div', 'a11y-panel');
    panel.id = 'a11y-panel';
    panel.hidden = true;

    var scrim = el('div', 'a11y-panel__scrim');
    scrim.addEventListener('click', close);

    box = el('div', 'a11y-panel__box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Accessibility and cookie settings');

    var head = el('div', 'a11y-panel__head');
    head.appendChild(el('h2', 'a11y-panel__title', 'Accessibility'));
    var x = el('button', 'a11y-panel__close', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close accessibility settings');
    x.addEventListener('click', close);
    head.appendChild(x);
    box.appendChild(head);
    box.appendChild(el('p', 'a11y-panel__intro',
      'These settings are remembered on this device and apply across the whole site.'));

    /* --- text size --- */
    var g1 = el('div', 'a11y-group');
    g1.appendChild(el('h3', 'a11y-group__h', 'Text size'));
    var steps = el('div', 'a11y-steps');
    steps.setAttribute('role', 'group');
    steps.setAttribute('aria-label', 'Text size');
    ['Normal', 'Larger', 'Largest'].forEach(function (lbl, i) {
      var b = el('button', 'a11y-step', lbl);
      b.type = 'button';
      b.setAttribute('aria-pressed', String((s.scale || 0) === i));
      b.addEventListener('click', function () {
        s.scale = i; write(s); apply(s);
        Array.prototype.forEach.call(steps.children, function (c, j) {
          c.setAttribute('aria-pressed', String(i === j));
        });
      });
      steps.appendChild(b);
    });
    g1.appendChild(steps);
    box.appendChild(g1);

    /* --- the switches --- */
    var g2 = el('div', 'a11y-group');
    g2.appendChild(el('h3', 'a11y-group__h', 'Reading and motion'));
    g2.appendChild(toggleRow('High contrast', 'Black or white text, whichever reads better on each background', 'contrast', s));
    g2.appendChild(toggleRow('Dyslexia-friendly font', 'Atkinson Hyperlegible, with wider letter spacing', 'font', s));
    // Re-scoped from the brief's "colourblind-friendly palette", deliberately,
    // and labelled for what it does rather than what was asked for. See the
    // note rendered under this group and CLIENT-NOTES.md.
    g2.appendChild(toggleRow('Colour-independent mode',
      'Underlines every link and labels the licence badges, so nothing is signalled by colour alone', 'cues', s));
    g2.appendChild(toggleRow('Stop animations', 'Freezes the sliders, carousels and the scrolling bar', 'motion', s));
    g2.appendChild(el('p', 'a11y-note',
      'There is no colour-blindness filter here, on purpose. Nova Farms is green on ' +
      'navy, which stays distinguishable under the common colour deficiencies — ' +
      'a hue filter would alter every photograph and brand mark for no real gain. ' +
      'What does cause trouble is meaning carried by colour alone, so this turns ' +
      'that into text and underlines instead.'));
    box.appendChild(g2);

    /* --- consent --- */
    var g3 = el('div', 'a11y-group a11y-consent');
    g3.appendChild(el('h3', 'a11y-group__h', 'Cookies'));
    var state = el('p', 'a11y-consent__state', consentText());
    state.id = 'a11y-consent-state';
    g3.appendChild(state);

    // The choice is announced, not just repainted: a screen-reader user who
    // presses a button with no visible focus change otherwise gets nothing
    // back to confirm it worked.
    state.setAttribute('aria-live', 'polite');

    var actions = el('div', 'a11y-consent__actions');
    var acceptAll = el('button', 'a11y-btn a11y-btn--primary', 'Accept all');
    var nec = el('button', 'a11y-btn', 'Necessary only');
    acceptAll.type = 'button';
    nec.type = 'button';

    // Two buttons that express one setting, so they carry pressed state and
    // the current one reads as chosen rather than merely available.
    function paint() {
      var c = consentChoice();
      acceptAll.setAttribute('aria-pressed', String(c === 'all'));
      nec.setAttribute('aria-pressed', String(c === 'necessary'));
      state.textContent = consentText();
    }

    acceptAll.addEventListener('click', function () { setConsent('all'); paint(); });
    nec.addEventListener('click', function () { setConsent('necessary'); paint(); });
    paint();
    var more = el('button', 'a11y-btn', 'Choose by category');
    more.type = 'button';
    // This hands off to the cookie plugin's own category dialog. The plugin's
    // JS ships in this bundle but its UI is not always built -- calling
    // showSettings() then throws "Cannot read properties of undefined". The
    // original order closed THIS panel first and then threw, so the visitor was
    // left looking at nothing. Now the hand-off has to succeed before the panel
    // gets out of the way, and a hand-off that cannot work says so instead of
    // presenting a control that does nothing.
    more.addEventListener('click', function () {
      var api = cc();
      var opened = false;
      try {
        if (api && typeof api.showSettings === 'function') {
          api.showSettings();
          opened = !!document.querySelector('#cc--main');
        }
      } catch (e) { opened = false; }

      if (opened) { close(); return; }

      more.disabled = true;
      more.textContent = 'Category settings unavailable here';
      state.textContent = consentText() +
        ' The plugin\'s category dialog is not available on this preview — use the two ' +
        'buttons above, or set categories on the live site.';
    });
    actions.appendChild(acceptAll); actions.appendChild(nec); actions.appendChild(more);
    g3.appendChild(actions);

    // Said plainly rather than implied. This bundle had its tracking scripts
    // removed when it was cloned, so there is nothing here for consent to gate.
    g3.appendChild(el('p', 'a11y-note',
      'Your choice is saved on this device and kept when you come back. On this ' +
      'preview the tracking scripts were removed when the site was copied, so ' +
      'nothing is loaded either way — on the live site this same choice is what ' +
      'controls them.'));
    box.appendChild(g3);

    panel.appendChild(scrim);
    panel.appendChild(box);
    document.body.appendChild(panel);
    document.documentElement.setAttribute('data-a11y-consent-owned', '');
  }

  /* ------------------------------------------------------- open / close */
  function focusables() {
    return Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (n) {
      return n.getBoundingClientRect().width > 0 && !n.disabled;
    });
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open() {
    if (!panel) build();
    lastFocused = document.activeElement;
    panel.hidden = false;
    inerted = [];
    Array.prototype.forEach.call(document.body.children, function (n) {
      if (n === panel || n === trigger) return;
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK') return;
      if (!n.hasAttribute('aria-hidden')) {
        n.setAttribute('aria-hidden', 'true');
        n.setAttribute('inert', '');
        inerted.push(n);
      }
    });
    document.addEventListener('keydown', onKey, true);
    var f = focusables(); if (f.length) f[0].focus();
    trigger && trigger.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    inerted.forEach(function (n) { n.removeAttribute('aria-hidden'); n.removeAttribute('inert'); });
    inerted = [];
    document.removeEventListener('keydown', onKey, true);
    trigger && trigger.setAttribute('aria-expanded', 'false');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /* ------------------------------------------------------------- trigger */
  function mount() {
    if (document.querySelector('.a11y-trigger')) return;
    trigger = el('button', 'a11y-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'a11y-panel');
    // Marks it as exempt from the age gate's inert sweep -- the owner's locked
    // decision is that this stays reachable while the gate is up, because
    // someone who needs bigger text needs it to read the gate.
    trigger.setAttribute('data-a11y-exempt', '');
    var icon = el('span', 'a11y-trigger__icon', '♿');
    icon.setAttribute('aria-hidden', 'true');
    trigger.appendChild(icon);
    trigger.appendChild(el('span', 'a11y-trigger__label', 'Accessibility'));
    trigger.setAttribute('aria-label', 'Accessibility and cookie settings');
    trigger.addEventListener('click', function () {
      if (panel && !panel.hidden) close(); else open();
    });
    document.body.appendChild(trigger);
  }

  function init() {
    mount();
    apply(read());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', init);

  // The drawer renders an Accessibility row only when this exists.
  window.a11yPanelOpen = open;
  window.a11yPanelClose = close;
})();
