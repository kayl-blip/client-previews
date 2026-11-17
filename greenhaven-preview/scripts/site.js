/* Green Haven — site behaviour. No dependencies. Each block is independent and exits quietly
   when its markup is not on the page. */
(function () {
  'use strict';
  var doc = document;
  var $ = function (sel, root) { return (root || doc).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };

  // Everything behind a modal layer (the age gate, the open drawer) is made inert while it is up,
  // so neither the keyboard nor a screen reader can wander into the page underneath.
  function setInert(selectors, on) {
    selectors.forEach(function (sel) { $$(sel).forEach(function (el) { el.inert = on; }); });
  }

  /* --- age gate ----------------------------------------------------------
     The gate is visible by default (CSS). scripts/reveal-init.js, which runs in <head>, adds
     .age-ok to <html> when this browser has already confirmed, and only that hides it. So with
     JavaScript off, slow or broken, the gate stays up: it fails closed. */
  (function ageGate() {
    var gate = $('#age-gate');
    if (!gate) return;
    var KEY = 'gh-age-ok', root = doc.documentElement;
    if (root.classList.contains('age-ok')) return;
    var BEHIND = ['.skip-link', '.topbar', '.site-header', '#site-drawer', 'main', '.site-footer', '.mobile-bar'];
    var yes = $('[data-age-yes]', gate), no = $('[data-age-no]', gate), err = $('.age-gate__error', gate);
    gate.classList.add('is-ready');            // script is here: the buttons work
    setInert(BEHIND, true);
    yes.focus();
    function trap(e) {
      if (e.key !== 'Tab') return;
      var f = [yes, no], i = f.indexOf(doc.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();   // also catches focus that a click moved outside
    }
    doc.addEventListener('keydown', trap, true);
    yes.addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      root.classList.add('age-ok');
      setInert(BEHIND, false);
      doc.removeEventListener('keydown', trap, true);
      var skip = $('.skip-link');
      if (skip) skip.focus();                  // start of the page, for keyboard and screen-reader users
    });
    no.addEventListener('click', function () { err.hidden = false; err.scrollIntoView({ block: 'nearest' }); });
  })();

  /* --- current page in the nav ------------------------------------------- */
  (function currentPage() {
    var here = location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
    $$('.nav__list a, .drawer__primary a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('#') > -1 || /^https?:/.test(href)) return;
      var path = new URL(href, location.href).pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
      if (path === here && here !== '/') a.setAttribute('aria-current', 'page');
    });
  })();

  /* --- mobile drawer ----------------------------------------------------- */
  (function drawer() {
    var btn = $('.nav-toggle'), panel = $('#site-drawer');
    if (!btn || !panel) return;
    var header = $('.site-header');
    var BEHIND = ['.skip-link', '.topbar', 'main', '.site-footer', '.mobile-bar'];   // the header stays reachable: it holds the close button
    function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
    function set(open) {
      if (open && header) panel.style.setProperty('--drawer-top', Math.max(0, Math.round(header.getBoundingClientRect().bottom)) + 'px');
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      doc.body.classList.toggle('is-locked', open);
      // The drawer and the header do not scroll with the page. While the drawer is open the page's top
      // band (scroll-padding, kept clear for the sticky header) is switched off, or the browser would
      // scroll the page behind to "reveal" every drawer link the keyboard lands on.
      doc.documentElement.classList.toggle('is-drawer-open', open);
      setInert(BEHIND, open);
    }
    btn.addEventListener('click', function () { set(!isOpen()); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { set(false); btn.focus({ preventScroll: true }); } });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', function (m) { if (m.matches) set(false); });
    // rotating the phone moves the header: keep the open drawer attached to it
    // after the new layout exists: next frame, and once more shortly after for browsers that settle late
    function reattach() {
      if (!isOpen()) return;
      requestAnimationFrame(function () { if (isOpen()) set(true); });
      setTimeout(function () { if (isOpen()) set(true); }, 120);
    }
    window.addEventListener('resize', reattach);
    window.addEventListener('orientationchange', reattach);
  })();

  /* --- menu page: category links while already on the menu ----------------
     The live menu (a third-party embed) reads the #/category part of the address only when the
     page loads. A link to /menu/#/flower clicked ON the menu page changes the address and
     nothing else, so reload with the new address. Only #/… and #?… routes: never #main. */
  (function menuDeepLinks() {
    if (!$('#strain-embed')) return;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var u;
      try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
      if (u.origin !== location.origin || u.pathname !== location.pathname || !/^#[/?]/.test(u.hash)) return;
      e.preventDefault();
      if (u.href !== location.href) location.href = u.href;
      // start the reloaded page at the top, where the menu is (see reveal-init.js)
      try { history.scrollRestoration = 'manual'; } catch (x) {}
      window.scrollTo(0, 0);
      location.reload();
    });
  })();

  /* --- menu page: name the frame the store's menu draws itself in ---------
     The embed inserts an untitled <iframe>; screen readers announce it as nothing. */
  (function menuFrameTitle() {
    var box = $('#strain-embed');
    if (!box || !('MutationObserver' in window)) return;
    var frame = box.closest('.menu-embed__frame'), watched = null;
    // The menu tells the page which of its views is showing. Its list views (home, a category) open with the store's
    // advert slider in the old artwork. This page shows the same offers above in the new artwork, so on those views
    // the slider is cut out of sight (30-pages.css). Any other view (a product, the cart, a deal) is left whole.
    var replaces = !!(frame && $('.shop-offers')), listView = false;
    // A list view is /embed/<id>?... with nothing in its address but the settings below: the ones seen on views that
    // open with the slider (home, a category, a brand, a search, a strain type, "on sale"). A deal's page has the same path, no slider, and
    // carries discountIds...: any setting not listed here leaves the menu whole.
    var LIST_KEYS = /^(location|pin|timestamp|gtmId|sort|page|mode|menu|category|brand|search|productType|withDiscount)$/;
    var isList = function (pathurl) {
      var m = /^\/embed\/\d+\/?(?:\?(.*))?$/.exec(pathurl);
      if (!m) return false;
      try { return (m[1] || '').split('&').every(function (kv) { return !kv || LIST_KEYS.test(decodeURIComponent(kv.split('=')[0])); }); } catch (err) { return false; }
    };
    // The cut is only made for a visitor who is browsing. The menu opens its dialogs at its own top edge, inside the
    // strip that is cut away ("enter your phone number to start your order"), so the moment it says it has opened
    // one the whole menu is given back. It stays whole for a day in this browser: an order in progress is a state
    // of the menu nobody outside the store can look at in advance.
    var WHOLE = 'gh-menu-whole', whole = false, header = $('.site-header');
    try { whole = Date.now() - Number(localStorage.getItem(WHOLE) || 0) < 864e5; } catch (err) {}
    var giveBack = function (forTheDay) { whole = true; if (forTheDay) { try { localStorage.setItem(WHOLE, String(Date.now())); } catch (err) {} } };
    // told: the menu has said which view it is on. reported: the height of the menu's own content, as it reports it
    // (the frame itself is padded by the menu script, by up to 570px, so its height says little while the menu loads).
    var told = false, reported = null, cutOn = false, cutAt = 0, grownAt = 0;
    var cutPx = function () { var w = frame.clientWidth; return w / 2 + (w >= 768 ? 53 : -11); };   // the same sum as in 30-pages.css
    // The embed inserts an empty 150px frame first and fills it seconds later (or never). The loading notice stays
    // until the menu is really there.
    var live = function (f) {
      if (!frame) return;
      var now = Date.now(), content = reported === null ? f.offsetHeight - 70 : reported, want = replaces && listView && !whole;
      // The cut goes on once the menu's own content is clearly taller than its slider (a loading skeleton is not).
      // It then stays on for that view, so a dip in height while the menu fills in does not make the page jump. But
      // never when it would leave less than 200px of the frame on show: a browser does not draw a frame it cannot
      // show, and the menu would never arrive.
      var on = want && f.offsetHeight > cutPx() + 200 && (cutOn || content >= cutPx() + 400);
      if (on && !cutOn) { cutAt = now; setTimeout(function () { live(f); }, 650); }
      cutOn = on;
      frame.classList.toggle('hides-banner', cutOn);
      if (content > 330 && !grownAt) { grownAt = now; setTimeout(function () { live(f); }, 2600); setTimeout(function () { live(f); }, 4100); }
      if (!grownAt || content <= 330) return;
      // The notice goes when the menu is there and has said which view it is showing. On a view that is cut it goes
      // 0.6s after the cut, the time the slider's own pictures usually need, so the menu is not seen jumping into
      // place. If the menu never says which view it is on, or stays too short to cut, the notice goes anyway.
      var waited = now - grownAt;
      if (waited > 4000 || (!want && (told || waited > 2500)) || (cutOn && now - cutAt >= 600)) frame.classList.add('is-live');
    };
    var name = function () {
      var f = $('iframe', box); if (!f) return;
      if (!f.title) f.title = 'Green Haven live menu';
      if (f !== watched) { watched = f; if ('ResizeObserver' in window) new ResizeObserver(function () { live(f); }).observe(f); else setInterval(function () { live(f); }, 500); }
      live(f);
    };
    name();
    new MutationObserver(name).observe(box, { childList: true, subtree: true });
    // The menu script answers 'modal-opened' by scrolling the page to 30px above the menu. Where the header stays on
    // screen (phones and tablets) that leaves the top of the dialog under it. Once the menu script has scrolled, the
    // page is moved so that the menu's top edge sits just below the header.
    var clearOfHeader = function () {
      setTimeout(function () {
        if (!header || !/sticky|fixed/.test(getComputedStyle(header).position)) return;
        var top = box.getBoundingClientRect().top, need = header.getBoundingClientRect().bottom + 8;
        if (top < need) window.scrollBy({ top: top - need, behavior: 'instant' });
      }, 0);
    };
    // only messages from the menu's own frame count
    window.addEventListener('message', function (e) {
      var f = $('iframe', box);
      if (!f || e.source !== f.contentWindow || !e.data) return;
      var type = e.data.type;
      if (type === 'path-url-changed') { told = true; listView = isList(String(e.data.pathurl || '')); }
      else if (type === 'height-changed') { if (Number(e.data.height) > 0) reported = Number(e.data.height); }
      else if (type === 'modal-opened') { giveBack(true); clearOfHeader(); }
      // A new message of the menu's own that reads like a dialog: the menu is whole for this visit, nothing is stored.
      // Other scripts inside the menu's frame post messages of their own now and then (no type, or types of theirs).
      else if (typeof type === 'string' && /(^|-)(modal|dialog|popup|drawer|cart|checkout|order)(-|$)|-opened$/.test(type)) giveBack(false);
      live(f);
    });
  })();

  /* --- sideways card rows: a card reached by keyboard comes fully into view --
     The rows snap, and the snap pulls a half-shown focused card back out of view. */
  doc.addEventListener('focusin', function (e) {
    var item = e.target.closest && e.target.closest('.bestsellers__item, .reviews__item, .collection__cell, .visitpage__photo, .menu-cards > .product-card');
    var row = item && (item.closest('.reviews__list') || item.parentElement);   // review cards sit in column lists inside the row
    if (row && row.scrollWidth > row.clientWidth + 4) item.scrollIntoView({ block: 'nearest', inline: 'start' });
    // a text box keeps only its cursor in view by default; bring the whole box clear of the header and the action bar
    if (e.target.matches && e.target.matches('textarea')) e.target.scrollIntoView({ block: 'nearest' });
  });
  // Some rows hold cards with no link in them (collection tiles, reviews, photos), so Tab alone cannot bring
  // those into view. While a row scrolls sideways it is a tab stop of its own (arrow keys scroll it); on wide
  // screens it is not.
  (function scrollRows() {
    var rows = $$('.collection__grid, .reviews__list, .visitpage__photo-row');
    if (!rows.length) return;
    var sync = function () { rows.forEach(function (r) { if (r.scrollWidth > r.clientWidth + 4) r.setAttribute('tabindex', '0'); else r.removeAttribute('tabindex'); }); };
    sync(); window.addEventListener('load', sync);
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(sync, 150); });
  })();

  /* --- paper: folded text is printed open, then folded again ---------------- */
  (function printFolds() {
    var shut = [];
    window.addEventListener('beforeprint', function () { shut = $$('details:not([open])'); shut.forEach(function (d) { d.open = true; }); });
    window.addEventListener('afterprint', function () { shut.forEach(function (d) { d.open = false; }); shut = []; });
  })();

  /* --- menu preview: a discount that has ended is not advertised -----------
     The cards are a snapshot of the live menu. Each discounted card carries the moment its discount ends
     there; from then on the card shows the price before the discount and its type instead of the badge. */
  (function endedDiscounts() {
    var now = Date.now();
    $$('.product-card[data-ends]').forEach(function (card) {
      if (!(Date.parse(card.getAttribute('data-ends')) <= now)) return;
      var price = $('.product-card__price', card), was = price && $('s', price), badge = $('.badge', card);
      if (was) { var full = doc.createElement('strong'); full.textContent = was.lastChild.textContent; price.textContent = ''; price.appendChild(full); }
      if (badge) { badge.textContent = card.getAttribute('data-type') || ''; badge.className = 'badge badge--outline'; }
      card.removeAttribute('data-ends');
    });
  })();

  /* --- product names in the menu preview ---------------------------------
     The visible names of a row are sized together, so a row never mixes sizes:
       - if the longest fits at full size, nothing changes;
       - if it needs a little less, the whole row steps down to that size;
       - if it would need to go under the floor, the row keeps full size and takes two lines. */
  function fitNames() {
    $$('.menu-cards').forEach(function (row) {
      var names = $$('.product-card__name', row);
      row.classList.remove('is-two-line');
      names.forEach(function (el) { el.style.fontSize = ''; });
      var shown = names.filter(function (el) { return el.offsetParent; });
      if (!shown.length) return;
      var base = parseFloat(getComputedStyle(shown[0]).fontSize);
      var floor = Math.min(15, base * 0.96);
      var need = base;
      shown.forEach(function (el) {
        // measure the text itself: an element with text-overflow reports a stale scrollWidth
        var range = doc.createRange();
        range.selectNodeContents(el);
        var text = range.getBoundingClientRect().width, room = el.clientWidth;
        if (text > room) need = Math.min(need, base * (room - 1) / text);
      });
      if (need >= base) return;
      if (need < floor) { row.classList.add('is-two-line'); return; }
      var size = Math.floor(need * 2) / 2 + 'px';
      shown.forEach(function (el) { el.style.fontSize = size; });
    });
  }
  (function () {
    if (!$('.product-card__name')) return;
    fitNames();
    // The names are measured in the web font, which can arrive after this script has run:
    // fonts.ready can resolve before any font has even started loading, so listen for each
    // batch that finishes and once more when the whole page has loaded.
    if (doc.fonts) {
      if (doc.fonts.ready) doc.fonts.ready.then(function () { fitNames(); });
      if (doc.fonts.addEventListener) doc.fonts.addEventListener('loadingdone', function () { fitNames(); });
    }
    window.addEventListener('load', function () { fitNames(); });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fitNames, 150); });
  })();

  /* --- live-menu preview tabs -------------------------------------------- */
  (function menuTabs() {
    $$('[data-menu-preview]').forEach(function (root) {
      var tabs = $$('[role="tab"]', root), panel = $('[role="tabpanel"]', root);
      if (!tabs.length || !panel) return;
      var cards = $$('.product-card', panel);
      function select(tab, focus) {
        var f = tab.getAttribute('data-filter');
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
        });
        cards.forEach(function (c) { c.hidden = f === 'all' ? !c.hasAttribute('data-featured') : c.getAttribute('data-cat') !== f; });
        panel.setAttribute('aria-labelledby', tab.id);
        panel.scrollLeft = 0;
        fitNames();
        if (focus) tab.focus();
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab); });
        tab.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
          else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
          else if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
        });
      });
    });
  })();

  /* --- forms --------------------------------------------------------------
     A static build has nowhere to deliver a message. Until the form is given a real
     action, say so plainly instead of pretending it was sent. Wiring an action in
     (action="https://…") switches this off. */
  (function forms() {
    $$('form[data-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        if (form.getAttribute('action')) return;
        e.preventDefault();
        var note = $('[data-form-status]', form) || $('.form-note', form);
        if (note) note.hidden = false;
        if (!note) {
          note = doc.createElement('p');
          note.className = 'form-note';
          note.setAttribute('role', 'status');
          form.appendChild(note);
        }
        note.textContent = 'This form is not connected yet, so your message was not sent. Please call (908) 242-5119.';
        note.focus && note.setAttribute('tabindex', '-1');
        note.focus();
      });
    });
  })();

  /* --- reviews row on phones: the long review ---------------------------------
     Opening it lengthens that card only: the others keep the height the row had. Once its card has been swiped
     out of view it folds again, so the row does not stay tall with blank space under the shorter reviews. */
  (function longReview() {
    var more = $('.reviews__more'), row = $('.reviews__list');
    if (!more || !row) return;
    var card = more.closest('.reviews__item');
    $('summary', more).addEventListener('click', function () { if (!more.open) row.style.setProperty('--reviews-row', row.clientHeight + 'px'); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (more.open && es[0].intersectionRatio < 0.2 && row.scrollWidth > row.clientWidth + 4) more.open = false; }, { root: row, threshold: [0, 0.2] }).observe(card);
  })();

  /* --- shop page: offers carousel ---------------------------------------------
     The row is a sideways snap row and works without this. Script adds the two arrows, the counter and a
     slow auto-advance that waits while the pointer or keyboard is on it or the tab is hidden, never starts
     under reduced motion, and stops for good once the visitor uses the arrows, swipes, or presses pause. */
  (function carousel() {
    $$('[data-carousel]').forEach(function (root) {
      var track = $('[data-carousel-track]', root), slides = $$('[data-carousel-slide]', root), bar = $('[data-carousel-bar]', root);
      if (!track || !bar || slides.length < 2) return;
      var prev = $('[data-carousel-prev]', bar), next = $('[data-carousel-next]', bar), count = $('[data-carousel-count]', bar), toggle = $('[data-carousel-toggle]', bar), status = $('[data-carousel-status]', bar);
      var n = slides.length, i = 0, timer = null, playing = false, held = false, auto = false;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      slides.forEach(function (s, k) { s.setAttribute('role', 'group'); s.setAttribute('aria-roledescription', 'slide'); s.setAttribute('aria-label', 'Offer ' + (k + 1) + ' of ' + n); });
      function show() { count.textContent = (i + 1) + ' / ' + n; }
      function go(k, smooth) { i = (k + n) % n; track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' }); show(); }
      function label() { toggle.setAttribute('aria-label', playing ? 'Pause the offers' : 'Play the offers'); $('use', toggle).setAttribute('href', playing ? '#i-pause' : '#i-play'); }
      function stop() { playing = false; clearInterval(timer); label(); }
      function play() { if (reduce || playing) return; playing = true; timer = setInterval(function () { if (!held && !doc.hidden) { auto = true; go(i + 1, true); } }, 6000); label(); }
      function byHand(k) { stop(); go(k, true); if (status) status.textContent = 'Offer ' + (i + 1) + ' of ' + n; }
      prev.addEventListener('click', function () { byHand(i - 1); });
      next.addEventListener('click', function () { byHand(i + 1); });
      toggle.addEventListener('click', function () { if (playing) stop(); else play(); });
      var t; track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(function () { i = Math.round(track.scrollLeft / track.clientWidth); auto = false; show(); }, 140); }, { passive: true });
      track.addEventListener('touchstart', stop, { passive: true });   // a swipe is the visitor taking over
      track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); byHand(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); byHand(i - 1); } });
      root.addEventListener('mouseenter', function () { held = true; }); root.addEventListener('mouseleave', function () { held = false; });
      root.addEventListener('focusin', function () { held = true; }); root.addEventListener('focusout', function () { held = false; });
      window.addEventListener('resize', function () { go(i, false); });
      bar.hidden = false; toggle.hidden = reduce; show(); label();
      play();
    });
  })();

  /* --- phone action bar: appears once the hero buttons scroll away -------- */
  (function mobileBar() {
    var bar = $('.mobile-bar');
    if (!bar) return;
    // The bar repeats what the page's own first buttons or tiles do, so it waits until those have scrolled away.
    var anchor = $$('.hero__cta, .visitpage__actions, .shop-offers').filter(function (e) { return e.offsetParent; })[0] || $$('.visitpage .visit-facts__item--link').pop();
    if (!anchor || !('IntersectionObserver' in window)) { bar.classList.add('is-visible'); return; }
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      bar.classList.toggle('is-visible', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(anchor);
  })();

  /* --- reveal on scroll --------------------------------------------------- */
  (function reveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // reveal-init.js set the mark before paint. If it has already given up waiting and removed it,
    // everything is showing: do not hide it all again.
    if (!doc.documentElement.classList.contains('has-reveal')) return;
    window.__ghReveal = true;                       // tells reveal-init.js the observer is live
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  })();
})();
