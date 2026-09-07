/**
 * SGEN Dispenza Module — front-end JS
 * ----------------------------------------------------------------------------
 *  - Wrapped in IIFE → zero global pollution beyond `window.SGENDispenza`
 *  - All AJAX calls go through one helper that:
 *      • debounces rapid clicks (prevents accidental polling 429s)
 *      • short-circuits on rate-limit responses with a backoff timer
 *      • respects the host site's CSRF token if present
 */
(function (window, document) {
    'use strict';

    if (window.SGENDispenza) return;

    var ROUTE_PREFIX = (window.DPZ_ROUTE_PREFIX || 'dispenza');
    var BASE = window.DPZ_AJAX_URL
             || ((window.DPZ_BASE_URL || (location.origin + '/')) + ROUTE_PREFIX + '/ajax/');

    // ---- AJAX core ---------------------------------------------------------
    var inflight = Object.create(null);
    var lockoutUntil = 0;

    function csrfPair() {
        var n = document.querySelector('meta[name="csrf-name"]');
        var t = document.querySelector('meta[name="csrf-token"]');
        return (n && t) ? [n.getAttribute('content'), t.getAttribute('content')] : null;
    }

    function ajax(action, data) {
        if (Date.now() < lockoutUntil) {
            return Promise.reject({ ok: false, error: 'Rate limited locally', code: 429 });
        }
        var key = action + ':' + JSON.stringify(data || {});
        if (inflight[key]) return inflight[key];

        var body = new URLSearchParams();
        Object.keys(data || {}).forEach(function (k) { body.append(k, data[k]); });
        var csrf = csrfPair();
        if (csrf) body.append(csrf[0], csrf[1]);

        inflight[key] = fetch(BASE + encodeURIComponent(action), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: body
        }).then(function (r) {
            if (r.status === 429) lockoutUntil = Date.now() + 30000;
            return r.json().catch(function () { return { ok: false, error: 'Bad JSON' }; });
        }).finally(function () { delete inflight[key]; });

        return inflight[key];
    }

    // ---- Cart drawer -------------------------------------------------------
    // Open/close are delegated to the shared sg-drawer module (loaded via
    // sg-drawer.js); these helpers keep the dispenza-internal call sites
    // tidy without duplicating the open/close logic.
    function openDrawer()  { if (window.SGDrawer) window.SGDrawer.open('dpzDrawer'); }
    function closeDrawer() { if (window.SGDrawer) window.SGDrawer.close('dpzDrawer'); }

    function refreshCartDrawer() {
        return ajax('cart_html', {}).then(function (resp) {
            if (!resp || !resp.ok || !resp.data) return;

            // Body
            var body = document.getElementById('dpzDrawerBody');
            if (body && typeof resp.data.html === 'string') body.innerHTML = resp.data.html;

            // Subtotal / total text — both targets are the same number until
            // the order-summary breakdown grows tax/discount logic.
            if (typeof resp.data.total_formatted === 'string') {
                document.querySelectorAll('.dpz-cart-total, .dpz-cart-subtotal').forEach(function (el) {
                    el.textContent = resp.data.total_formatted;
                });
            }

            // Footer visibility — show only when there are items
            var foot = document.getElementById('dpzDrawerFoot');
            if (foot) {
                var hasItems = (resp.data.count || 0) > 0;
                foot.classList.toggle('dpz-hidden', !hasItems);
            }

            updateBadge(resp);
        });
    }

    /**
     * Patch the cart-page row in place from an update_cart_item /
     * remove_from_cart response. Without this the cart-page line price stays
     * stale until a full refresh — refreshCartDrawer only redraws the drawer
     * body, not the lines on the cart page.
     */
    function applyLineUpdate(resp) {
        if (!resp || !resp.ok || !resp.data) return;
        var d = resp.data;
        var row = d.line_id
            ? document.querySelector('.dpz-cart-line[data-line="' + cssEscape(d.line_id) + '"]')
            : null;
        if (!row) return;
        if (d.line_removed) {
            row.remove();
        } else if (typeof d.line_total_formatted === 'string') {
            var priceEl = row.querySelector('.dpz-cart-line-price');
            if (priceEl) priceEl.textContent = d.line_total_formatted;
        }
    }

    /** Tiny CSS.escape polyfill — line ids contain `p<id>v<id>`, all safe
     *  characters today, but cheap insurance against future variants. */
    function cssEscape(s) {
        if (window.CSS && CSS.escape) return CSS.escape(s);
        return String(s).replace(/[^a-zA-Z0-9_\-]/g, function (c) {
            return '\\' + c;
        });
    }

    function updateBadge(resp) {
        if (!resp || !resp.ok) return;
        var n = (resp.data && typeof resp.data.count !== 'undefined') ? resp.data.count : null;
        if (n === null) return;
        document.querySelectorAll('.dpz-cart-badge').forEach(function (b) {
            b.textContent = n; b.style.display = n > 0 ? '' : 'none';
        });
        document.querySelectorAll('.dpz-cart-count').forEach(function (b) { b.textContent = '(' + n + ')'; });
    }

    // ---- Qty stepper -------------------------------------------------------
    function stepperFor(target) {
        var input = target.parentElement.querySelector('input[type="number"]');
        if (!input) return null;
        return input;
    }

    /**
     * Animate the gauge number from 0 → target in sync with the stroke-draw
     * animation. Skipped when the user prefers reduced motion.
     */
    function animateGauges() {
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var nodes = document.querySelectorAll('.dpz-gauge__num[data-target]');
        if (!nodes.length) return;

        var DURATION = 1400;   // matches dpz-gauge-draw in CSS
        var DELAY    = 200;
        var ease     = function (t) { return 1 - Math.pow(1 - t, 3); }; // ease-out cubic

        nodes.forEach(function (el) {
            var target = parseFloat(el.getAttribute('data-target')) || 0;
            // Decimals match the source string (e.g. "33.28" → 2 decimals)
            var src = el.getAttribute('data-target') || '';
            var dot = src.indexOf('.');
            var decimals = dot >= 0 ? (src.length - dot - 1) : 0;
            el.textContent = target.toFixed(decimals === 0 ? 0 : decimals).replace(/\d/g, '0');
            var start = null;

            function step(now) {
                if (start === null) start = now;
                var t = Math.min(1, (now - start) / DURATION);
                var v = target * ease(t);
                el.textContent = decimals === 0 ? Math.round(v).toString() : v.toFixed(decimals);
                if (t < 1) requestAnimationFrame(step);
            }
            setTimeout(function () { requestAnimationFrame(step); }, DELAY);
        });
    }

    // ---- Bindings ---------------------------------------------------------
    function bind() {
        animateGauges();

        // Hydrate the cart drawer from the session on load. The drawer is
        // rendered sitewide (wrapper-end.php) as an empty shell so no per-session
        // cart is baked into the full-page-cached markup; on storefront pages a
        // cached server-rendered cart may also be stale. Either way, pull the
        // visitor's real cart + badge via AJAX. No-op when no drawer is present.
        if (document.getElementById('dpzDrawer')) refreshCartDrawer();

        // Drawer open/close + Esc key are handled by sg-drawer.js via the
        // [data-sg-drawer-open] / [data-sg-drawer-close] data attributes.

        // Add to cart
        document.addEventListener('click', function (e) {
            var t = e.target.closest('.dpz-add');
            if (!t) return;
            e.preventDefault();
            // Spam-click guard — first click wins; subsequent clicks while
            // the request is in flight are ignored. Visual feedback
            // (spinner + disabled state) comes from the .is-busy class
            // styled in dispenza.css.
            if (t.classList.contains('is-busy') || t.disabled) return;

            var pid = t.getAttribute('data-id');
            // Quantity source: explicit selector (PDP) or default 1
            var qty = 1;
            var qtySrc = t.getAttribute('data-qty-source');
            if (qtySrc) {
                var qel = document.querySelector(qtySrc);
                if (qel) qty = Math.max(1, parseInt(qel.value, 10) || 1);
            }
            var variantSel = t.parentElement && t.parentElement.querySelector('.dpz-variant');

            t.classList.add('is-busy');
            t.disabled = true;

            ajax('add_to_cart', {
                product_id: pid,
                variant_id: variantSel ? variantSel.value : 0,
                qty: qty
            }).then(function (resp) {
                refreshCartDrawer();
                if (resp && resp.ok) openDrawer();
            }).catch(function () {
                /* swallow — the rate-limit / network error UI lives in ajax() */
            }).finally(function () {
                t.classList.remove('is-busy');
                t.disabled = false;
            });
        });

        // Remove line
        document.addEventListener('click', function (e) {
            var t = e.target.closest('.dpz-remove');
            if (!t) return;
            e.preventDefault();
            var row = t.closest('[data-line]');
            if (!row) return;
            var lineId = row.getAttribute('data-line');
            ajax('remove_from_cart', { line_id: lineId }).then(function (resp) {
                applyLineUpdate(resp);
                refreshCartDrawer();
            });
        });

        // Qty change (typing)
        document.addEventListener('change', function (e) {
            var inp = e.target.closest('.dpz-qty');
            if (!inp) return;
            var row = inp.closest('[data-line]');
            if (!row) return;
            var lineId = row.getAttribute('data-line');
            ajax('update_cart_item', { line_id: lineId, qty: inp.value }).then(function (resp) {
                applyLineUpdate(resp);
                refreshCartDrawer();
            });
        });

        // Qty +/- steppers
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-dpz-qty]');
            if (!btn) return;
            e.preventDefault();
            var input = stepperFor(btn);
            if (!input) return;
            var dir = btn.getAttribute('data-dpz-qty');
            var v = Math.max(1, parseInt(input.value, 10) || 1);
            input.value = (dir === '+') ? v + 1 : Math.max(1, v - 1);
            // If inside a cart line, dispatch change so it persists
            if (input.classList.contains('dpz-qty')) {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Sort dropdown — option values are full URLs
        var sort = document.getElementById('dpzSort');
        if (sort) sort.addEventListener('change', function () {
            if (sort.value) location.href = sort.value;
        });

        // Read more toggle on PDP description
        document.addEventListener('click', function (e) {
            var t = e.target.closest('[data-dpz-readmore]');
            if (!t) return;
            e.preventDefault();
            var sel = t.getAttribute('data-dpz-readmore');
            var d = sel ? document.querySelector(sel) : null;
            if (!d) return;
            d.classList.toggle('is-expanded');
            t.textContent = d.classList.contains('is-expanded') ? 'Read less' : 'Read more';
        });

        // Variant pills (PDP) — switch active state + update visible price
        document.addEventListener('click', function (e) {
            var p = e.target.closest('.dpz-pdp-variant');
            if (!p) return;
            var group = p.closest('.dpz-pdp-variant-pills');
            if (group) group.querySelectorAll('.dpz-pdp-variant').forEach(function (x) { x.classList.remove('is-active'); });
            p.classList.add('is-active');
            var price = p.getAttribute('data-price');
            var priceEl = document.querySelector('.dpz-pdp-price');
            if (price && priceEl && price !== '0') {
                priceEl.textContent = '$' + parseFloat(price).toFixed(2);
            }
        });

        // Cart context controls — dispensary picker, fulfillment, menu type.
        // Each control sets a single key on the persisted cart context via
        // ajax('set_context'); pillgroup buttons swap the .is-active class
        // with their siblings, dispensary picker items swap within their list
        // and close the parent <details>.
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-dpz-context]');
            if (!btn || btn.disabled) return;
            e.preventDefault();
            var key   = btn.getAttribute('data-dpz-context');
            var value = btn.getAttribute('data-value');
            if (!key) return;

            // Visual swap — within the nearest pillgroup or picker list.
            var groupSelectors = '.dpz-pillgroup, .dpz-disp-picker__list';
            var group = btn.closest(groupSelectors);
            if (group) {
                group.querySelectorAll('[data-dpz-context]').forEach(function (b) { b.classList.remove('is-active'); });
                btn.classList.add('is-active');
            }

            // If this was a dispensary pick, mirror the chosen name into the
            // disclosure trigger and close the dropdown.
            if (key === 'dispensary_id') {
                var details = btn.closest('details.dpz-disp-picker');
                if (details) {
                    var nameEl = details.querySelector('.dpz-disp-picker__name');
                    var label  = btn.firstChild ? btn.textContent.trim().split('\n')[0].trim() : '';
                    if (nameEl && label) nameEl.textContent = label;
                    details.removeAttribute('open');
                }
            }

            var payload = {}; payload[key] = value;
            ajax('set_context', payload).then(function () {
                // Dispensary swap changes the entire listing scope; menu-type
                // swap rewrites every displayed price. Both warrant a full
                // reload. Fulfillment is purely a checkout-time concern, so
                // it stays a silent persist.
                if (key === 'dispensary_id' || key === 'menu_type') location.reload();
            });
        });

        // Toggle "View more / View less" for sidebar groups (categories, brands, ...)
        document.addEventListener('click', function (e) {
            var t = e.target.closest('[data-toggle]');
            if (!t || !t.classList.contains('dpz-side-more')) return;
            e.preventDefault();
            var key = t.getAttribute('data-toggle');
            var extra = document.querySelector('.dpz-' + key + '-extra');
            if (!extra) return;
            var willHide = !extra.classList.contains('dpz-hidden');
            extra.classList.toggle('dpz-hidden', willHide);
            t.setAttribute('aria-expanded', willHide ? 'false' : 'true');
            var label = t.querySelector('.dpz-side-more__label');
            if (label) label.textContent = willHide ? 'View more' : 'View less';
        });
    }

    // ---- Public surface ---------------------------------------------------
    window.SGENDispenza = {
        version: '1.1.0',
        ajax:           ajax,
        openDrawer:     openDrawer,
        closeDrawer:    closeDrawer,
        refreshCart:    refreshCartDrawer,
        refreshBadge:   function () { return ajax('cart_count', {}).then(updateBadge); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})(window, document);
