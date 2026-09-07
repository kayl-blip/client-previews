/*!
 * sg-analytics.js - SGEN first-party analytics tracker
 *
 * Sends pageviews + interaction events to the same-origin collector (sg-collect)
 * so the in-house ANALYTICS module can report visitors, sessions, acquisition,
 * tech and behaviour without any third-party script. Dependency-free.
 *
 * Config is injected by analytics_client_hook.php as window.__SG_TRACK__:
 *   { url, consent (bool), respectDnt (bool), domain }
 *
 * Public API: window.sgTrack(name, params) fires a custom event.
 */
(function () {
    'use strict';

    var cfg = window.__SG_TRACK__ || {};
    if (!cfg.url) { return; }

    // ---- consent / DNT guards -------------------------------------------------
    if (cfg.consent === false) { return; }
    if (cfg.respectDnt) {
        var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
        if (dnt === '1' || dnt === 'yes') { return; }
    }

    var VID_DAYS = 730;   // visitor cookie ~2 years
    var SID_MINS = 30;    // session cookie sliding 30-minute window

    // ---- cookie helpers -------------------------------------------------------
    function readCookie(name) {
        var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : '';
    }
    function writeCookie(name, value, maxAgeSec) {
        var secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = name + '=' + encodeURIComponent(value) +
            '; Path=/; Max-Age=' + maxAgeSec + '; SameSite=Lax' + secure;
    }
    function uuid() {
        if (window.crypto && crypto.randomUUID) { return crypto.randomUUID(); }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // ---- identity -------------------------------------------------------------
    var vid = readCookie('_sg_vid');
    if (!vid) { vid = uuid(); }
    writeCookie('_sg_vid', vid, VID_DAYS * 86400);

    var sid = readCookie('_sg_sid');
    if (!sid) { sid = uuid(); }
    writeCookie('_sg_sid', sid, SID_MINS * 60); // re-set each call => sliding window

    // ---- acquisition params (utm_* + ad-click ids) ----------------------------
    function utm() {
        var out = {}, q;
        try { q = new URLSearchParams(location.search); } catch (e) { return out; }
        ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) {
            var v = q.get('utm_' + k);
            if (v) { out['utm_' + k] = v.slice(0, 191); }
        });
        // Ad-click identifiers added by ad-platform auto-tagging. Used server-side
        // to attribute paid traffic (gclid/msclkid) when explicit UTMs are absent.
        ['gclid', 'msclkid', 'fbclid', 'ttclid'].forEach(function (k) {
            var v = q.get(k);
            if (v) { out[k] = v.slice(0, 255); }
        });
        return out;
    }

    // ---- transport ------------------------------------------------------------
    // The body is JSON, but it is sent as text/plain on purpose. text/plain is
    // one of the three CORS-safelisted request content types, so the beacon
    // stays a "simple request" and never triggers a preflight. With
    // application/json the browser fires an OPTIONS preflight first, and the
    // collector answers it with no Access-Control-Allow-Origin - so any page
    // served from a host other than the site's own (e.g. a third-party menu
    // subdomain that embeds this tag) had its beacon blocked outright.
    // The server reads the raw php://input and json_decode()s it (Collect::hit),
    // so it never inspects the declared content type.
    function send(body) {
        // refresh the sliding session window on every beacon
        writeCookie('_sg_sid', sid, SID_MINS * 60);
        var json = JSON.stringify(body);
        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([json], { type: 'text/plain;charset=UTF-8' });
                if (navigator.sendBeacon(cfg.url, blob)) { return; }
            }
        } catch (e) { /* fall through */ }
        try {
            // mode:'no-cors' keeps the fallback a simple request too. The
            // response is opaque, which costs nothing: this is fire-and-forget.
            fetch(cfg.url, { method: 'POST', body: json, keepalive: true,
                mode: 'no-cors', credentials: 'same-origin' });
        } catch (e) { /* give up silently */ }
    }

    // ---- sensitive params -----------------------------------------------------
    // Query params that must NEVER be written to the analytics store, because
    // they are credentials rather than descriptions of the visit.
    //
    // `k` is the CRM landing-page link token (see CrmLandingModel): a signed
    // capability that unlocks one lead's contact record — name, email, phone,
    // address, DOB — to anyone holding it. Recording `?k=…` in the `path`
    // column would copy that capability into the analytics table, where it is
    // queryable, exportable, and long-lived, for every personalized landing
    // page view. The CRM's own integration guide calls this out: "Don't log
    // full URLs with `k` into third-party analytics" — our first-party store
    // is no different.
    //
    // The CRM module also strips the token from the address bar via
    // history.replaceState, but that cannot be relied on here: it is a separate
    // script with no guaranteed ordering against this one, and it is a
    // per-site setting that can be turned off. Strip at the point of capture.
    var SENSITIVE_PARAMS = (cfg.stripParams && cfg.stripParams.length)
        ? cfg.stripParams
        : ['k'];

    function scrubbedPath() {
        var search = location.search;
        if (!search || search.length < 2) { return location.pathname; }

        var q;
        try {
            q = new URLSearchParams(search);
        } catch (e) {
            // No URLSearchParams (very old browser): fail CLOSED and drop the
            // whole query string rather than risk shipping a token.
            return location.pathname;
        }

        var touched = false;
        for (var i = 0; i < SENSITIVE_PARAMS.length; i++) {
            if (q.has(SENSITIVE_PARAMS[i])) { q.delete(SENSITIVE_PARAMS[i]); touched = true; }
        }
        if (!touched) { return location.pathname + search; }

        var rest = q.toString();
        return location.pathname + (rest ? '?' + rest : '');
    }

    function base() {
        return {
            vid: vid,
            sid: sid,
            path: scrubbedPath(),
            referrer: document.referrer || '',
            language: (navigator.language || '').slice(0, 20),
            screen: (window.screen ? screen.width + 'x' + screen.height : '')
        };
    }

    function pageview() {
        var p = base();
        p.kind = 'pageview';
        p.title = (document.title || '').slice(0, 255);
        var u = utm();
        for (var k in u) { if (u.hasOwnProperty(k)) { p[k] = u[k]; } }
        send(p);
    }

    function event(name, params, et) {
        var p = base();
        p.kind = 'event';
        p.name = String(name || 'event').slice(0, 80);
        if (params && typeof params === 'object') { p.params = params; }
        if (et) { p.et = et; }
        send(p);
    }

    // ---- engagement time (foreground ms since last flush) ---------------------
    var engStart = (document.visibilityState === 'visible') ? Date.now() : 0;
    var engAccrued = 0;
    function engNow() {
        if (engStart) { engAccrued += Date.now() - engStart; engStart = 0; }
        var ms = engAccrued; engAccrued = 0;
        return ms;
    }
    function flushEngagement() {
        var ms = engNow();
        if (ms >= 1000) { event('engagement', null, ms); }
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            if (!engStart) { engStart = Date.now(); }
        } else {
            flushEngagement();
        }
    });
    window.addEventListener('pagehide', flushEngagement);

    // ---- scroll depth (25/50/75/90 once each) ---------------------------------
    var marks = [25, 50, 75, 90], fired = {};
    function onScroll() {
        var doc = document.documentElement, body = document.body;
        var h = Math.max(doc.scrollHeight, body.scrollHeight) - window.innerHeight;
        if (h <= 0) { return; }
        var pct = Math.min(100, Math.round((window.pageYOffset / h) * 100));
        for (var i = 0; i < marks.length; i++) {
            var m = marks[i];
            if (pct >= m && !fired[m]) { fired[m] = 1; event('scroll', { depth: m }); }
        }
    }
    var scrollT;
    window.addEventListener('scroll', function () {
        if (scrollT) { return; }
        scrollT = setTimeout(function () { scrollT = null; onScroll(); }, 400);
    }, { passive: true });

    // ---- outbound link clicks -------------------------------------------------
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) { return; }
        var href = a.getAttribute('href') || '';
        if (/^(mailto:|tel:|javascript:|#)/i.test(href)) { return; }
        var host;
        try { host = new URL(a.href, location.href).host; } catch (err) { return; }
        if (host && host !== location.host) {
            event('outbound_click', { url: a.href.slice(0, 500) });
        }
    }, true);

    // ---- SPA route changes ----------------------------------------------------
    // Compares the SCRUBBED path, not the raw one. Two reasons: it is the value
    // actually reported, so the comparison matches what a pageview would say;
    // and the CRM module strips its link token with history.replaceState, which
    // this watcher is hooked into. On a raw comparison that strip reads as a
    // route change and fires a duplicate pageview on every personalized landing
    // page view. Scrubbed, ?k= removal is a no-op here, as it should be.
    var lastPath = scrubbedPath();
    function maybeRoute() {
        var now = scrubbedPath();
        if (now !== lastPath) {
            flushEngagement();
            lastPath = now;
            fired = {};           // reset scroll marks for the new page
            engStart = Date.now();
            pageview();
        }
    }
    ['pushState', 'replaceState'].forEach(function (fn) {
        var orig = history[fn];
        if (typeof orig === 'function') {
            history[fn] = function () {
                var r = orig.apply(this, arguments);
                setTimeout(maybeRoute, 0);
                return r;
            };
        }
    });
    window.addEventListener('popstate', maybeRoute);

    // ---- public API + first pageview -----------------------------------------
    window.sgTrack = function (name, params) { event(name, params); };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        pageview();
    } else {
        document.addEventListener('DOMContentLoaded', pageview);
    }
})();
