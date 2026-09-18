/* =============================================================================
   mobile-nav.js — the store-first drawer (revision 5, option A).

   Replaces both existing mobile nav systems. Built as an IIFE on the same
   pattern as age-gate-a11y.js and a11y-base.js: self-contained, no build step,
   one <script> per page.

   Focus handling follows what commit 497bc88 established for the age gate --
   trap while open, restore on close, mark the rest of the page inert -- because
   an overlay that does not do those things is exactly the keyboard trap that
   commit was written to remove.
   ============================================================================= */
(function () {
  'use strict';

  var S = window.NovaStores;
  if (!S) return;                       // store-context.js must load first

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
                  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  var drawer = null, panel = null, trigger = null;
  var lastFocused = null, inerted = [];

  /* ------------------------------------------------------------------ build */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function storeCard() {
    var cur = S.current();
    var btn = el('button', 'nf-store__card');
    btn.type = 'button';
    btn.setAttribute('data-nf', 'change-store');
    if (cur) {
      btn.appendChild(el('span', 'nf-store__name', cur.name + ', ' + cur.state));
      var meta = el('span', 'nf-store__meta');
      meta.appendChild(document.createTextNode(cur.type + '  ·  '));
      meta.appendChild(el('span', 'nf-store__change', 'Change'));
      btn.appendChild(meta);
      btn.setAttribute('aria-label', 'Currently shopping at ' + cur.name + ', ' + cur.state + '. Change store.');
    } else {
      btn.appendChild(el('span', 'nf-store__name', 'Choose your store'));
      btn.appendChild(el('span', 'nf-store__meta', 'See hours, deals and the menu near you'));
    }

    // The card is the drawer's headline control and it announced itself as
    // "Change store" while doing nothing at all. It now opens the Locations
    // group and moves focus to the first store, which is the store-choosing
    // affordance it was always pointing at.
    btn.addEventListener('click', function () {
      var disc = panel && panel.querySelector('#nf-d-loc');
      if (!disc) return;
      var body = panel.querySelector('#nf-p-loc');
      disc.setAttribute('aria-expanded', 'true');
      if (body) body.hidden = false;
      var first = body && body.querySelector('a');
      (first || disc).focus();
    });
    return btn;
  }

  function primaryCta() {
    var cur = S.current();
    if (cur && !S.menuPending(cur)) {
      var a = el('a', 'nf-cta', 'Shop ' + cur.name);
      a.href = cur.menu;
      return a;
    }
    // No store yet, or a store whose menu destination is still unconfirmed.
    // Say so plainly rather than shipping a link into a 403.
    var b = el('button', 'nf-cta nf-cta--pending');
    b.type = 'button';
    b.disabled = true;
    b.appendChild(document.createTextNode(cur ? 'Shop ' + cur.name : 'Shop this store'));
    b.appendChild(el('span', 'nf-cta__note',
      cur ? 'Menu link pending client confirmation' : 'Choose a store first'));
    return b;
  }

  function disclosure(id, label, buildBody) {
    var li = el('li');
    var btn = el('button', 'nf-disclosure');
    btn.type = 'button';
    btn.id = 'nf-d-' + id;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'nf-p-' + id);
    btn.appendChild(el('span', null, label));
    btn.appendChild(el('span', 'nf-disclosure__caret', '▾'));

    var body = el('div');
    body.id = 'nf-p-' + id;
    body.hidden = true;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', btn.id);
    body.appendChild(buildBody());

    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });

    li.appendChild(btn);
    li.appendChild(body);
    return li;
  }

  function row(label, href, external) {
    var li = el('li');
    var a = el('a', 'nf-row' + (external ? ' nf-external' : ''), label);
    a.href = href;
    if (external) { a.target = '_blank'; a.rel = 'noopener'; }
    li.appendChild(a);
    return li;
  }

  function locationsBody() {
    var ul = el('ul', 'nf-sub');
    var here = S.ofThisPage();
    S.all().forEach(function (s) {
      var li = el('li');
      if (s.comingSoon) {
        var span = el('span', 'nf-sub__soon', s.name + ' — coming soon');
        li.appendChild(span);
      } else {
        var a = el('a', null);
        a.href = s.page;
        a.appendChild(document.createTextNode(s.name + ', ' + s.state));
        a.appendChild(el('span', 'nf-sub__meta', s.type + ' · ' + s.address));
        if (here && here.id === s.id) a.setAttribute('aria-current', 'true');
        // Choosing from the drawer also sets the store, so the journey in
        // revision 2 starts here as well as at the gate.
        a.addEventListener('click', function () { S.select(s.id); });
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function build() {
    drawer = el('div', 'nf-drawer');
    drawer.id = 'nf-drawer';
    drawer.hidden = true;

    var scrim = el('div', 'nf-drawer__scrim');
    scrim.addEventListener('click', close);

    panel = el('div', 'nf-drawer__panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Menu');

    var x = el('button', 'nf-drawer__close', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close menu');
    x.addEventListener('click', close);
    panel.appendChild(x);

    var store = el('div', 'nf-store' + (S.current() ? '' : ' nf-store--empty'));
    store.appendChild(el('p', 'nf-store__label', 'Shopping at'));
    store.appendChild(storeCard());
    panel.appendChild(store);
    panel.appendChild(primaryCta());

    var list = el('ul', 'nf-list');
    list.appendChild(disclosure('loc', 'Locations', locationsBody));
    list.appendChild(row('Our Brands', 'brands.html'));
    // One loyalty entry by owner decision: the state is chosen on the
    // destination, which also keeps two known-403 sign-up links out of the nav.
    list.appendChild(row('Join Loyalty', 'join-vip.html'));
    list.appendChild(row('Blog', 'https://novafarms.com/blog/', true));
    panel.appendChild(list);

    // Rendered only once the accessibility panel exists, so this is never a
    // dead row in the meantime.
    if (typeof window.a11yPanelOpen === 'function') {
      var foot = el('div', 'nf-foot');
      var ab = el('button', 'nf-row', 'Accessibility');
      ab.type = 'button';
      ab.addEventListener('click', function () { close(); window.a11yPanelOpen(); });
      foot.appendChild(ab);
      panel.appendChild(foot);
    }

    drawer.appendChild(scrim);
    drawer.appendChild(panel);
    document.body.appendChild(drawer);
  }

  /* ------------------------------------------------------- open / close */
  function focusables() {
    return Array.prototype.filter.call(panel.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null && !n.disabled;
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open() {
    if (!drawer) build();
    // Rebuild the store-dependent head each time: the visitor may have chosen
    // a store since the drawer was last opened.
    refresh();
    lastFocused = document.activeElement;
    drawer.hidden = false;

    // aria-hidden alone is not enough: it hides the background from assistive
    // tech while leaving every control in it focusable, which is an
    // aria-hidden-focus violation the moment the drawer opens and lets Tab walk
    // out of the panel whenever activeElement is not exactly the first or last
    // focusable. age-gate-a11y.js sets both; this now matches it, including
    // skipping non-rendered children.
    inerted = [];
    Array.prototype.forEach.call(document.body.children, function (n) {
      if (n === drawer) return;
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'LINK') return;
      if (n.hasAttribute('data-a11y-exempt')) return;   // same exemption as the gate
      if (!n.hasAttribute('aria-hidden')) {
        n.setAttribute('aria-hidden', 'true');
        n.setAttribute('inert', '');
        inerted.push(n);
      }
    });

    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey, true);
    var f = focusables();
    if (f.length) f[0].focus();
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    inerted.forEach(function (n) {
      n.removeAttribute('aria-hidden');
      n.removeAttribute('inert');
    });
    inerted = [];
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onKey, true);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function refresh() {
    if (!panel) return;
    var store = panel.querySelector('.nf-store');
    var cta = panel.querySelector('.nf-cta');
    if (store) {
      store.className = 'nf-store' + (S.current() ? '' : ' nf-store--empty');
      var old = store.querySelector('.nf-store__card');
      if (old) store.replaceChild(storeCard(), old);
    }
    if (cta) cta.parentNode.replaceChild(primaryCta(), cta);
  }

  /* ------------------------------------------------------------- trigger */
  function mountTrigger() {
    // Put it beside the existing (now hidden) Elementor toggle so it lands
    // where the header already reserved room for a menu button.
    // employee.html and med-portal.html carry neither an .elementor-menu-toggle
    // nor an .elementor-nav-menu--main -- they ship a bespoke header with the
    // store-finder <select>. Without a fallback the drawer silently never
    // mounted on them, so "on all 47 pages" was really 45.
    var anchor = document.querySelector('.elementor-menu-toggle') ||
                 document.querySelector('nav.elementor-nav-menu--main');

    /* Above 1024 this trigger hides, because the desktop nav takes over. On
       the three bespoke-header pages there is no desktop nav to take over, so
       BOTH disappear and the page has no site navigation at all on a desktop
       screen. Measured at 1025 and 1440 on employee.html, med-portal.html and
       newbritain.html: 0 visible nav items, no trigger, and exactly 2 links in
       the whole header -- the logo and "Join Loyalty". newbritain.html is the
       New Britain shop menu, the one store menu that actually resolves, so
       this is a customer-facing page.

       The test is whether the HEADER carries a main nav, not whether the
       document does: newbritain.html has an .elementor-nav-menu--main
       elsewhere in the page but none in its header, and it was still stranded.
       The flag lets mobile-nav.css keep the trigger above 1024 on exactly
       these pages and change nothing on the other 44. */
    var hdr = document.querySelector('[data-elementor-type="header"]');
    if (!hdr || !hdr.querySelector('nav.elementor-nav-menu--main')) {
      document.documentElement.setAttribute('data-nf-no-desktop-nav', '');
    }

    trigger = el('button', 'nf-nav-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'nf-drawer');
    trigger.setAttribute('aria-label', 'Open menu');
    trigger.appendChild(el('span', 'nf-nav-trigger__bars'));
    trigger.appendChild(el('span', null, 'Menu'));
    trigger.addEventListener('click', function () {
      if (drawer && !drawer.hidden) close(); else open();
    });

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(trigger, anchor);
    } else {
      // No header anchor on this page: float the trigger so the drawer is still
      // reachable rather than absent.
      trigger.classList.add('nf-nav-trigger--floating');
      document.body.appendChild(trigger);
    }
  }

  function init() {
    if (document.querySelector('.nf-nav-trigger')) { scheduleDedupe(); return; }   // idempotent
    mountTrigger();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
  window.addEventListener('novafarms:storechange', refresh);

  /* ---------------------------------------------------------------------
     Elementor's sticky header CLONES the whole header, so this trigger exists
     TWICE in the DOM on 44 of 47 pages.

     That is NOT currently a visible defect, and an earlier version of this
     comment claimed it was. Measured properly: the clone carries
     `visibility: hidden`, so only one trigger is ever painted and only one is
     in the tab order. The first measurement missed it by testing `display` and
     height but not `visibility` -- an element can occupy 48px and still be
     invisible.

     This guard is kept as insurance, not as a fix: it guarantees that if the
     sticky clone ever becomes visible -- an Elementor update, a settings
     change -- the page still shows exactly one menu button. It recomputes on
     load, scroll and resize because which copy is live changes as the sticky
     header activates.

     Visibility is tested with getBoundingClientRect + computed display AND
     visibility, never offsetParent, which is null for position:fixed -- exactly
     what this trigger is on the pages where it floats.
     ------------------------------------------------------------------------ */
  function dedupeTriggers() {
    var all = document.querySelectorAll('.nf-nav-trigger');
    if (all.length < 2) return;
    var shown = 0;
    for (var i = 0; i < all.length; i++) {
      var t = all[i];
      t.removeAttribute('data-nf-dupe');
      var cs = window.getComputedStyle(t);
      var r = t.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.height < 1) continue;
      shown++;
      if (shown > 1) {
        t.setAttribute('data-nf-dupe', '');
        t.setAttribute('aria-hidden', 'true');
        t.setAttribute('tabindex', '-1');
      } else {
        t.removeAttribute('aria-hidden');
        t.removeAttribute('tabindex');
      }
    }
  }

  var dedupePending = false;
  function scheduleDedupe() {
    if (dedupePending) return;
    dedupePending = true;
    // setTimeout, NOT requestAnimationFrame. rAF does not fire while a document
    // is off-screen or throttled -- a background tab, or an iframe scrolled out
    // of view -- so the duplicate trigger would survive in exactly the cases
    // nobody is watching. Caught because it never ran in the test harness.
    window.setTimeout(function () { dedupePending = false; dedupeTriggers(); }, 0);
  }
  window.addEventListener('load', scheduleDedupe);
  window.addEventListener('scroll', scheduleDedupe, { passive: true });
  window.addEventListener('resize', scheduleDedupe);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleDedupe);
  } else { scheduleDedupe(); }

  window.NovaDrawer = { open: open, close: close, refresh: refresh, dedupe: dedupeTriggers };
})();
