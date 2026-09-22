/* reforge.js : the ONE preview script (loaded with defer, after the theme's
   deferred scripts). Vanilla, no dependencies.
   Plan: docs/step1-audit-and-plan.md 5.2 "Interaction contract", decisions
   3, 4, 5, 7, 23, 24, 26.
   What it does:
   1. Link neutralization for the whole page (decision 3): capture-phase
      click + auxclick on document for every a[href] (present or added later),
      preventDefault, hrefs and text never modified; submit interception for
      forms; each interception logged once to console.info and recorded in
      window.__reforgePreview.neutralized.
   2. Header stuck state: html[data-rf-stuck] while the sticky bar is pinned
      (the only attribute this script adds to the DOM).
   3. Desktop mega menu (>= 1101px) on Dawn's native <details>: hover-open
      (0ms), click / Enter / Space toggle; focusing a trigger does NOT open
      it (Tab moves straight across closed triggers: no keyboard trap); close
      on pointer leave, click outside, Esc (focus returns to the trigger);
      Tab / Shift+Tab cycle inside an OPEN panel (brief).
      Explore More's 7 level-2 <details> are forced open and their toggle is
      suppressed (decision 5).
   4. Drawer (<= 1100px, Dawn header-drawer kept): focus moves in on open,
      Tab is trapped at the active level; Esc / back buttons / slide-in
      submenus / scroll lock stay Dawn's (plus CSS for 990-1100).
   No ARIA attributes are added (decision 4). The theme's own aria-expanded
   values on the desktop triggers are kept in sync with the real state, and
   return to the theme's value when closed.
   Not touched: #av_submit_form / #av_cancel_form (age gate, no href). */
