/* =============================================================================
 * SGEN — sgen-mobile-menu.js
 * State machine + tap sequence for the front-end mobile menu drawer.
 *
 *   - Drill-down sliding panels (panel-id stack).
 *   - Tap sequence on hamburger / close / back: plays the hover-mimic
 *     animation (260ms) then the press-mimic (120ms) BEFORE the action,
 *     so touch users see the same theater desktop hover would have given.
 *   - No :hover / :active styles drive those three buttons — every visual
 *     is class-driven by this script.
 *   - Leaf-card link clicks defer navigation 250ms so :active red-wash
 *     plays through before the page changes (handoff §B production note).
 *
 * Expected DOM structure (selectors are stable contracts — do not rename
 * without mirroring in this file):
 *
 *   <button class="mm-hamburger" id="mm-trigger">
 *     <span class="bar"></span><span class="bar"></span><span class="bar"></span>
 *   </button>
 *
 *   <div class="mm-host" id="mm-host">
 *     <div class="mm-overlay" data-mm-close></div>
 *     <div class="mm-drawer" id="mm-drawer">
 *       <section class="mm-panel is-active" data-panel="root"> ... </section>
 *       <section class="mm-panel"           data-panel="<slug>"> ... </section>
 *       ...
 *     </div>
 *   </div>
 *
 *   - Drill triggers: any element with [data-target] + [data-mm-drill]
 *   - Back triggers:  any element with [data-mm-back]
 *   - Close triggers: any element with [data-mm-close] (also the .mm-overlay)
 *
 * Esc closes the drawer. After close, the panel stack auto-resets to "root"
 * 380ms later (the slide-out duration).
 *
 * Self-initializes on DOMContentLoaded. Silent no-op if #mm-host or
 * #mm-trigger are absent — safe to include site-wide.
 *
 * Ported from mobile-menu-handoff (2026-05-11), with one front-end-only
 * addition: leaf-card click deferral (the handoff demo didn't navigate).
 * ============================================================================= */
