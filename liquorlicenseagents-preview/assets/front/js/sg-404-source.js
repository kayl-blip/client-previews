/*!
 * sg-404-source.js - SGEN 404 Manager click-source attribution
 *
 * The HTTP referrer only names the source PAGE, never which link or button a
 * visitor clicked. This tiny tracker fills that gap:
 *
 *   1. On every front page it stamps the last-clicked internal link / button
 *      into sessionStorage (element text, href, a CSS locator, source page).
 *   2. When a 404 page loads, it reads that stamp and, if the click was recent,
 *      beacons it to the same-origin collector (sg-collect-404) tied to the dead
 *      path. The 404 Manager then shows the editor exactly which link/button to
 *      fix - including for "direct"-looking hits where the referrer was stripped.
 *
 * Config is injected by broken_links_client_hook.php as window.__SG404__:
 *   { url, is404 (bool), path (the dead path, when is404) }
 *
 * Dependency-free. Truly direct hits (typed URL / bookmark / external referrer
 * with no in-tab click) leave no stamp and stay unattributed - by design.
 */
(function () {
    'use strict';

    var cfg = window.__SG404__ || {};
    if (!cfg.url) { return; }

    var KEY = 'sg404src';
    var MAX_AGE_MS = 15000;   // hard ceiling: an older click didn't cause this 404
    var NAV_AGE_MS = 8000;    // tighter window for hrefless (button/JS) navigation
    var TEXT_CAP = 160;

    function normPath(p) {
        p = p || '/';
        try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
        if (p.length > 1) { p = p.replace(/\/+$/, ''); }
        return p || '/';
    }

    function hasSession() {
        try { return !!window.sessionStorage; } catch (e) { return false; }
    }

    // ---- locator: a short, human-readable path to the element ------------------
    function locator(el) {
        if (!el || el.nodeType !== 1) { return ''; }
        if (el.id) { return '#' + el.id; }
        var parts = [], node = el, depth = 0;
        while (node && node.nodeType === 1 && depth < 4 && node.tagName !== 'BODY') {
            var seg = node.tagName.toLowerCase();
            if (node.classList && node.classList.length) {
                seg += '.' + Array.prototype.slice.call(node.classList, 0, 2).join('.');
            } else if (node.parentNode) {
                var i = 1, sib = node;
                while ((sib = sib.previousElementSibling)) {
                    if (sib.tagName === node.tagName) { i++; }
                }
                seg += ':nth-of-type(' + i + ')';
            }
            parts.unshift(seg);
            node = node.parentNode;
            depth++;
        }
        return parts.join(' > ').slice(0, 500);
    }

    function textOf(el) {
        var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) {
            t = el.getAttribute('aria-label') || el.getAttribute('title') ||
                el.getAttribute('value') || '';
        }
        return t.slice(0, TEXT_CAP);
    }

    // ---- 1. stamp the last-clicked link / button ------------------------------
    function onClick(e) {
        if (!hasSession()) { return; }
        var el = e.target;
        // Walk up to the nearest actionable element.
        var actionable = null, node = el, hops = 0;
        while (node && node.nodeType === 1 && hops < 5) {
            var tag = node.tagName;
            if (tag === 'A' && node.getAttribute('href')) { actionable = node; break; }
            if (tag === 'BUTTON') { actionable = node; break; }
            if (tag === 'INPUT' && /^(submit|button|image)$/i.test(node.type || '')) { actionable = node; break; }
            if (node.getAttribute && node.getAttribute('role') === 'button') { actionable = node; break; }
            node = node.parentNode; hops++;
        }
        if (!actionable) { return; }

        var type = actionable.tagName.toLowerCase();
        var href = '';
        if (type === 'a') {
            var raw = actionable.getAttribute('href') || '';
            // Ignore pure in-page/utility links - they never cause a 404 nav.
            if (!raw || raw.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(raw)) { return; }
            try { href = new URL(actionable.href, location.href).href; } catch (e2) { href = actionable.href || raw; }
        }

        var stamp = {
            p: location.pathname + location.search,
            t: type,
            x: textOf(actionable),
            h: href.slice(0, 1024),
            l: locator(actionable),
            ts: Date.now()
        };
        try { sessionStorage.setItem(KEY, JSON.stringify(stamp)); } catch (e3) { /* quota - ignore */ }
    }

    document.addEventListener('click', onClick, true);

    // ---- 2. on a 404 page, report the click that led here ---------------------
    function report() {
        if (!cfg.is404 || !cfg.path || !hasSession()) { return; }
        var raw;
        try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
        if (!raw) { return; }
        try { sessionStorage.removeItem(KEY); } catch (e2) { /* ignore */ }

        var s;
        try { s = JSON.parse(raw); } catch (e3) { return; }
        if (!s || typeof s.ts !== 'number') { return; }
        var age = Date.now() - s.ts;
        if (age > MAX_AGE_MS) { return; }

        // Attribute precisely: a link is the cause only if its target path IS this
        // dead path. Hrefless navigations (button / JS) can't be path-matched, so
        // fall back to a tight recency window — a click that navigated here.
        var matches;
        if (s.t === 'a' && s.h) {
            var hp = '';
            try { hp = new URL(s.h).pathname; } catch (e4) { hp = ''; }
            matches = (hp !== '' && normPath(hp) === normPath(cfg.path));
        } else {
            matches = (age <= NAV_AGE_MS);
        }
        if (!matches) { return; }

        var body = {
            path:            cfg.path,
            source_page:     s.p || '',
            element_type:    s.t || '',
            element_text:    s.x || '',
            element_href:    s.h || '',
            element_locator: s.l || ''
        };
        send(body);
    }

    // The body is JSON but goes out as text/plain: that content type is
    // CORS-safelisted, so the beacon stays a simple request and skips the
    // OPTIONS preflight the collector cannot answer. Collect404::hit reads the
    // raw php://input, so the declared type is never inspected. Same reasoning
    // as sg-analytics.js.
    function send(body) {
        var json;
        try { json = JSON.stringify(body); } catch (e) { return; }
        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([json], { type: 'text/plain;charset=UTF-8' });
                if (navigator.sendBeacon(cfg.url, blob)) { return; }
            }
        } catch (e2) { /* fall through */ }
        try {
            fetch(cfg.url, {
                method: 'POST', body: json, keepalive: true,
                mode: 'no-cors', credentials: 'same-origin'
            });
        } catch (e3) { /* give up silently */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', report);
    } else {
        report();
    }
})();
