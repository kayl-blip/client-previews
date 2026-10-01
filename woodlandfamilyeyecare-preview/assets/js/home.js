(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var head = document.querySelector('[data-head]');
  function measure() { if (head) doc.style.setProperty('--head-h', (head.offsetHeight + 14) + 'px'); }
  measure();
  if (head && 'ResizeObserver' in window) new ResizeObserver(measure).observe(head);
  var stuck = false;
  function onScroll() { var s = window.scrollY > 30; if (s !== stuck && head) { stuck = s; head.classList.toggle('is-stuck', s); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var items = Array.prototype.slice.call(document.querySelectorAll('.nav-item.has-sub'));
  function closeAll(except) {
    items.forEach(function (li) {
      if (li === except) return;
      li.classList.remove('is-open');
      var b = li.querySelector('.sub-toggle'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  items.forEach(function (li) {
    var btn = li.querySelector('.sub-toggle'); if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !li.classList.contains('is-open');
      closeAll(li); li.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
    });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) { li.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); } });
  });
  document.addEventListener('click', function () { closeAll(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = items.filter(function (li) { return li.classList.contains('is-open'); })[0];
    if (open) { closeAll(null); var b = open.querySelector('.sub-toggle'); if (b) b.focus(); }
  });

  var burger = document.querySelector('.burger');
  var drawer = document.getElementById('drawer');
  var last = null;
  function focusables() { return drawer.querySelectorAll('a[href], button, summary'); }
  function openDrawer() { last = document.activeElement; drawer.hidden = false; burger.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; var f = focusables(); if (f.length) f[0].focus(); }
  function closeDrawer() { drawer.hidden = true; burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; if (last) last.focus(); }
  if (burger && drawer) {
    burger.addEventListener('click', openDrawer);
    drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.closest('[data-close]')) closeDrawer(); });
    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('resize', function () { if (!drawer.hidden && window.innerWidth > 1100) closeDrawer(); });
  }

  var reveal = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  if (reduce || !('IntersectionObserver' in window)) reveal.forEach(function (el) { el.classList.add('is-in'); });
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveal.forEach(function (el) { io.observe(el); });
  }

  Array.prototype.slice.call(document.querySelectorAll('.uq-panels')).forEach(function (wrap) {
    var panels = Array.prototype.slice.call(wrap.querySelectorAll('.uq-panel'));
    var wide = window.matchMedia ? window.matchMedia('(min-width: 1101px)') : { matches: true };
    function activate(p) { panels.forEach(function (x) { x.classList.toggle('is-active', x === p); }); }
    panels.forEach(function (p) {
      p.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && wide.matches) activate(p); });
      p.addEventListener('focusin', function () { activate(p); });
      p.addEventListener('click', function (e) { if (wide.matches && !p.classList.contains('is-active')) { e.preventDefault(); activate(p); } });
    });
  });

  (function () {
    var chat = document.querySelector('.qa-chat');
    var thread = chat && chat.querySelector('.chat-thread');
    var msgs = thread ? Array.prototype.slice.call(thread.querySelectorAll('.msg')) : [];
    if (!msgs.length) return;

    var T = { lead: 200, qType: 450, aType: 700, grow: 380, qHold: 450, aHoldBase: 900, perChar: 5, aHoldMax: 2600, endHold: 1200, up: 1600, topHold: 900, down: 1500, downHold: 900, fade: 450 };
    var typing = document.createElement('li');
    typing.className = 'typing'; typing.setAttribute('aria-hidden', 'true');
    typing.innerHTML = '<span class="typing-bubble"><i></i><i></i><i></i></span>';
    thread.appendChild(typing);
    var dots = Array.prototype.slice.call(typing.querySelectorAll('i'));
    var plan = [], heights = [], typingH = 0, P = {}, total = 0;
    var ease = function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
    var clamp = function (x) { return Math.max(0, Math.min(1, x)); };

    function build() {
      chat.classList.add('is-anim');
      msgs.concat(typing).forEach(function (m) { m.style.maxHeight = 'none'; m.style.opacity = '1'; m.style.transform = 'none'; m.style.marginTop = '0px'; });
      heights = msgs.map(function (m) { return m.offsetHeight; });
      typingH = typing.offsetHeight;
      var t = T.lead;
      plan = msgs.map(function (m) {
        var q = m.classList.contains('msg-q');
        var e = { q: q, typeStart: t, appear: t + (q ? T.qType : T.aType) };
        e.hold = q ? T.qHold : Math.min(T.aHoldMax, T.aHoldBase + m.textContent.replace(/\s+/g, ' ').trim().length * T.perChar);
        t = e.appear + T.grow + e.hold;
        return e;
      });
      P.arrived = t; P.upStart = t + T.endHold; P.upEnd = P.upStart + T.up; P.downStart = P.upEnd + T.topHold;
      P.downEnd = P.downStart + T.down; P.fadeStart = P.downEnd + T.downHold; total = P.fadeStart + T.fade;
    }

    function render(t) {
      var g = t > P.fadeStart ? 1 - clamp((t - P.fadeStart) / T.fade) : 1;
      plan.forEach(function (e, i) {
        var p = clamp((t - e.appear) / T.grow), pe = ease(p), m = msgs[i];
        m.style.maxHeight = (pe * heights[i]).toFixed(2) + 'px';
        m.style.opacity = (clamp(p * 1.5) * g).toFixed(3);
        m.style.transform = 'translateY(' + ((1 - pe) * 14).toFixed(2) + 'px) scale(' + (0.97 + 0.03 * pe).toFixed(4) + ')';
      });
      var cur = null;
      plan.forEach(function (e) { if (t >= e.typeStart && t < e.appear + 140) cur = e; });
      var v = 0;
      if (cur) v = Math.min(clamp((t - cur.typeStart) / 200), t > cur.appear ? 1 - clamp((t - cur.appear) / 140) : 1);
      typing.style.maxHeight = (v * typingH).toFixed(2) + 'px';
      typing.style.opacity = v.toFixed(3);
      if (cur) { typing.classList.toggle('typing-q', cur.q); typing.classList.toggle('typing-a', !cur.q); }
      dots.forEach(function (d, k) {
        var s = Math.max(0, Math.sin(((t / 900) - k * 0.17) * Math.PI * 2));
        d.style.transform = 'translateY(' + (-5 * s).toFixed(2) + 'px)'; d.style.opacity = (0.4 + 0.6 * s).toFixed(3);
      });
      var bottom = Math.max(0, thread.scrollHeight - thread.clientHeight), s;
      if (t < P.upStart) s = bottom;
      else if (t < P.upEnd) s = bottom * (1 - ease((t - P.upStart) / T.up));
      else if (t < P.downStart) s = 0;
      else if (t < P.downEnd) s = bottom * ease((t - P.downStart) / T.down);
      else s = bottom;
      return s;
    }

    var running = false, raf = 0, start = 0, frozen = 0, blendFrom = null, blendUntil = 0, focusHold = false;
    function frame(now) {
      if (!running) return;
      var s = render((now - start) % total);
      if (blendFrom !== null && now < blendUntil) { var k = ease(1 - (blendUntil - now) / 650); s = blendFrom + (s - blendFrom) * k; } else blendFrom = null;
      thread.scrollTop = s;
      raf = requestAnimationFrame(frame);
    }
    function play() {
      if (running || focusHold) return;
      running = true; chat.classList.remove('is-paused');
      var now = performance.now(); start = now - frozen; blendFrom = thread.scrollTop; blendUntil = now + 650;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      if (!running) return;
      running = false; cancelAnimationFrame(raf);
      frozen = (performance.now() - start) % total; chat.classList.add('is-paused');
    }
    function showAll() { pause(); render(P.arrived); thread.scrollTop = 0; chat.classList.add('is-paused'); }

    window.__qaChat = { build: build, render: function (t) { var s = render(t); thread.scrollTop = s; return s; }, duration: function () { return total; }, stop: function () { running = false; cancelAnimationFrame(raf); focusHold = true; } };
    if (reduce) return;
    build();
    thread.scrollTop = render(0);
    chat.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pause(); });
    chat.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') play(); });
    chat.addEventListener('focusin', function () { focusHold = true; showAll(); });
    chat.addEventListener('focusout', function (e) { if (!chat.contains(e.relatedTarget)) { focusHold = false; play(); } });
    var resizeT = 0;
    window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { var was = running; pause(); build(); if (was) play(); else thread.scrollTop = render(frozen); }, 200); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) play(); else pause(); }); }, { threshold: 0.25 }).observe(chat);
    } else play();
  })();

  if (!reduce && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }
})();