(function () {
    'use strict';

    function init() {
        var host = document.getElementById('mm-host');
        var trigger = document.getElementById('mm-trigger');
        if (!host || !trigger) return;  // not on this page

        var drawer = document.getElementById('mm-drawer');
        if (!drawer) return;

        var panels = Array.prototype.slice.call(drawer.querySelectorAll('.mm-panel'));

        // Panel-id stack — current tier sequence (root → product → core, etc.)
        var stack = ['root'];

        function panel(id) { return drawer.querySelector('[data-panel="' + id + '"]'); }

        function setState(id, state) {
            var el = panel(id);
            if (!el) return;
            el.classList.remove('is-active', 'is-prev');
            if (state) el.classList.add(state);
        }

        function drillTo(targetId) {
            if (!panel(targetId)) return;
            var currentId = stack[stack.length - 1];
            setState(currentId, 'is-prev');
            setState(targetId, 'is-active');
            stack.push(targetId);
        }

        function back() {
            if (stack.length < 2) return;
            var currentId = stack.pop();
            var prevId = stack[stack.length - 1];
            setState(currentId, null);
            setState(prevId, 'is-active');
        }

        // The host ships with `inert` (FrontModel::…mm-host markup), which keeps the
        // closed drawer out of the accessibility tree AND out of the tab order at
        // the same time. Toggling it here is what makes the OPEN drawer reachable —
        // the markup previously carried a static aria-hidden="true" that was never
        // removed, so the drawer was hidden from assistive tech even while open,
        // while its buttons stayed tabbable when closed.
        //
        // Feature-detected: on a browser without `inert` the property is undefined,
        // and assigning it would silently do nothing while leaving the closed drawer
        // focusable. There we fall back to aria-hidden + tabindex="-1" on the
        // focusable descendants, which is the same guarantee by hand.
        var supportsInert = 'inert' in HTMLElement.prototype;
        var FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

        function setDrawerReachable(reachable) {
            if (supportsInert) {
                host.inert = !reachable;
                return;
            }
            if (reachable) {
                host.removeAttribute('aria-hidden');
            } else {
                host.setAttribute('aria-hidden', 'true');
            }
            host.querySelectorAll(FOCUSABLE).forEach(function (el) {
                if (reachable) {
                    // Restore only what we parked; anything with its own author-set
                    // tabindex is left exactly as the markup declared it.
                    if (el.getAttribute('data-mm-parked-tabindex') === '1') {
                        el.removeAttribute('tabindex');
                        el.removeAttribute('data-mm-parked-tabindex');
                    }
                } else if (!el.hasAttribute('tabindex')) {
                    el.setAttribute('tabindex', '-1');
                    el.setAttribute('data-mm-parked-tabindex', '1');
                }
            });
        }

        function openMenu() {
            host.classList.add('is-open');
            trigger.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            trigger.setAttribute('aria-label', 'Close menu');
            setDrawerReachable(true);
            // Lock body scroll while drawer is open
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            host.classList.remove('is-open');
            trigger.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-label', 'Open menu');
            setDrawerReachable(false);
            document.body.style.overflow = '';
            // After slide-out finishes, reset panel stack to root
            setTimeout(function () {
                panels.forEach(function (p) { p.classList.remove('is-active', 'is-prev'); });
                setState('root', 'is-active');
                stack.length = 0;
                stack.push('root');
            }, 380);
        }

        /* Tap-sequence: plays hover-mimic, then press-mimic, then the action.
         * Touch users get both visual phases before the drawer/morph kicks in. */
        function tapSequence(element, action) {
            if (element.classList.contains('is-tap-hover')) return;  // debounce
            element.classList.add('is-tap-hover');
            setTimeout(function () { element.classList.add('is-tap-press'); }, 260);
            setTimeout(function () {
                element.classList.remove('is-tap-hover', 'is-tap-press');
                action();
            }, 380);
        }

        // Hamburger — full tap sequence, then open/close
        trigger.addEventListener('click', function (e) {
            e.preventDefault();
            tapSequence(trigger, function () {
                if (host.classList.contains('is-open')) closeMenu();
                else openMenu();
            });
        });

        // Overlay click closes (no tap sequence — overlay isn't a button)
        var overlay = host.querySelector('.mm-overlay');
        if (overlay) overlay.addEventListener('click', closeMenu);

        // Drawer-internal clicks: drill / back / close / leaf
        drawer.addEventListener('click', function (e) {
            // Drill trigger
            var drillBtn = e.target.closest && e.target.closest('[data-target][data-mm-drill]');
            if (drillBtn) {
                e.preventDefault();
                drillTo(drillBtn.getAttribute('data-target'));
                return;
            }
            // Back
            var backBtn = e.target.closest && e.target.closest('[data-mm-back]');
            if (backBtn) {
                e.preventDefault();
                tapSequence(backBtn, back);
                return;
            }
            // Close
            var closeBtn = e.target.closest && e.target.closest('[data-mm-close]');
            if (closeBtn) {
                e.preventDefault();
                tapSequence(closeBtn, closeMenu);
                return;
            }
            // Leaf-card link — defer navigation so :active red-wash plays through.
            // Only when it's a real anchor with an href (not "#"), in the same window.
            var leaf = e.target.closest && e.target.closest('a.mm-card[href]');
            if (leaf) {
                var href = leaf.getAttribute('href');
                if (href && href !== '#' && href.charAt(0) !== '#' && leaf.getAttribute('target') !== '_blank') {
                    e.preventDefault();
                    setTimeout(function () { window.location.href = leaf.href; }, 250);
                }
            }
        });

        // Esc closes
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && host.classList.contains('is-open')) closeMenu();
        });

        // Sync the closed state once at init. The markup ships `inert`, which is
        // already correct on browsers that support it — but on one that does not,
        // the attribute is inert-in-name-only and every control in the drawer would
        // stay tabbable until the first open/close. This applies the aria-hidden +
        // tabindex fallback immediately instead of waiting for that interaction.
        if (!supportsInert && !host.classList.contains('is-open')) {
            setDrawerReachable(false);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