(function () {
  'use strict';
  if (window.__reforgePreview) return;

  var doc = document;
  var root = doc.documentElement;
  var PREVIEW = {
    version: '1',
    neutralized: [],
    menu: { state: function () { return []; } },
  };
  window.__reforgePreview = PREVIEW;

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s ​]+/g, ' ').trim();
  }
  function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }
  function ms(name, fallback) {
    var v = cssVar(name);
    var m = /^(-?[\d.]+)(ms|s)$/.exec(v);
    if (!m) return fallback;
    return parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1);
  }
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ======================================================================
     1. Link neutralization (whole page)
     ====================================================================== */
  var canonical = (function () {
    var l = doc.querySelector('link[rel="canonical"]');
    return (l && l.href) || 'https://smokeshopgurus.com/';
  })();
  function realTarget(href) {
    if (href == null) return null;
    try { return new URL(href, canonical).href; } catch (e) { return href; }
  }
  function regionOf(el) {
    if (el.closest('.otAgeVerifier')) return 'age-gate';
    if (el.classList && el.classList.contains('skip-to-content-link')) return 'skip';
    if (el.closest('.announcement-bar-section')) return 'announcement';
    if (el.closest('.section-header')) return 'header';
    if (el.closest('main')) return 'main';
    if (el.closest('footer, .shopify-section-group-footer-group')) return 'footer';
    return 'other';
  }
  var logged = new Set();
  function record(kind, el, href, text, via) {
    var target = realTarget(href);
    var entry = {
      kind: kind,
      text: text,
      href: href,
      target: target,
      region: regionOf(el),
      via: via,
      t: Math.round(performance.now()),
    };
    PREVIEW.neutralized.push(entry);
    var key = kind + '|' + target + '|' + text;
    if (!logged.has(key)) {
      logged.add(key);
      console.info('[reforge preview] neutralized ' + kind + ' "' + text + '" -> ' + target + ' (' + entry.region + ')');
    }
    return entry;
  }
  function linkText(a) {
    var t = norm(a.textContent);
    if (t) return t;
    var img = a.querySelector('img[alt]');
    return norm(a.getAttribute('aria-label')) || (img ? norm(img.getAttribute('alt')) : '');
  }

  function onActivate(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    // Age gate "Blockify." watermark: a div whose click handler calls
    // window.open(). Stop it before the app's delegated listener.
    var wm = t.closest('.otAgeVerifier .watermark-blockify-link');
    if (wm) {
      e.preventDefault();
      e.stopPropagation();
      record('js-link', wm, 'https://blockifyapp.com/', norm(wm.textContent), e.type);
      return;
    }
    var a = t.closest('a[href], area[href]');
    if (!a) return;
    if (a.id === 'av_submit_form' || a.id === 'av_cancel_form') return;
    e.preventDefault();
    var href = a.getAttribute('href');
    record('link', a, href, linkText(a), e.type);
    // Same-document fragment (the skip link): keep its in-page job without
    // changing the URL. Only elements that are already focusable get focus.
    if (e.type === 'click' && href && href.charAt(0) === '#' && href.length > 1) {
      var dest = null;
      try { dest = doc.getElementById(decodeURIComponent(href.slice(1))); } catch (err) { dest = null; }
      if (dest) {
        if (dest.hasAttribute('tabindex') || dest.matches('a[href], button, input, select, textarea, summary')) {
          dest.focus();
        }
        dest.scrollIntoView({ block: 'start' });
      }
    }
  }
  doc.addEventListener('click', onActivate, true);
  doc.addEventListener('auxclick', onActivate, true);

  doc.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    if (f.closest('.otAgeVerifier')) return;
    e.preventDefault();
    var s = e.submitter;
    var label = s ? (norm(s.textContent) || norm(s.getAttribute('aria-label')) || norm(s.value)) : '';
    var q = f.querySelector('input[type="search"], input[name="q"]');
    var text = label + (q && q.value ? ' [q=' + q.value + ']' : '');
    record('form', f, f.getAttribute('action'), text || norm(f.getAttribute('aria-label')) || '(form)', 'submit');
  }, true);

  /* ======================================================================
     2. Stuck state: html[data-rf-stuck] while the bar is pinned.
     ====================================================================== */
  var sectionHeader = doc.querySelector('.section-header');
  var stuck = false;
  var ticking = false;
  function updateStuck() {
    ticking = false;
    if (!sectionHeader) return;
    var top = parseFloat(getComputedStyle(sectionHeader).top) || 0;
    var r = sectionHeader.getBoundingClientRect();
    var s = window.scrollY > 10 && r.top <= top + 0.5;
    if (s === stuck) return;
    stuck = s;
    if (s) root.setAttribute('data-rf-stuck', '');
    else root.removeAttribute('data-rf-stuck');
  }
  function queueStuck() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateStuck);
  }
  window.addEventListener('scroll', queueStuck, { passive: true });
  window.addEventListener('resize', queueStuck, { passive: true });
  queueStuck();

  /* ======================================================================
     Shared: focusables, input modality
     ====================================================================== */
  var FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  function isShown(el) {
    if (typeof el.checkVisibility === 'function') {
      if (!el.checkVisibility({ visibilityProperty: true })) return false;
    } else if (!el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') {
      return false;
    }
    return true;
  }
  function focusables(container) {
    if (!container) return [];
    var out = [];
    var list = container.querySelectorAll(FOCUSABLE);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.tabIndex < 0) continue;
      if (el.tagName === 'SUMMARY' && el.parentElement && el.parentElement.querySelector(':scope > summary') !== el) continue;
      if (!isShown(el)) continue;
      out.push(el);
    }
    return out;
  }
  function searchModalOpen() {
    return !!doc.querySelector('.section-header details-modal details[open]');
  }

  /* ======================================================================
     3. Desktop mega menu
     ====================================================================== */
  var MQ_DESKTOP = window.matchMedia('(min-width: 1101px)');
  function desktop() { return MQ_DESKTOP.matches; }

  var inlineNav = doc.querySelector('.section-header .header__inline-menu');
  var items = [];
  if (inlineNav) {
    var hosts = inlineNav.querySelectorAll(':scope > ul > li > header-menu');
    for (var h = 0; h < hosts.length; h++) {
      var host = hosts[h];
      var details = host.querySelector(':scope > details');
      var summary = details && details.querySelector(':scope > summary');
      var panel = summary && summary.nextElementSibling;
      if (!details || !summary || !panel) continue;
      items.push({
        host: host, details: details, summary: summary, panel: panel,
        titles: Array.prototype.slice.call(panel.querySelectorAll(':scope > li > details')),
        by: null, closing: null,
      });
    }
  }
  var escHandledAt = 0;

  // Decision 5: the level-2 groups of the wide panel are column titles.
  function forceTitlesOpen(it) {
    for (var i = 0; i < it.titles.length; i++) {
      if (!it.titles[i].open) it.titles[i].open = true;
    }
  }
  items.forEach(forceTitlesOpen);

  function syncAria(it, isOpen) {
    it.summary.setAttribute('aria-expanded', String(isOpen));
    for (var i = 0; i < it.titles.length; i++) {
      var s = it.titles[i].querySelector(':scope > summary');
      if (s && s.hasAttribute('aria-expanded')) s.setAttribute('aria-expanded', String(isOpen));
    }
  }

  function finishClose(it) {
    var a = it.closing;
    it.closing = null;
    it.details.open = false;               // hides the content in the same task ...
    if (a) a.cancel();                      // ... as the fade is removed: no flash
  }

  function closeItem(it, animate) {
    if (!it.details.open || it.closing) return;
    it.by = null;
    syncAria(it, false);
    var dur = reducedMotion.matches ? 0 : ms('--rf-dur-mega', 260);
    if (animate === false || !dur || typeof it.panel.animate !== 'function') {
      finishClose(it);
      return;
    }
    var from = cssVar('--rf-mm-from') || '-8px';
    var anim = it.panel.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(' + from + ')' }],
      { duration: dur, easing: cssVar('--rf-ease') || 'ease', fill: 'forwards' }
    );
    it.closing = anim;
    anim.onfinish = function () { if (it.closing === anim) finishClose(it); };
  }

  function openItem(it, by) {
    for (var i = 0; i < items.length; i++) if (items[i] !== it) closeItem(items[i], true);
    if (it.closing) {                       // re-entered while fading out: fade back in
      var a = it.closing;
      it.closing = null;
      a.onfinish = function () { a.cancel(); };
      a.reverse();
    }
    forceTitlesOpen(it);
    if (!it.details.open) it.details.open = true;
    it.by = by;
    syncAria(it, true);
  }

  function openItemOf(el) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].details.open && !items[i].closing && items[i].host.contains(el)) return items[i];
    }
    return null;
  }
  function anyOpen() {
    for (var i = 0; i < items.length; i++) if (items[i].details.open && !items[i].closing) return items[i];
    return null;
  }

  items.forEach(function (it) {
    it.host.addEventListener('pointerenter', function (e) {
      if (!desktop() || e.pointerType === 'touch') return;
      openItem(it, it.details.open && it.by && !it.closing ? it.by : 'hover');
    });
    it.host.addEventListener('pointerleave', function (e) {
      if (!desktop() || e.pointerType === 'touch') return;
      if (it.by === 'hover') closeItem(it, true);
    });
    // Runs after global.js's own summary listener (same target, registered
    // later), so the aria-expanded value it writes is corrected here.
    it.summary.addEventListener('click', function (e) {
      if (!desktop()) return;
      e.preventDefault();                   // no native toggle: state is managed here
      var keyboard = e.detail === 0;
      if (!it.details.open || it.closing) openItem(it, keyboard ? 'key' : 'click');
      else if (it.by === 'hover' && !keyboard) { it.by = 'click'; syncAria(it, true); }   // pin
      else closeItem(it, true);
    });
    // No 'focus' listener: a trigger opens only on hover, click, Enter or
    // Space, so a Tab-only user passes closed triggers without Esc presses.
    // Dawn's DetailsDisclosure closes on focusout without a fade; handle it
    // here instead (desktop only). Keyboard focus cannot leave an open panel
    // (Tab cycles), so this covers clicks elsewhere.
    it.host.addEventListener('focusout', function (e) {
      if (!desktop()) return;
      e.stopPropagation();
      var to = e.relatedTarget;
      if (to && !it.host.contains(to) && it.details.open) closeItem(it, true);
    }, true);
    it.details.addEventListener('toggle', function () {
      if (it.details.open && !it.by) { it.by = 'click'; syncAria(it, true); }
      if (!it.details.open) { it.by = null; }
    });
    // Column titles: suppress their toggle (runs after global.js's listener).
    it.titles.forEach(function (d) {
      var s = d.querySelector(':scope > summary');
      if (!s) return;
      s.addEventListener('click', function (e) {
        e.preventDefault();
        if (!d.open) d.open = true;
        if (s.hasAttribute('aria-expanded')) s.setAttribute('aria-expanded', String(it.details.open && !it.closing));
      });
    });
  });

  // Click / tap outside the open panel closes it.
  doc.addEventListener('pointerdown', function (e) {
    if (!desktop()) return;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.details.open && !it.closing && !it.host.contains(e.target)) closeItem(it, true);
    }
  }, true);

  MQ_DESKTOP.addEventListener('change', function () {
    for (var i = 0; i < items.length; i++) closeItem(items[i], false);
  });

  PREVIEW.menu.state = function () {
    return items.map(function (it) {
      return { id: it.details.id, open: it.details.open, closing: !!it.closing, by: it.by, ariaExpanded: it.summary.getAttribute('aria-expanded') };
    });
  };

  /* ======================================================================
     4. Drawer (<= 1100px): focus in + Tab trap; Dawn keeps the rest.
     ====================================================================== */
  var drawerDetails = doc.querySelector('.section-header header-drawer > details');
  var drawerToggle = drawerDetails && drawerDetails.querySelector(':scope > summary');
  var drawerPanel = drawerDetails && drawerDetails.querySelector(':scope > .menu-drawer');

  function drawerActive() {
    return !!(drawerDetails && drawerDetails.open && drawerToggle && isShown(drawerToggle));
  }
  function drawerLevel() {
    var open = drawerPanel ? drawerPanel.querySelectorAll('details.menu-opening') : [];
    if (!open.length) return drawerPanel;
    var d = open[open.length - 1];           // document order: the deepest open level is last
    var s = d.querySelector(':scope > summary');
    return (s && s.nextElementSibling) || drawerPanel;
  }
  if (drawerToggle) {
    // After Dawn's own click handler (registered earlier): when it opens the
    // drawer, move focus to the first menu row once that row is visible.
    // Wait for THAT row (not "the first visible focusable"): under reduced
    // motion inherited visibility reaches deeper elements a frame per level,
    // so a shallower element (the Log in row) can become visible first.
    var firstRow = drawerPanel && drawerPanel.querySelector('.menu-drawer__navigation > ul > li > a, .menu-drawer__navigation > ul > li > details > summary');
    drawerToggle.addEventListener('click', function () {
      if (desktop() || drawerDetails.open) return;   // open is still false while opening
      var tries = 0;
      setTimeout(function step() {
        if (!drawerDetails.open) return;
        var target = firstRow && isShown(firstRow) ? firstRow : null;
        if (!target && tries >= 45) target = focusables(drawerPanel)[0] || null;   // fallback after ~0.75s
        if (target) { target.focus(); if (doc.activeElement === target) return; }
        if (++tries < 60) requestAnimationFrame(step);
      }, 0);
    });
  }

  // Submenus: Dawn focuses the back button 100ms after the click (reduced
  // motion) or on transitionend. Under reduced motion that focus() can run
  // before the button is visible, leaving focus on the submenu container;
  // finish the hand-off once the button is visible (a no-op when Dawn's
  // own call already worked).
  if (drawerPanel) {
    Array.prototype.forEach.call(drawerPanel.querySelectorAll('details > summary'), function (s) {
      var d = s.parentElement;
      var sub = s.nextElementSibling;
      var back = sub && sub.querySelector('.menu-drawer__close-button');
      if (!back) return;
      s.addEventListener('click', function () {
        if (desktop() || d.open) return;               // only when opening
        var tries = 0;
        requestAnimationFrame(function step() {
          if (!d.open) return;
          var a = doc.activeElement;
          var settled = a && sub.contains(a) && a !== sub && isShown(a);
          if (settled) return;
          if (d.classList.contains('menu-opening') && isShown(back)) { back.focus(); return; }
          if (++tries < 60) requestAnimationFrame(step);
        });
      });
    });
  }

  /* ======================================================================
     Keyboard: Tab cycle (panel / drawer), Esc (panel)
     ====================================================================== */
  function trapList() {
    if (searchModalOpen()) return null;
    if (desktop()) {
      var it = openItemOf(doc.activeElement);
      return it ? [it.summary].concat(focusables(it.panel)) : null;
    }
    if (drawerActive()) return [drawerToggle].concat(focusables(drawerLevel()));
    return null;
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      var list = trapList();
      if (!list || list.length < 2) return;
      var i = list.indexOf(doc.activeElement);
      var n = i === -1 ? (e.shiftKey ? list.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + list.length) % list.length;
      e.preventDefault();
      e.stopPropagation();                  // Dawn's trapFocus keydown would fight this
      list[n].focus();
      return;
    }
    if (e.key === 'Escape' && desktop()) {
      var open = anyOpen();
      if (!open) return;
      var inside = open.host.contains(doc.activeElement);
      closeItem(open, true);
      // Focus returns to the trigger; focus never opens a panel, so it stays closed.
      if (inside && doc.activeElement !== open.summary) open.summary.focus();
      escHandledAt = performance.now();
      e.preventDefault();
    }
  }, true);
  // global.js closes an open <details> on Escape keyup without a fade (and it
  // would close the forced-open column titles): skip it when the keydown
  // above already handled that Escape.
  window.addEventListener('keyup', function (e) {
    if (e.key === 'Escape' && escHandledAt && performance.now() - escHandledAt < 2000) {
      escHandledAt = 0;
      e.stopPropagation();
    }
  }, true);

  /* ======================================================================
     Shared product card (sections 5 and 6): browser bar (3 dots, or a
     "Best seller" star) + product path, white image plate, chips, title,
     price, "View →". One builder so both sections stay identical.
     ====================================================================== */
  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.2 6.5L12 17.3l-5.8 3.15 1.2-6.5L2.6 9.4l6.55-.85z"/></svg>';
  // lightning bolt: the "latest / new drop" badge (distinct from the Best Seller star)
  var BOLT_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.2 2.2L4.6 13.4h6.1l-1.1 8.4 8.8-11.6h-6.2z"/></svg>';
  function mk(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function money(v) { return '$' + Number(v).toFixed(2) + ' USD'; }
  function sized(src, w) { return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w; }
  function productCard(p, opts) {
    opts = opts || {};
    var card = mk(opts.tag || 'li', 'rf-pcard');
    var bar = mk('div', 'rf-pcard__bar');
    var LEAD = { star: ['Best seller', STAR_SVG], bolt: ['Latest product', BOLT_SVG] }[opts.lead];
    if (LEAD) {
      var star = mk('span', 'rf-pcard__star rf-pcard__star--' + opts.lead);
      star.setAttribute('role', 'img');
      star.setAttribute('aria-label', LEAD[0]);
      star.innerHTML = LEAD[1];
      bar.appendChild(star);
    } else {
      var dots = mk('span', 'rf-pcard__dots');
      dots.setAttribute('aria-hidden', 'true');
      bar.appendChild(dots);
    }
    var path = mk('span', 'rf-pcard__path', 'smokeshopgurus.com' + p.href);
    path.setAttribute('aria-hidden', 'true');
    bar.appendChild(path);
    card.appendChild(bar);
    var media = mk('div', 'rf-pcard__media');
    if (p.image) {
      var img = mk('img');
      img.src = sized(p.image.src, 480);
      img.alt = p.image.alt || p.title;
      img.width = p.image.width;
      img.height = p.image.height;
      img.loading = opts.eager ? 'eager' : 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
    }
    card.appendChild(media);
    var body = mk('div', 'rf-pcard__body');
    var chips = mk('div', 'rf-pcard__chips');
    (opts.chips || []).forEach(function (c) { chips.appendChild(mk('span', 'rf-chip ' + (c.cls || ''), c.text)); });
    if (p.tags && p.tags[0]) chips.appendChild(mk('span', 'rf-chip', p.tags[0]));
    if (p.compareAt && p.compareAt > p.price) chips.appendChild(mk('span', 'rf-chip rf-chip--sale', 'Sale'));
    body.appendChild(chips);
    var t = mk('a', 'rf-pcard__title', p.title);
    t.href = p.href;
    body.appendChild(t);
    var foot = mk('div', 'rf-pcard__foot');
    var price = mk('span', 'rf-pcard__price', p.price != null ? money(p.price) : '');
    if (p.compareAt && p.compareAt > p.price) price.appendChild(mk('s', 'rf-pcard__was', money(p.compareAt)));
    foot.appendChild(price);
    foot.appendChild(mk('span', 'rf-pcard__cta', p.available ? 'View →' : 'Sold out'));
    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  /* ======================================================================
     5. Shop By Category: filter sidebar + product grid (owner request,
        2026-09-21; the reference "showcase" filter pattern).
     The 4 existing category cards become the filter rows (their links,
     text and images stay; navigation is already neutralized above).
     Products come from a build-time snapshot of the store's public
     collection JSON (tools/preview/fetch-category-data.mjs), so nothing
     is invented and the live store is never called at runtime.
     ====================================================================== */
  (function shopByCategory() {
    var sec = doc.querySelector('main .shopify-section[id*="__collection_list"]');
    var wrap = sec && sec.querySelector('.collection-list-wrapper');
    var list = sec && sec.querySelector('ul.collection-list');
    var titleWrap = sec && sec.querySelector('.title-wrapper-with-link');
    if (!wrap || !list || !titleWrap) return;

    function el(tag, cls, text) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    function handleOf(a) {
      var m = /\/collections\/([^/?#]+)/.exec((a && a.getAttribute('href')) || '');
      return m ? m[1] : null;
    }
    function money(v) { return '$' + Number(v).toFixed(2) + ' USD'; }
    function sized(src, w) { return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w; }

    var rows = [].slice.call(list.querySelectorAll('.collection-list__item')).map(function (li) {
      var a = li.querySelector('.card__content:not(.card__inner .card__content) a[href*="/collections/"]') ||
              li.querySelector('a[href*="/collections/"]');
      return { li: li, a: a, handle: handleOf(a) };
    }).filter(function (r) { return r.handle; });
    if (!rows.length) return;

    // Sidebar status line: "Showing N of M products" + Reset all.
    var meta = el('div', 'rf-shop__meta');
    var showing = el('p', 'rf-shop__showing');
    var reset = el('button', 'rf-shop__reset', 'Reset all');
    reset.type = 'button';
    meta.appendChild(showing);
    meta.appendChild(reset);
    titleWrap.parentNode.insertBefore(meta, titleWrap.nextSibling);
    // One container for the filter panel (heading + status line + category rows, same order) so the
    // whole panel can stick while the product grid scrolls (owner request 2026-09-22).
    var side = el('div', 'rf-shop__side');
    var sliderHost = wrap.querySelector('slider-component');
    wrap.insertBefore(side, titleWrap);
    side.appendChild(titleWrap);
    side.appendChild(meta);
    if (sliderHost) side.appendChild(sliderHost);

    // Results column: count + sort, then the grid.
    var results = el('div', 'rf-shop__results');
    var bar = el('div', 'rf-shop__bar');
    var count = el('p', 'rf-shop__count');
    count.setAttribute('aria-live', 'polite');
    var sortWrap = el('div', 'rf-shop__sort');
    sortWrap.setAttribute('role', 'group');
    sortWrap.setAttribute('aria-label', 'Sort products');
    sortWrap.appendChild(el('span', 'rf-shop__sortlabel', 'Sort'));
    var SORTS = [['featured', 'Featured'], ['az', 'A–Z'], ['price', 'Price']];
    var sortBtns = SORTS.map(function (s) {
      var b = el('button', 'rf-shop__sortbtn', s[1]);
      b.type = 'button';
      b.dataset.sort = s[0];
      sortWrap.appendChild(b);
      return b;
    });
    bar.appendChild(count);
    bar.appendChild(sortWrap);
    var grid = el('ul', 'rf-shop__grid');
    grid.setAttribute('role', 'list');
    results.appendChild(bar);
    results.appendChild(grid);
    wrap.appendChild(results);
    wrap.classList.add('rf-shop');

    var state = { active: new Set(), sort: 'featured', data: null };
    var labelOf = {};
    rows.forEach(function (r) {
      labelOf[r.handle] = norm(r.a.textContent);
      r.a.setAttribute('role', 'button');
      r.a.setAttribute('aria-pressed', 'false');
    });

    function card(p) {
      return productCard(p, {
        lead: 'dots',
        chips: p.categories.filter(function (h) { return labelOf[h]; })
          .map(function (h) { return { text: labelOf[h], cls: 'rf-chip--cat' }; }),
      });
    }

    function render() {
      var d = state.data;
      if (!d) return;
      var list2 = d.products.filter(function (p) {
        if (!state.active.size) return true;
        return p.categories.some(function (h) { return state.active.has(h); });
      });
      if (state.sort === 'az') list2 = list2.slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
      if (state.sort === 'price') list2 = list2.slice().sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
      grid.textContent = '';
      list2.forEach(function (p, i) {
        var c = card(p);
        c.style.setProperty('--rf-i', String(Math.min(i, 12)));
        grid.appendChild(c);
      });
      showing.textContent = 'Showing ' + list2.length + ' of ' + d.products.length + ' products';
      count.textContent = list2.length + (list2.length === 1 ? ' result' : ' results');
      rows.forEach(function (r) {
        var on = state.active.has(r.handle);
        r.li.classList.toggle('is-active', on);
        r.a.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      sortBtns.forEach(function (b) {
        var on = b.dataset.sort === state.sort;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      reset.disabled = !state.active.size;
    }

    function toggle(h) {
      if (state.active.has(h)) state.active.delete(h); else state.active.add(h);
      render();
    }
    rows.forEach(function (r) {
      r.li.addEventListener('click', function (e) {
        e.preventDefault();
        toggle(r.handle);
      });
      r.a.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle(r.handle); }
      });
    });
    reset.addEventListener('click', function () { state.active.clear(); render(); });
    sortBtns.forEach(function (b) {
      b.addEventListener('click', function () { state.sort = b.dataset.sort; render(); });
    });

    fetch('data/shop-by-category.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        state.data = d;
        d.categories.forEach(function (c) {
          rows.forEach(function (r) { if (r.handle === c.handle) r.li.dataset.count = String(c.count); });
        });
        render();
        PREVIEW.shop = { state: function () { return { active: [].slice.call(state.active), sort: state.sort, shown: grid.children.length }; } };
      })
      .catch(function (err) {
        wrap.classList.remove('rf-shop');
        results.remove();
        meta.remove();
        console.warn('[reforge preview] shop-by-category data unavailable: ' + err.message);
      });
  })();

  /* ======================================================================
     6. Best Seller: overlapping coverflow carousel (owner request,
        2026-09-21). The 7 existing product cards stay as they are (same
        card design); the active one is centred and full size, neighbours
        overlap behind it, smaller, at 65% opacity (35% less). Loops.
        Prev / next buttons, click a side card, swipe, arrow keys; focusing
        a card brings it to the front. Each card gets a star badge
        ("Best seller").
     ====================================================================== */
  (function bestSellerCoverflow() {
    var sec = doc.querySelector('main .shopify-section[id*="__featured_collection_Aa7epV"]');
    var host = sec && sec.querySelector('slider-component');
    var ul = host && host.querySelector('ul.product-grid');
    if (!ul) return;
    var items = [].slice.call(ul.children).filter(function (n) { return n.tagName === 'LI'; });
    var n = items.length;
    if (n < 2) return;
    var active = 0;

    // Same card design as Shop By Category (shared productCard), with a "Best seller" star in the
    // bar instead of the 3 dots. Data: build-time snapshot of the 7 products' public JSON
    // (tools/preview/fetch-bestseller-data.mjs). The theme's own card stays in the DOM, hidden.
    fetch('data/best-seller.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var byHandle = {};
        d.products.forEach(function (p) { byHandle[p.handle] = p; });
        items.forEach(function (li) {
          var a = li.querySelector('a[href*="/products/"]');
          var m = a && /\/products\/([^/?#]+)/.exec(a.getAttribute('href'));
          var p = m && byHandle[m[1]];
          if (!p || li.querySelector('.rf-pcard')) return;
          li.appendChild(productCard(p, { tag: 'div', lead: 'star', eager: true, chips: [{ text: 'Best seller', cls: 'rf-chip--cat' }] }));
          li.classList.add('rf-cf-card');
        });
      })
      .catch(function (err) { console.warn('[reforge preview] best-seller data unavailable: ' + err.message); });

    function btn(cls, label, path) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'rf-cf__btn ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>';
      return b;
    }
    var nav = doc.createElement('div');
    nav.className = 'rf-cf__nav';
    var prev = btn('rf-cf__prev', 'Previous best seller', 'M15.5 4.5L8 12l7.5 7.5');
    var next = btn('rf-cf__next', 'Next best seller', 'M8.5 4.5L16 12l-7.5 7.5');
    var count = doc.createElement('span');
    count.className = 'rf-cf__count';
    count.setAttribute('aria-live', 'polite');
    nav.appendChild(prev);
    nav.appendChild(count);
    nav.appendChild(next);
    host.parentNode.insertBefore(nav, host.nextSibling);

    ul.classList.add('rf-cf');
    host.classList.add('rf-cf-host');

    function offsetOf(i) {
      var o = (i - active) % n;
      if (o > n / 2) o -= n;
      if (o <= -n / 2) o += n;
      return o;
    }
    function render() {
      items.forEach(function (li, i) {
        var o = offsetOf(i), a = Math.abs(o);
        // data-o, not an inline style: the theme's animations.js rewrites each card's style
        // attribute (--animation-order) when it scrolls into view, which wiped inline --o.
        li.dataset.o = String(o);
        li.classList.toggle('is-active', o === 0);
        li.classList.toggle('is-far', a > 2);
      });
      count.textContent = (active + 1) + ' / ' + n;
    }
    function go(i) { active = ((i % n) + n) % n; render(); }

    prev.addEventListener('click', function () { go(active - 1); });
    next.addEventListener('click', function () { go(active + 1); });

    // A click on a side card brings it to the front (links are inert anyway).
    var swiped = false;
    ul.addEventListener('click', function (e) {
      var li = e.target.closest && e.target.closest('li');
      if (!li || !ul.contains(li)) return;
      if (swiped) { swiped = false; e.preventDefault(); return; }
      var i = items.indexOf(li);
      if (i >= 0 && i !== active) { e.preventDefault(); go(i); }
    });
    // Keyboard: focusing a card brings it forward; arrows move.
    ul.addEventListener('focusin', function (e) {
      var li = e.target.closest && e.target.closest('li');
      var i = items.indexOf(li);
      if (i >= 0 && i !== active) go(i);
    });
    [ul, nav].forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
      });
    });
    // Swipe / drag.
    var x0 = null;
    ul.addEventListener('pointerdown', function (e) { x0 = e.clientX; swiped = false; });
    ul.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; go(active + (dx < 0 ? 1 : -1)); }
    });
    ul.addEventListener('pointercancel', function () { x0 = null; });

    render();
    PREVIEW.bestSeller = { state: function () { return { active: active, n: n }; }, go: go };
  })();

  /* ======================================================================
     7. Hero: generated e-commerce "checkout" interface illustration below
        the headline panel (owner request 2026-09-22; the reference hero's
        product-UI visual). Decorative (alt=""). Generated with fal
        nano-banana-pro; provenance in audit/generated/hero-checkout.json.
     ====================================================================== */
  (function heroShot() {
    var box = doc.querySelector('main .slideshow__text.banner__box');
    if (!box || box.querySelector('.rf-hero-shot')) return;
    var heading = box.querySelector('.banner__heading');
    // Sub text under the headline (owner request 2026-09-22). Not new copy: SSG's own sentence,
    // verbatim from the page's FAQ answer "What products does Smoke Shop Gurus offer?".
    if (heading) {
      var sub = mk('p', 'rf-hero-sub', 'Smoke Shop Gurus provides a wide selection of smoke and vape products, including vape disposables, edibles, CBD, and smoking accessories from trusted brands.');
      heading.parentNode.insertBefore(sub, heading.nextSibling);
    }
    var fig = mk('figure', 'rf-hero-shot');
    var img = mk('img');
    img.src = 'media/hero-checkout.webp';
    img.width = 1921;
    img.height = 1118;
    img.alt = '';
    img.decoding = 'async';
    fig.appendChild(img);
    // headline, sub text, the "Shop all" CTA, then the image (owner 2026-09-22: CTA under the sub text)
    box.appendChild(fig);
    box.classList.add('rf-hero-open');
  })();

  /* ======================================================================
     8. Headings: key words in green (owner request 2026-09-22; the
        reference colours one phrase of each heading). Only a <span> is
        added around existing text; the words are unchanged.
     ====================================================================== */
  (function accentHeadings() {
    var ACCENTS = [
      ['Your Trusted Source for Quality Smoke, Vape, and CBD Products', 'Smoke, Vape, and CBD'],
      ['Shop By Category', 'Category'],
      ['Latest Products', 'Products'],
      ['Best Seller', 'Seller'],
      ['Frequently Asked Questions', 'Questions'],
    ];
    function wrap(h, phrase) {
      if (h.querySelector('.rf-accent')) return;
      var walker = doc.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var i = node.nodeValue.indexOf(phrase);
        if (i < 0) continue;
        var mid = node.splitText(i);
        mid.splitText(phrase.length);
        var span = mk('span', 'rf-accent');
        mid.parentNode.insertBefore(span, mid);
        span.appendChild(mid);
        return;
      }
    }
    [].forEach.call(doc.querySelectorAll('main h2'), function (h) {
      var t = norm(h.textContent);
      ACCENTS.forEach(function (a) { if (t === a[0]) wrap(h, a[1]); });
    });
  })();

  /* ======================================================================
     9. Brand marquee below the hero (owner request 2026-09-22; the
        reference's two-row brand strip). Brands are the store's own:
        the brand tags on its products (audit/data/*.raw.json) plus
        Cartisan (a Best Seller product's own name). Top row moves left,
        bottom row right; pauses on hover and stops for reduced motion.
        Screen readers get the list once; the moving copies are hidden.
     ====================================================================== */
  (function brandMarquee() {
    var hero = doc.querySelector('main > .shopify-section');
    if (!hero || doc.querySelector('.rf-brands')) return;
    var ROWS = [
      ['Elements', 'aLeaf', 'RAW', 'Blazy Susan', 'Zig-Zag', 'Pop Cones', 'Bic', 'Cartisan'],
      ['Inex', 'Jolly Cannabis', 'Skunk', 'Shrum', 'Mmelt', 'Tre House', 'Infused Edibles'],
    ];
    var sec = mk('section', 'rf-brands');
    sec.setAttribute('aria-label', 'Brands we carry');
    // (owner 2026-09-22: no header row: the label, Pause button and Shop all link were removed;
    //  the rows still pause on hover and stay still under prefers-reduced-motion)
    // the accessible list, once
    var srList = mk('ul', 'visually-hidden');
    ROWS.forEach(function (r) { r.forEach(function (b) { srList.appendChild(mk('li', null, b)); }); });
    sec.appendChild(srList);
    // the moving rows: each track holds two identical halves (translateX -50% loops seamlessly);
    // each half repeats the row 4x so one half is wider than any common viewport (measured: 2 reps
    // = 1741px, which left a gap at 1920)
    var SPEED = [36, 30];   // px per second (top, bottom)
    var tracks = [];
    ROWS.forEach(function (names, i) {
      var row = mk('div', 'rf-brands__row ' + (i === 0 ? 'rf-brands__row--left' : 'rf-brands__row--right'));
      row.setAttribute('aria-hidden', 'true');
      var track = mk('div', 'rf-brands__track');
      for (var half = 0; half < 2; half++) {
        var ul = mk('ul', 'rf-brands__set');
        for (var rep = 0; rep < 4; rep++) names.forEach(function (b) { ul.appendChild(mk('li', 'rf-brand', b)); });
        track.appendChild(ul);
      }
      row.appendChild(track);
      sec.appendChild(row);
      tracks.push(track);
    });
    // constant speed whatever the half's width (chip size changes at the mobile breakpoint)
    function timeTracks() {
      tracks.forEach(function (t, i) {
        var halfW = t.firstElementChild ? t.firstElementChild.getBoundingClientRect().width : 0;
        if (halfW) t.style.animationDuration = (halfW / SPEED[i]).toFixed(1) + 's';
      });
    }
    var tt;
    window.addEventListener('resize', function () { clearTimeout(tt); tt = setTimeout(timeTracks, 200); });
    hero.insertAdjacentElement('afterend', sec);
    timeTracks();
  })();

  /* ======================================================================
     10. Latest Products: a continuously moving row of all the section's
         products (owner request 2026-09-22; the reference's product
         slideshow), same card as Shop By Category / Best Seller with a
         lightning-bolt "Latest product" badge instead of the star.
         Data: build-time snapshot of the section's 8 products
         (fetch-bestseller-data.mjs --name latest). Pauses on hover and
         on keyboard focus; still (and scrollable) under reduced motion.
         Only the first set is exposed to screen readers / Tab; the loop
         copies are aria-hidden with their links taken out of the tab order.
     ====================================================================== */
  (function latestMarquee() {
    var sec = doc.querySelector('main .shopify-section[id$="__featured_collection"]');
    var host = sec && sec.querySelector('slider-component');
    if (!host || sec.querySelector('.rf-latest')) return;
    var SPEED = 30;   // px per second
    fetch('data/latest.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var row = mk('div', 'rf-latest');
        var track = mk('div', 'rf-latest__track');
        for (var half = 0; half < 2; half++) {
          var set = mk('ul', 'rf-latest__set');
          set.setAttribute('role', 'list');
          for (var rep = 0; rep < 2; rep++) {
            d.products.forEach(function (p) {
              var li = mk('li', 'rf-latest__item');
              var card = productCard(p, { tag: 'div', lead: 'bolt', chips: [{ text: 'Latest', cls: 'rf-chip--cat' }] });
              if (half || rep) {
                li.setAttribute('aria-hidden', 'true');
                [].forEach.call(card.querySelectorAll('a'), function (a) { a.tabIndex = -1; });
              }
              li.appendChild(card);
              set.appendChild(li);
            });
          }
          track.appendChild(set);
        }
        row.appendChild(track);
        host.parentNode.insertBefore(row, host.nextSibling);
        sec.classList.add('rf-latest-on');
        function time() {
          var w = track.firstElementChild.getBoundingClientRect().width;
          if (w) track.style.animationDuration = (w / SPEED).toFixed(1) + 's';
          // full-bleed row: the viewport width without the scrollbar
          row.style.setProperty('--rf-sbw', (window.innerWidth - root.clientWidth) + 'px');
        }
        time();
        var t;
        window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(time, 200); });
      })
      .catch(function (err) { console.warn('[reforge preview] latest data unavailable: ' + err.message); });
  })();

  /* ======================================================================
     11. Promo tiles (Mushroom Product / Pet Wellness) in the shared card
         design (owner request 2026-09-22): browser bar with a mushroom /
         paw badge + the collection path, the photo on the plate, a
         "Category" chip, the title, and a "N products · Shop →" foot
         (counts from the store's collection data). Existing links, text
         and images are kept; only the bar, chip and foot are added.
     ====================================================================== */
  // wide spotted cap (spots are evenodd cut-outs so it still reads as a mushroom at 13px) + short stem
  var MUSHROOM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M12 2.4C6.1 2.4 1.6 6.3 1.6 10.7c0 1 .8 1.7 1.8 1.7h17.2c1 0 1.8-.7 1.8-1.7 0-4.4-4.5-8.3-10.4-8.3zM9.7 7.3a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 1 1 3.8 0zm6-1.6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 1 1 3 0zm2.9 3.9a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 1 1 2.6 0z"/><path d="M8.6 13.6h6.8l.8 5.3c.2 1.3-.8 2.5-2.1 2.5h-4.2c-1.3 0-2.3-1.2-2.1-2.5z"/></svg>';
  var PAW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="6.4" cy="9.6" r="2.2"/><circle cx="10" cy="5.9" r="2.2"/><circle cx="14" cy="5.9" r="2.2"/><circle cx="17.6" cy="9.6" r="2.2"/><path d="M12 11.2c-2.9 0-6 3.3-6 6.1 0 1.8 1.3 2.9 3 2.9 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-1.1 3-2.9 0-2.8-3.1-6.1-6-6.1z"/></svg>';
  (function promoTiles() {
    // the AI block's own (stable) class names, as in the server HTML
    var tiles = [].slice.call(doc.querySelectorAll('main .ai-collection-column-adwpzbxvecvr2empvraigenblock2fc9e71cnpm6q'));
    if (!tiles.length) return;
    var ICON = { 'mushroom-products': MUSHROOM_SVG, 'cbd-pet-treats': PAW_SVG };
    function build(counts) {
      tiles.forEach(function (tile) {
        var a = tile.querySelector('a[href*="/collections/"]');
        if (!a || tile.classList.contains('rf-promo')) return;
        var m = /\/collections\/([^/?#]+)/.exec(a.getAttribute('href'));
        var handle = m && m[1];
        var bar = mk('div', 'rf-pcard__bar');
        var badge = mk('span', 'rf-pcard__star rf-pcard__star--' + (handle === 'cbd-pet-treats' ? 'paw' : 'mushroom'));
        badge.setAttribute('aria-hidden', 'true');       // decorative: the title says the same
        badge.innerHTML = ICON[handle] || MUSHROOM_SVG;
        var path = mk('span', 'rf-pcard__path', 'smokeshopgurus.com' + a.getAttribute('href'));
        path.setAttribute('aria-hidden', 'true');
        bar.appendChild(badge);
        bar.appendChild(path);
        a.insertBefore(bar, a.firstChild);
        var body = a.querySelector('.ai-collection-column-overlay-adwpzbxvecvr2empvraigenblock2fc9e71cnpm6q');
        var title = body && body.querySelector('h3');
        if (body && title) {
          var chips = mk('div', 'rf-pcard__chips');
          chips.appendChild(mk('span', 'rf-chip rf-chip--cat', 'Category'));
          body.insertBefore(chips, title);
          var foot = mk('div', 'rf-pcard__foot');
          var n = counts[handle];
          foot.appendChild(mk('span', 'rf-pcard__price', n != null ? n + (n === 1 ? ' product' : ' products') : ''));
          foot.appendChild(mk('span', 'rf-pcard__cta', 'Shop →'));
          body.appendChild(foot);
        }
        tile.classList.add('rf-promo');
      });
    }
    fetch('data/shop-by-category.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { categories: [] }; })
      .catch(function () { return { categories: [] }; })
      .then(function (d) {
        var counts = {};
        (d.categories || []).forEach(function (c) { counts[c.handle] = c.count; });
        build(counts);
      });
  })();

  /* ======================================================================
     12. Short sub texts under the section headings (owner request
         2026-09-22). Plain descriptions of each section, no claims.
     ====================================================================== */
  (function headingSubs() {
    var SUBS = [
      ['Shop By Category', 'Pick a category to filter the products.'],
      ['Latest Products', 'The newest additions to our shop.'],
      ['Best Seller', 'Our most popular products.'],
      ['Frequently Asked Questions', 'Quick answers about our products, orders, and shipping.'],
    ];
    [].forEach.call(doc.querySelectorAll('main h2'), function (h) {
      var t = norm(h.textContent);
      SUBS.forEach(function (s) {
        if (t !== s[0] || (h.nextElementSibling && h.nextElementSibling.classList.contains('rf-sec-sub'))) return;
        h.parentNode.insertBefore(mk('p', 'rf-sec-sub', s[1]), h.nextSibling);
      });
    });
  })();

  /* ------------------------------------------------------------------------
     13. FAQ rows as browser windows (owner request 2026-09-22): each row
         (div.accordion) gets the product card's bar (dots + path pill) as its
         first child, OUTSIDE <details>, so details > summary stays valid and
         the h3s keep their order. The bar is decorative (aria-hidden); a
         pointer click on it toggles the row, the keyboard keeps the summary.
         The pill shows the FAQ page the footer links to (/pages/faqs).
     ------------------------------------------------------------------------ */
  (function faqWindows() {
    var sec = doc.querySelector('main [id*="__collapsible_content"]');
    if (!sec) return;
    [].forEach.call(sec.querySelectorAll('.collapsible-row-layout .accordion'), function (acc) {
      var details = acc.querySelector('details');
      if (!details || acc.querySelector('.rf-faq__bar')) return;
      var bar = mk('div', 'rf-pcard__bar rf-faq__bar');
      bar.setAttribute('aria-hidden', 'true');
      bar.appendChild(mk('span', 'rf-pcard__dots'));
      bar.appendChild(mk('span', 'rf-pcard__path', 'smokeshopgurus.com/pages/faqs'));
      bar.addEventListener('click', function () { details.open = !details.open; });
      acc.insertBefore(bar, acc.firstChild);
    });
    sec.classList.add('rf-faq');
  })();

  /* ------------------------------------------------------------------------
     14. Section background words (owner request 2026-09-22, the reference's
         giant outlined word behind a section, same low-opacity style as the
         footer's): one keyword per section, taken from its own heading, set
         as data attributes that the sheet draws in ::after (alt text "", so
         it stays out of the a11y tree). Not on Shop By Category (owner).
         pos = where the section has empty space: "tr" top-right of the
         heading row, "bl" bottom-left under the heading.
     ------------------------------------------------------------------------ */
  (function sectionWords() {
    var WORDS = [
      ['Latest Products', 'LATEST', 'tr'],
      ['Best Seller', 'BEST', 'tr'],
      ['Frequently Asked Questions', 'FAQ', 'bl'],
    ];
    [].forEach.call(doc.querySelectorAll('main > .shopify-section'), function (sec) {
      var h = sec.querySelector('h2');
      if (!h) return;
      var t = norm(h.textContent);
      WORDS.forEach(function (w) {
        if (t !== w[0]) return;
        sec.setAttribute('data-rf-word', w[1]);
        sec.setAttribute('data-rf-word-pos', w[2]);
      });
    });
  })();

  /* ------------------------------------------------------------------------
     15. Mega menu cards (owner request 2026-09-22, the reference's card rail):
         - Explore More (wide panel): a feature card on the right rail. Copy
           is ours, built only from SSG's own claims (FAQ Q1 trusted brands,
           Q2 verified manufacturers, Q5 nationwide shipping); the link is
           the hero's own "Shop all" target (/collections/all).
         - Cones / Nicotine (compact panels): a short intro line (from the
           panel's own links) + the first product of the matching collection
           as our product card (build-time snapshot data/mega.json, from
           tools/preview/fetch-collection-sample.mjs).
         Each is an <li> of the panel's list, after the existing items, so
         DOM / reading / Tab order stays: trigger, links, then the card.
         Desktop panels only (the <= 1100 drawer is separate markup).
     ------------------------------------------------------------------------ */
  (function megaCards() {
    function panel(id) { var s = doc.getElementById(id); return s && s.nextElementSibling; }
    var wide = panel('HeaderMenu-explore-more');
    if (wide && !wide.querySelector('.rf-mm-feature')) {
      var li = mk('li', 'rf-mm-feature');
      var card = mk('div', 'rf-mm-feature__card');
      card.appendChild(mk('span', 'rf-mm-chip', 'Nationwide shipping'));
      card.appendChild(mk('span', 'rf-mm-eyebrow', 'Smoke Shop Gurus'));
      card.appendChild(mk('p', 'rf-mm-feature__title', 'Smoke, vape and CBD from trusted brands.'));
      card.appendChild(mk('p', 'rf-mm-feature__text', 'Authentic products from verified manufacturers, shipped across the USA.'));
      // a few of the brands the store carries (the brand marquee's list, section 9)
      var brands = mk('ul', 'rf-mm-brands');
      brands.setAttribute('aria-label', 'Brands we carry');
      ['RAW', 'Elements', 'Zig-Zag', 'Blazy Susan', 'aLeaf', 'Inex'].forEach(function (b) { brands.appendChild(mk('li', 'rf-mm-brand', b)); });
      card.appendChild(brands);
      var cta = mk('a', 'rf-mm-feature__cta', 'Shop all products →');
      cta.href = '/collections/all';
      card.appendChild(cta);
      li.appendChild(card);
      wide.appendChild(li);
      wide.classList.add('rf-mm-has-feature');
    }
    // [trigger id, snapshot collection, eyebrow, intro, "all" link text, its href (a link that already exists on the page)]
    var COMPACT = [
      ['HeaderMenu-cones', 'king-size-cones', 'Shop cones', 'Pre-rolled cones in king size and bulk packs.',
        'Shop all cones →', '/collections/pre-rolled-cones'],          // the Shop By Category "Pre-Rolled Cones" card
      ['HeaderMenu-nicotine', 'disposable-vape-devices', 'Shop nicotine', 'Disposable vape devices, pens and hemp vape pens.',
        'Shop vape & disposables →', '/collections/nicotine-disposable-vape'],  // the footer's "Vape & Disposables"
    ];
    fetch('data/mega.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('mega.json ' + r.status); return r.json(); })
      .then(function (data) {
        COMPACT.forEach(function (c) {
          var ul = panel(c[0]);
          var p = data.collections && data.collections[c[1]] && data.collections[c[1]][0];
          if (!ul || !p || ul.querySelector('.rf-mm-card')) return;
          var rows = ul.children.length + 1;          // the intro + the existing links
          var intro = mk('li', 'rf-mm-intro');
          intro.appendChild(mk('span', 'rf-mm-eyebrow', c[2]));
          intro.appendChild(mk('span', 'rf-mm-intro__text', c[3]));
          ul.insertBefore(intro, ul.firstChild);
          var all = mk('li', 'rf-mm-all');
          var allA = mk('a', 'rf-mm-all__link', c[4]);
          allA.href = c[5];
          all.appendChild(allA);
          ul.appendChild(all);
          var item = mk('li', 'rf-mm-card');
          item.appendChild(productCard(p, { tag: 'div', eager: true, chips: [{ text: 'Featured', cls: 'rf-chip--cat' }] }));
          ul.appendChild(item);
          ul.style.setProperty('--rf-mm-rows', rows);
          ul.classList.add('rf-mm-has-card');
        });
      })
      .catch(function () { /* no snapshot: the panels keep their links only */ });
  })();
})();
