/* site.js — Craft Cannabis home. Vanilla, deferred, no dependencies.
   Age gate, cookie notice, sticky glass header, mobile drawer, keyboard dropdowns, header search,
   hero crossfade, product rails, FAQ disclosure, reveal-on-scroll. Motion honours reduced-motion.
   Every feature runs in its own guarded part: one failure never takes the others down, and nothing
   is hidden by CSS until the part that reveals it has actually started. */
(() => {
  'use strict';
  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 1024px)');
  const searchCollapses = window.matchMedia('(max-width: 1365px)'); // same breakpoint as site.css
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: session-only */ } },
  };
  const part = (name, fn) => { try { fn(); } catch (err) { if (window.console) console.warn('[site] ' + name + ' skipped:', err); } };
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  function trapTab(container, e) {
    const items = [...container.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (doc.activeElement === first || !container.contains(doc.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (doc.activeElement === last || !container.contains(doc.activeElement))) { e.preventDefault(); first.focus(); }
  }

  // everything outside a modal becomes inert while the modal is open
  const pageRegions = () => ['.skip-link', '.site-header', '.chipbar', '#content', '.site-footer', '#cookie']
    .map((s) => doc.querySelector(s)).filter(Boolean);
  let inertOwners = 0;
  function setInert(on) {
    inertOwners = Math.max(0, inertOwners + (on ? 1 : -1));
    const inert = inertOwners > 0;
    pageRegions().forEach((el) => { if (inert) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }

  /* ---------------------------------------------------------------- age gate */
  part('age gate', () => {
    const gate = doc.querySelector('[data-gate]');
    if (!gate) return;
    const card = gate.querySelector('.gate-card');
    const form = gate.querySelector('[data-gate-form]');
    const yes = gate.querySelector('[data-gate-yes]');
    let lastButton = null;
    let returnFocus = null;
    const onKey = (e) => {
      if (e.key === 'Tab') trapTab(card, e);
      else if (e.key === 'Escape') e.preventDefault(); // the question must be answered
    };
    // A press on the backdrop (or the overlay's padding) must not move focus out of the dialog:
    // cancel the focus-moving default, and if focus escapes anyway, put it back on the dialog.
    const holdFocus = (e) => { if (!card.contains(e.target)) e.preventDefault(); };
    const onFocusIn = (e) => { if (!card.contains(e.target)) card.focus({ preventScroll: true }); };
    const open = () => {
      returnFocus = doc.activeElement;
      body.classList.add('gate-open');
      setInert(true);
      doc.addEventListener('keydown', onKey);
      doc.addEventListener('focusin', onFocusIn);
      gate.addEventListener('pointerdown', holdFocus);
      gate.addEventListener('mousedown', holdFocus);
      window.requestAnimationFrame(() => yes.focus({ preventScroll: true }));
    };
    const close = () => {
      gate.classList.add('is-closed');
      root.classList.add('age-ok'); // also releases the cookie notice (CSS)
      body.classList.remove('gate-open');
      setInert(false);
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('focusin', onFocusIn);
      gate.removeEventListener('pointerdown', holdFocus);
      gate.removeEventListener('mousedown', holdFocus);
      if (returnFocus && returnFocus !== body && doc.contains(returnFocus) && visible(returnFocus)) returnFocus.focus({ preventScroll: true });
      else if (doc.activeElement && gate.contains(doc.activeElement)) doc.activeElement.blur();
    };
    form.querySelectorAll('button[type="submit"]').forEach((b) => b.addEventListener('click', () => { lastButton = b; }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = e.submitter || lastButton;
      if (btn && btn.hasAttribute('data-gate-yes')) {
        store.set('cc-age-ok', '1');
        close();
        return;
      }
      // "No": the gate stays; a small shake acknowledges the answer
      card.classList.remove('is-shake');
      void card.offsetWidth;
      if (!reduce.matches) card.classList.add('is-shake');
    });
    if (root.classList.contains('age-ok') || store.get('cc-age-ok') === '1') {
      gate.classList.add('is-closed');
      root.classList.add('age-ok');
    } else {
      open();
    }
  });

  /* ---------------------------------------------------------------- cookie notice */
  part('cookie', () => {
    const cookie = doc.querySelector('[data-cookie]');
    if (!cookie) return;
    if (store.get('cc-cookie-ok') === '1') root.classList.add('cookie-ok');
    // While the notice is on screen, publish its footprint (height + gap to the viewport bottom) as
    // --cookie-h and flag html.cookie-showing: site.css turns that into scroll-margin-bottom on the
    // focusable controls of main + footer, so a focused control is never scrolled in behind the bar.
    // The ResizeObserver also sees the notice appear (age question answered) and disappear (dismissed).
    const reserve = () => {
      const showing = cookie.getClientRects().length > 0;
      if (showing) {
        const h = cookie.offsetHeight + (parseFloat(getComputedStyle(cookie).bottom) || 0);
        root.style.setProperty('--cookie-h', `${Math.ceil(h)}px`);
      } else {
        root.style.removeProperty('--cookie-h');
      }
      root.classList.toggle('cookie-showing', showing);
    };
    if ('ResizeObserver' in window) new ResizeObserver(reserve).observe(cookie);
    window.addEventListener('resize', reserve, { passive: true });
    reserve();
    // "Accept" and the icon-only close ("No") both dismiss the notice and remember it
    const dismiss = (btn) => {
      store.set('cc-cookie-ok', '1');
      const hadFocus = doc.activeElement === btn;
      cookie.classList.add('is-dismissed');
      root.classList.add('cookie-ok');
      reserve();
      if (hadFocus) doc.getElementById('content').focus({ preventScroll: true });
    };
    cookie.querySelectorAll('[data-cookie-accept], [data-cookie-close]').forEach((btn) => btn.addEventListener('click', () => dismiss(btn)));
  });

  /* ---------------------------------------------------------------- header: glass on scroll */
  const header = doc.querySelector('[data-header]');
  part('header', () => {
    if (!header) return;
    let ticking = false;
    const sync = () => { header.classList.toggle('is-stuck', window.scrollY > (desktop.matches ? 44 : 4)); ticking = false; };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; window.requestAnimationFrame(sync); } }, { passive: true });
    desktop.addEventListener('change', sync);
    sync();
  });

  /* ---------------------------------------------------------------- header search (collapsed < 1366px) */
  part('search', () => {
    const searchToggle = doc.querySelector('[data-search-toggle]');
    if (!searchToggle || !header) return;
    const form = doc.getElementById('site-search');
    const input = doc.getElementById('search-input');
    const isOpen = () => header.classList.contains('search-open');
    const inWidget = (el) => !!el && (form.contains(el) || searchToggle.contains(el));
    const setSearch = (open) => {
      header.classList.toggle('search-open', open);
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
    };
    // a press on the toggle must not first collapse the field via focusout (Safari never focuses
    // buttons on click, so relatedTarget is null there) and then re-open it on click
    let pressingToggle = false;
    searchToggle.addEventListener('pointerdown', () => { pressingToggle = true; });
    const release = () => window.setTimeout(() => { pressingToggle = false; }, 0); // runs after the click
    doc.addEventListener('pointerup', release);
    doc.addEventListener('pointercancel', release);
    searchToggle.addEventListener('click', () => { pressingToggle = false; setSearch(!isOpen()); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchCollapses.matches) { setSearch(false); searchToggle.focus(); } });
    // collapse on a press anywhere outside the search widget …
    doc.addEventListener('pointerdown', (e) => {
      if (isOpen() && searchCollapses.matches && !inWidget(e.target)) setSearch(false);
    });
    // … and when keyboard focus leaves it with nothing typed
    const onFocusOut = (e) => {
      if (!isOpen() || !searchCollapses.matches || pressingToggle || inWidget(e.relatedTarget)) return;
      if (input.value.trim() === '') setSearch(false);
    };
    form.addEventListener('focusout', onFocusOut);
    searchToggle.addEventListener('focusout', onFocusOut);
    searchCollapses.addEventListener('change', () => setSearch(false));
  });

  /* ---------------------------------------------------------------- dropdowns (desktop + drawer) */
  part('dropdowns', () => {
    const subItems = [...doc.querySelectorAll('[data-sub]')];
    // per item: whether it is pinned open (by a click, or by the keyboard). An unpinned open menu was
    // opened by hover; a pinned one survives the pointer leaving.
    const state = new Map(subItems.map((item) => [item, { pinned: false }]));
    const setSub = (item, open) => {
      const btn = item.querySelector('.sub-toggle');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (!open) state.get(item).pinned = false;
    };
    // Only one desktop panel is ever open. A panel that holds keyboard focus hands focus back to its
    // own toggle before it hides, so the keyboard user keeps their place (never dropped to <body>)
    // when the mouse drifts over the other menu.
    const holdsFocus = (o) => { const panel = o.querySelector('.submenu'); return !!panel && panel.contains(doc.activeElement); };
    // Switching menus hides the old panel at once (no fade-out overlapping the incoming panel).
    const closeOthers = (item) => subItems.filter((o) => o !== item && !o.classList.contains('drawer-group') && o.classList.contains('is-open')).forEach((o) => {
      if (holdsFocus(o)) o.querySelector('.sub-toggle').focus({ preventScroll: true });
      o.classList.add('is-switching');
      setSub(o, false);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => o.classList.remove('is-switching')));
    });
    subItems.forEach((item) => {
      const btn = item.querySelector('.sub-toggle');
      const inDrawer = item.classList.contains('drawer-group');
      const st = state.get(item);
      btn.addEventListener('click', (e) => {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        // A pointer click (detail > 0) on an open menu that is not pinned yet (hover opened it) pins it,
        // however long after the hover it lands — it never closes it. Only a click on a PINNED menu
        // closes. Keyboard activation (detail 0) always toggles.
        if (!inDrawer && isOpen && e.detail > 0 && !st.pinned) {
          st.pinned = true;
          return;
        }
        const open = !isOpen;
        if (!inDrawer) closeOthers(item);
        setSub(item, open);
        if (open && !inDrawer) {
          st.pinned = true;
          // keyboard: move into the menu. Mouse: focus stays put (no focus parked inside the panel).
          if (e.detail === 0) { const firstLink = item.querySelector('.submenu a'); if (firstLink) window.requestAnimationFrame(() => firstLink.focus()); }
        }
      });
      // Desktop hover is driven HERE, not by CSS :hover, so .is-open and aria-expanded always
      // describe what is on screen. Mouse only (touch taps use the toggle); a short grace period
      // covers the gap to the panel. A menu pinned by a click stays until dismissed.
      if (!inDrawer) {
        let leaveTimer = 0;
        item.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse') return;
          window.clearTimeout(leaveTimer);
          if (!item.classList.contains('is-open')) { closeOthers(item); setSub(item, true); }
        });
        item.addEventListener('pointerleave', (e) => {
          if (e.pointerType !== 'mouse') return;
          window.clearTimeout(leaveTimer);
          // pinned menus and KEYBOARD focus inside keep it open (focus left by a mouse click does not)
          leaveTimer = window.setTimeout(() => { if (!st.pinned && !item.querySelector(':focus-visible')) setSub(item, false); }, 160);
        });
      }
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && item.classList.contains('is-open')) { e.stopPropagation(); setSub(item, false); btn.focus(); }
        if (!inDrawer && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && item.classList.contains('is-open')) {
          const links = [...item.querySelectorAll('.submenu a')];
          const i = links.indexOf(doc.activeElement);
          if (i === -1 && e.key === 'ArrowDown') { e.preventDefault(); links[0].focus(); }
          else if (i > -1) { e.preventDefault(); links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus(); }
        }
      });
      if (!inDrawer) item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) setSub(item, false); });
    });
    doc.addEventListener('click', (e) => {
      subItems.forEach((item) => { if (!item.classList.contains('drawer-group') && item.classList.contains('is-open') && !item.contains(e.target)) setSub(item, false); });
    });
  });

  /* ---------------------------------------------------------------- phone/tablet category chips */
  // Tabbing along the strip: bring the focused chip FULLY into view inside the faded edges (the
  // track's padding), by the shortest move (inline 'nearest'); the browser's own focus scrolling
  // leaves a half-visible chip where it is. Horizontal only, like the product rails: the page's
  // vertical scroll stays with the browser.
  part('chips', () => {
    const strip = doc.querySelector('.chip-track');
    if (!strip) return;
    strip.addEventListener('focusin', (e) => {
      const chip = e.target.closest('.chip-link');
      if (!chip) return;
      window.requestAnimationFrame(() => {
        const t = strip.getBoundingClientRect();
        const r = chip.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
        const over = r.left < t.left + pad ? r.left - (t.left + pad) : r.right > t.right - pad ? r.right - (t.right - pad) : 0;
        if (Math.abs(over) > 0.5) strip.scrollTo({ left: strip.scrollLeft + over, behavior: reduce.matches ? 'auto' : 'smooth' });
      });
    });
  });

  /* ---------------------------------------------------------------- drawer */
  part('drawer', () => {
    const drawer = doc.getElementById('drawer');
    const scrim = doc.querySelector('.drawer-scrim');
    const drawerOpen = doc.querySelector('[data-drawer-open]');
    if (!drawer || !scrim || !drawerOpen) return;
    let hideTimer = 0;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
      else if (e.key === 'Tab') trapTab(drawer, e);
    };
    function openDrawer() {
      window.clearTimeout(hideTimer);
      drawer.hidden = false;
      scrim.hidden = false;
      void drawer.offsetWidth;
      body.classList.add('drawer-open');
      drawerOpen.setAttribute('aria-expanded', 'true');
      setInert(true);
      doc.addEventListener('keydown', onKey);
      const first = drawer.querySelector('.drawer-cat');
      window.requestAnimationFrame(() => (first || drawer).focus({ preventScroll: true }));
    }
    function closeDrawer(restore = true) {
      if (!body.classList.contains('drawer-open')) return;
      body.classList.remove('drawer-open');
      drawerOpen.setAttribute('aria-expanded', 'false');
      setInert(false);
      doc.removeEventListener('keydown', onKey);
      hideTimer = window.setTimeout(() => { drawer.hidden = true; scrim.hidden = true; }, reduce.matches ? 0 : 400);
      if (restore) drawerOpen.focus({ preventScroll: true });
    }
    drawerOpen.addEventListener('click', openDrawer);
    doc.querySelectorAll('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => closeDrawer()));
    desktop.addEventListener('change', (e) => { if (e.matches) closeDrawer(false); });
  });

  /* ---------------------------------------------------------------- hero crossfade + next preview */
  part('hero', () => {
    const heroEl = doc.querySelector('[data-hero]');
    if (!heroEl) return;
    const slides = [...heroEl.querySelectorAll('.hero-slide')];
    const dots = [...heroEl.querySelectorAll('[data-dot]')];
    const peeks = [...heroEl.querySelectorAll('[data-peek]')];
    const nextBtn = heroEl.querySelector('[data-hero-next]');
    const pause = heroEl.querySelector('[data-hero-pause]');
    let index = 0;
    let timer = 0;
    let userPaused = false;
    let hovering = false;
    const go = (n) => {
      slides[index].classList.remove('is-active');
      dots[index].classList.remove('is-active');
      dots[index].setAttribute('aria-current', 'false');
      index = (n + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      dots[index].classList.add('is-active');
      dots[index].setAttribute('aria-current', 'true');
      const next = (index + 1) % slides.length;
      peeks.forEach((p, k) => p.classList.toggle('is-next', k === next));
    };
    const stop = () => { window.clearInterval(timer); timer = 0; };
    const start = () => {
      stop();
      if (reduce.matches || userPaused || hovering || doc.hidden || slides.length < 2) return;
      timer = window.setInterval(() => go(index + 1), 6500);
    };
    dots.forEach((d) => d.addEventListener('click', () => { go(Number(d.dataset.dot)); start(); }));
    if (nextBtn) nextBtn.addEventListener('click', () => { go(index + 1); start(); });
    if (pause) {
      const syncPause = () => { pause.hidden = reduce.matches; };
      syncPause();
      reduce.addEventListener('change', () => { syncPause(); start(); });
      // a toggle button: the name stays "Pause", aria-pressed carries the state (never swap both)
      pause.addEventListener('click', () => {
        userPaused = !userPaused;
        pause.setAttribute('aria-pressed', String(userPaused));
        start();
      });
    }
    heroEl.addEventListener('pointerenter', () => { hovering = true; stop(); });
    heroEl.addEventListener('pointerleave', () => { hovering = false; start(); });
    heroEl.addEventListener('focusin', () => { hovering = true; stop(); });
    heroEl.addEventListener('focusout', (e) => { if (!heroEl.contains(e.relatedTarget)) { hovering = false; start(); } });
    doc.addEventListener('visibilitychange', start);
    start();
  });

  /* ---------------------------------------------------------------- product rails */
  // Off-screen cards sit to the RIGHT of the viewport, so native lazy-loading would only start
  // fetching them mid-swipe. Near the viewport: warm the first cards; on first interaction with a
  // rail (pointer, focus, touch, scroll): warm the whole row. Data cost stays proportional to intent.
  part('rail warm-up', () => {
    // the blurred backdrop is the same URL as its card's photo, so warming it costs no extra request
    const warmRail = (rail, limit = Infinity) => {
      [...rail.querySelectorAll('.card-media')].slice(0, limit).forEach((m) => m.querySelectorAll('img').forEach((im) => { if (im.loading === 'lazy') im.loading = 'eager'; }));
    };
    doc.querySelectorAll('[data-rail]').forEach((rail) => {
      const section = rail.closest('section') || rail;
      const all = () => warmRail(rail);
      ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => section.addEventListener(ev, all, { once: true, passive: true }));
      rail.querySelector('.rail-track').addEventListener('scroll', all, { once: true, passive: true });
    });
    if ('IntersectionObserver' in window) {
      const warm = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { warmRail(en.target, 6); warm.unobserve(en.target); } });
      }, { rootMargin: '600px 0px' });
      doc.querySelectorAll('[data-rail]').forEach((rail) => warm.observe(rail));
    } else {
      doc.querySelectorAll('[data-rail]').forEach((rail) => warmRail(rail));
    }
  });
  part('rails', () => {
    doc.querySelectorAll('[data-rail]').forEach((rail) => {
      const track = rail.querySelector('.rail-track');
      const section = rail.closest('section');
      const prev = section.querySelector('[data-rail-prev]');
      const next = section.querySelector('[data-rail-next]');
      const bar = rail.querySelector('.rail-progress');
      const items = [...track.children];
      items.forEach((li, k) => li.style.setProperty('--d', `${Math.min(k, 6) * 70}ms`));
      // geometry in track coordinates: the content column is the track minus its start padding (the
      // edge) on both sides; one card step = card width + gap
      const geo = () => {
        const cs = getComputedStyle(track);
        const edge = parseFloat(cs.paddingLeft) || 0;
        const gap = parseFloat(cs.columnGap) || 0;
        const first = items[0].getBoundingClientRect();
        const last = items[items.length - 1].getBoundingClientRect();
        return { edge, unit: first.width + gap, gap, content: track.clientWidth - 2 * edge, span: last.right - first.left };
      };
      // one page = as many whole cards as the content column shows, so every page lands on a snap point
      const pageStep = () => {
        if (!items.length) return track.clientWidth;
        const g = geo();
        return Math.max(1, Math.floor((g.content + g.gap + 0.5) / g.unit)) * g.unit;
      };
      // End padding: make the furthest scroll position a whole number of card steps. Without it the end
      // is wherever the last card happens to meet the edge, and paging there leaves the card before it
      // cut at the content edge. With it, the last page starts on a card like every other page (the
      // spare room shows as calm space after the last card, inside the column).
      const fitEnd = () => {
        if (!items.length) return;
        const g = geo();
        const need = g.span - g.content;              // scroll needed to show the last card whole
        const steps = need > 0 ? Math.ceil(need / g.unit - 1e-3) : 0;
        const extra = need > 0 ? Math.max(0, steps * g.unit - need) : 0;
        track.style.setProperty('--end-pad', `${extra.toFixed(2)}px`);
      };
      fitEnd();
      if ('ResizeObserver' in window) new ResizeObserver(() => { fitEnd(); update(); }).observe(track, { box: 'border-box' });
      else window.addEventListener('resize', fitEnd, { passive: true });
      const behavior = () => (reduce.matches ? 'auto' : 'smooth');
      const off = (btn) => btn.getAttribute('aria-disabled') === 'true';
      if (prev) prev.addEventListener('click', () => { if (!off(prev)) track.scrollBy({ left: -pageStep(), behavior: behavior() }); });
      if (next) next.addEventListener('click', () => { if (!off(next)) track.scrollBy({ left: pageStep(), behavior: behavior() }); });
      // keyboard on the focused track: arrows scroll natively; add paging and ends
      track.addEventListener('keydown', (e) => {
        if (e.target !== track || e.altKey || e.ctrlKey || e.metaKey) return;
        const max = track.scrollWidth - track.clientWidth;
        const moves = { Home: () => track.scrollTo({ left: 0, behavior: behavior() }), End: () => track.scrollTo({ left: max, behavior: behavior() }),
          PageDown: () => track.scrollBy({ left: pageStep(), behavior: behavior() }), PageUp: () => track.scrollBy({ left: -pageStep(), behavior: behavior() }) };
        if (moves[e.key]) { e.preventDefault(); moves[e.key](); }
      });
      let ticking = false;
      const update = () => {
        ticking = false;
        const max = track.scrollWidth - track.clientWidth;
        const x = Math.abs(track.scrollLeft);
        if (prev) prev.setAttribute('aria-disabled', String(x <= 2));
        if (next) next.setAttribute('aria-disabled', String(x >= max - 2));
        if (bar) {
          const ratio = Math.min(1, track.clientWidth / track.scrollWidth);
          const t = max > 0 ? x / max : 0;
          bar.style.setProperty('--thumb', `${(ratio * 100).toFixed(2)}%`);
          bar.style.setProperty('--offset', `${(t * (1 / ratio - 1) * 100).toFixed(2)}%`);
        }
      };
      // Keyboard focus on a card that is not fully in view: bring THAT card fully into view, aligned
      // to the rail's start edge (scroll-padding), so Tab walks card by card and none is skipped.
      track.addEventListener('focusin', (e) => {
        const item = e.target.closest('.rail-item');
        if (!item || !track.contains(item)) return;
        let visibleFocus = true;
        try { visibleFocus = e.target.matches(':focus-visible'); } catch (err) { /* old engine: assume keyboard */ }
        if (!visibleFocus) return; // a mouse click on a link must not slide the rail under the pointer
        // Horizontal only: the TRACK scrolls; the page's vertical position is left to the browser's own
        // focus scrolling (which honours scroll-margin, e.g. the cookie notice's reserved height). A
        // smooth scrollIntoView() would also animate the page and could carry the NEXT focused control
        // off screen if the user keeps tabbing.
        window.requestAnimationFrame(() => {
          const t = track.getBoundingClientRect();
          const r = item.getBoundingClientRect();
          if (r.left >= t.left - 1 && r.right <= t.right + 1) return; // already fully visible
          const edge = parseFloat(getComputedStyle(track).paddingLeft) || 0;
          track.scrollTo({ left: track.scrollLeft + (r.left - (t.left + edge)), behavior: behavior() });
        });
      });
      track.addEventListener('scroll', () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
      window.addEventListener('resize', update, { passive: true });
      update();
    });
  });

  /* ---------------------------------------------------------------- FAQ disclosure */
  part('faq', () => {
    const qas = [...doc.querySelectorAll('[data-qa]')];
    // One answer open at a time, so opening a question can collapse an answer ABOVE it. Hold the
    // clicked question still in the viewport while panels animate: every frame, scroll the page by
    // however far it drifted (reads layout first, so the correction lands in the same paint).
    let pinFrame = 0;
    const pin = (el) => {
      window.cancelAnimationFrame(pinFrame);
      const top0 = el.getBoundingClientRect().top;
      const until = performance.now() + 750;
      const step = (now) => {
        const drift = el.getBoundingClientRect().top - top0;
        if (Math.abs(drift) >= 0.5) window.scrollBy(0, drift);
        if (now < until) pinFrame = window.requestAnimationFrame(step);
      };
      pinFrame = window.requestAnimationFrame(step);
    };
    qas.forEach((qa) => {
      const btn = qa.querySelector('.qa-btn');
      btn.addEventListener('click', () => {
        pin(btn);
        const open = btn.getAttribute('aria-expanded') !== 'true';
        qas.forEach((o) => {
          if (o !== qa && o.classList.contains('is-open')) {
            o.classList.remove('is-open');
            o.querySelector('.qa-btn').setAttribute('aria-expanded', 'false');
          }
        });
        qa.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
    });
    if (qas.length) root.classList.add('qa-ready'); // only now may closed answers collapse
  });

  /* ---------------------------------------------------------------- reveal on scroll (fail-safe) */
  part('reveal', () => {
    if (!('IntersectionObserver' in window) || reduce.matches) return; // nothing was ever hidden
    const revealables = [...doc.querySelectorAll('.reveal, [data-rail]')];
    // sibling stagger: consecutive .reveal siblings enter 90ms apart
    doc.querySelectorAll('.reveal').forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      const i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty('--d', `${i * 90}ms`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    // Same task: turn hiding on, and immediately mark what is already on screen, so nothing that
    // has painted can blink out. Everything else waits for the observer.
    root.classList.add('reveal-on');
    const vh = window.innerHeight || root.clientHeight;
    revealables.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.classList.add('is-in');
      else io.observe(el);
    });
  });
})();
