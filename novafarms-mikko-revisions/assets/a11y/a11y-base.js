/* =============================================================================
   a11y-base.js — context-aware contrast correction + the motion kill.

   Why this is JavaScript and not more CSS.

   Both brand greens fail against white in either direction, and no single
   colour clears 4.5:1 on white AND on the brand navy: white demands a
   luminance <= 0.1833, navy demands >= 0.2523. So `--e-global-color-accent`
   cannot simply be redefined — the same declaration is correct on the hero
   (8.59:1) and wrong in body copy (1.79:1).

   CSS cannot ask what colour something is painted on. This does: it measures
   each text element exactly the way the audit did — computed foreground
   against the first painted ancestor background — and tags ONLY the elements
   that actually fail. Green on a dark ground is never touched.

   Pairs with a11y-base.css, which owns every colour value.
   ============================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- palette */
  // Kept in sync with a11y-base.css :root. Compared numerically, so the exact
  // rgb() spelling the browser returns does not matter.
  var GREENS = [[143, 211, 56], [158, 209, 84]];   // #8FD338, #9ED154
  var MUTED  = [107, 129, 143];                    // #6B818F
  var WHITE  = [255, 255, 255];

  var AA_NORMAL = 4.5;
  var AA_LARGE  = 3.0;

  /* ------------------------------------------------------------ colour math */
  // Returns [r, g, b, a]. Fully transparent -> null, so the caller keeps walking.
  function parse(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    var p = m[1].split(',').map(parseFloat);
    var a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    return [p[0], p[1], p[2], a];
  }
  function lum(rgb) {
    var f = function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function ratio(a, b) {
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }
  function near(rgb, target, tol) {
    if (!rgb) return false;
    tol = tol || 12;
    return Math.abs(rgb[0] - target[0]) <= tol &&
           Math.abs(rgb[1] - target[1]) <= tol &&
           Math.abs(rgb[2] - target[2]) <= tol;
  }
  function isGreen(rgb) {
    for (var i = 0; i < GREENS.length; i++) if (near(rgb, GREENS[i])) return true;
    return false;
  }

  /* -------------------------------------------------------- painted backdrop */
  // Returns {rgb, overImage}. Walks ancestors until something opaque paints.
  // A background-image stops the walk: we cannot know the pixel behind the
  // text, so we decline to judge rather than guess.
  //
  // Translucent layers are composited rather than treated as opaque. Without
  // this, an rgba(...,.7) scrim would be measured as if it were solid, and the
  // reported contrast would be better than what a visitor actually sees.
  function backdrop(el) {
    var layers = [];
    var node = el;
    while (node && node !== document.documentElement) {
      var s = getComputedStyle(node);
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        return { rgb: null, overImage: true };
      }
      // A full-bleed ::before overlay paints between this ancestor's own
      // background and the text below it, so it counts as a layer. Only our own
      // scrim is inspected: a general ::before sweep would be guesswork about
      // whether the pseudo-element actually covers the text.
      if (node.hasAttribute && node.hasAttribute('data-a11y-scrim')) {
        var pc = parse(getComputedStyle(node, '::before').backgroundColor);
        if (pc) layers.push(pc);
      }
      var c = parse(s.backgroundColor);
      if (c) {
        layers.push(c);
        if (c[3] >= 0.999) break;                     // opaque: nothing behind matters
      }
      node = node.parentElement;
    }
    // Composite back-to-front over the page's own white.
    var base = WHITE.slice();
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i], a = l[3];
      base = [a * l[0] + (1 - a) * base[0],
              a * l[1] + (1 - a) * base[1],
              a * l[2] + (1 - a) * base[2]];
    }
    return { rgb: base, overImage: false };
  }

  /* ------------------------------------------------------- header backdrop */
  // The site header has no background of its own: on the homepage the nav sits
  // straight over the Slider Revolution hero, which paints on its own layer.
  // White nav text therefore has no guaranteed backdrop -- over a bright slide
  // it measures 1:1 against the page white behind it.
  //
  // Rather than hard-code an Elementor container class (they are generated and
  // differ per page), find the band the same way the corrector finds anything
  // else: walk up from the nav to the first ancestor that spans the viewport
  // near the top of the document, and only scrim it if it paints nothing today.
  function scrimHeader() {
    var nav = document.querySelector('nav.elementor-nav-menu--main');
    if (!nav) return;
    var vw = document.documentElement.clientWidth;
    var node = nav;
    while (node && node !== document.body) {
      var r = node.getBoundingClientRect();
      if (r.width >= vw * 0.9 && (r.top + window.scrollY) < 200 && r.height > 40) {
        // Only where nothing is painted already -- inner pages have a solid
        // navy header and must not be darkened twice.
        var s = getComputedStyle(node);
        if (s.backgroundImage === 'none' && !parse(s.backgroundColor)) {
          node.setAttribute('data-a11y-scrim', 'header');
        }
        return;
      }
      node = node.parentElement;
    }
  }

  function ownText(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue;
    }
    return t.trim();
  }

  /* --------------------------------------------------------------- the pass */
  var stats;

  function correct() {
    stats = { checked: 0, fixed: 0, overImage: 0, unhandled: 0, unhandledSamples: [] };

    var els = document.querySelectorAll('body *:not(#a11y-panel):not(#a11y-panel *)');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-a11y-fix')) continue;      // idempotent
      if (!ownText(el)) continue;

      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;

      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;

      var fg = parse(cs.color);
      if (!fg) continue;

      var bd = backdrop(el);
      if (bd.overImage) { stats.overImage++; continue; }

      stats.checked++;

      var size = parseFloat(cs.fontSize);
      var weight = parseInt(cs.fontWeight, 10) || 400;
      var need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? AA_LARGE : AA_NORMAL;
      if (ratio(lum(fg), lum(bd.rgb)) >= need) continue;

      // Only the pairings the audit actually found are corrected. Anything else
      // is counted and reported rather than guessed at.
      var bgLight = lum(bd.rgb) > 0.4;
      var fix = null;

      // Backdrop first. Both brand greens sit above the 0.4 luminance line, so
      // they read as "light" -- which meant anything failing ON a green button
      // was being darkened toward green instead of navy, and got worse. A green
      // ground always wants navy on it (8.59 / 8.71), whatever the foreground
      // started as.
      if (isGreen(bd.rgb))                        fix = 'ink-on-green';
      else if (isGreen(fg) && bgLight)            fix = 'green-on-light';
      else if (near(fg, MUTED) && bgLight)        fix = 'muted-on-light';

      if (fix) {
        el.setAttribute('data-a11y-fix', fix);
        stats.fixed++;
      } else {
        stats.unhandled++;
        if (stats.unhandledSamples.length < 20) {
          stats.unhandledSamples.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || '').slice(0, 40),
            fg: cs.color,
            bg: 'rgb(' + bd.rgb.join(', ') + ')',
            ratio: +ratio(lum(fg), lum(bd.rgb)).toFixed(2),
            need: need,
            text: ownText(el).slice(0, 40)
          });
        }
      }
    }

    window.__a11yBase = stats;   // read by the verification pass
    return stats;
  }

  /* ------------------------------------------------------------ motion kill */
  // CSS can freeze a transition but cannot stop a script-driven autoplay loop.
  // Slider Revolution and Swiper both run their own timers.
  function motionOff() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
           document.documentElement.getAttribute('data-a11y-motion') === 'off';
  }

  function killMotion() {
    if (!motionOff()) return;
    try {
      document.querySelectorAll('.swiper-container, .swiper').forEach(function (n) {
        var sw = n.swiper;
        if (sw && sw.autoplay && typeof sw.autoplay.stop === 'function') sw.autoplay.stop();
      });
    } catch (e) { /* Swiper absent on this page */ }
    try {
      if (window.SR7 && window.SR7.M && window.SR7.M.modules) {
        Object.keys(window.SR7.M.modules).forEach(function (k) {
          var m = window.SR7.M.modules[k];
          if (m && m.slider && typeof m.slider.pause === 'function') m.slider.pause();
        });
      }
      // Slider Revolution 7 also exposes per-module API objects on window.
      document.querySelectorAll('[class*="sr7-module"]').forEach(function (n) {
        if (n.sr7 && typeof n.sr7.pause === 'function') n.sr7.pause();
      });
    } catch (e) { /* Slider Revolution absent on this page */ }
  }

  /* ------------------------------------------------------------------- boot */
  // scrimHeader() first: the corrector must measure the backdrop the visitor
  // actually gets, not the one that existed a moment earlier.
  function run() { scrimHeader(); correct(); killMotion(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  window.addEventListener('load', run);

  // Elementor renders carousels, tabs and popups after load, and the age gate
  // injects its own steps. Re-run on a debounce so late content is corrected
  // too, rather than shipping a fix that only holds for the first paint.
  var pending = null;
  var obs = new MutationObserver(function () {
    if (pending) clearTimeout(pending);
    pending = setTimeout(run, 250);
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', killMotion);

  // Exposed so the panel and the verification pass can force a re-run.
  window.a11yBaseRun = run;

  // Exposed because the panel's high-contrast setting needs exactly this
  // measurement. It had its own copy, and that copy silently drifted: it did
  // not know about the header scrim, so it read the nav's backdrop as white,
  // chose black text, and put black on navy at 2.35:1. One implementation, one
  // behaviour.
  window.a11yBackdrop = backdrop;
  window.a11yLuminance = lum;
})();
