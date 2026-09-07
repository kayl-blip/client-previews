/*
 * Locations module — auto-prompt picker (modal/page) and on-demand drawer
 * runtime. Loaded sitewide via FrontModel when the LOCATIONS module is
 * enabled. Both surfaces share the same submit flow (POST /locations/select,
 * mirror cookie client-side, navigate to redirect or reload) — extracted into
 * `submitLocation` so the modal and drawer don't drift apart.
 */
(function () {
    /**
     * Shared submit flow used by both the modal and the drawer. Handles:
     *   - busy/disabled state on the clicked button
     *   - POST to action with credentials so the Set-Cookie header sticks
     *   - graceful HTML-instead-of-JSON responses (CSRF page, 404, 500)
     *   - belt-and-suspenders: also writes the cookie client-side before
     *     navigating, since some browsers don't reliably commit the AJAX
     *     response's Set-Cookie header before window.location navigates and
     *     the picker would re-prompt on the next page load otherwise.
     */
    function submitLocation(action, btn, locationId, errorEl) {
        function showError(msg) {
            if (!errorEl) return;
            errorEl.textContent = msg;
            errorEl.hidden = false;
        }
        function resetBtn() {
            btn.classList.remove('is-busy');
            btn.removeAttribute('disabled');
        }

        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
        btn.classList.add('is-busy');
        btn.setAttribute('disabled', 'disabled');

        var fd = new FormData();
        fd.append('location_id', locationId);
        // The page being selected from. The endpoint is reached by XHR, so it
        // can't see it otherwise, and it decides whether a location's Shop URL
        // applies (shop pages only, see resolveSelectionRedirect).
        fd.append('current_path', window.location.pathname + window.location.search);

        fetch(action, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        })
            .then(function (r) {
                // Read as text so we can give a useful error if the server
                // returned HTML instead of JSON.
                return r.text().then(function (text) { return { status: r.status, text: text }; });
            })
            .then(function (res) {
                var json;
                try { json = JSON.parse(res.text); } catch (_) { json = null; }
                if (!json) {
                    showError('Could not save your selection (status ' + res.status + '). Please try again.');
                    resetBtn();
                    return;
                }
                if (!json.success) {
                    showError(json.error || 'Could not save your selection.');
                    resetBtn();
                    return;
                }
                var cookie = 'selected_location_id=' + encodeURIComponent(locationId)
                           + '; path=/; SameSite=Lax'
                           + (location.protocol === 'https:' ? '; Secure' : '');
                if (json.remember_days > 0) {
                    cookie += '; max-age=' + (json.remember_days * 24 * 60 * 60);
                }
                document.cookie = cookie;

                if (json.redirect) window.location.href = json.redirect;
                else               window.location.reload();
            })
            .catch(function () {
                showError('Network error. Please check your connection and try again.');
                resetBtn();
            });
    }

    // ---- Auto-prompt modal / page interstitial ---------------------------
    function initModal() {
        var modal = document.getElementById('locPickerModal');
        if (!modal) return;
        var required = modal.getAttribute('data-required') === '1';
        var action   = modal.getAttribute('data-action');
        var errorEl  = document.getElementById('locPickerError');
        document.body.style.overflow = 'hidden';

        function close() {
            if (required) return; // hard gate — no dismiss path.
            modal.remove();
            document.body.style.overflow = '';
        }

        // Dismiss handlers — only attached when not required.
        if (!required) {
            modal.addEventListener('click', function (e) {
                if (e.target.closest('[data-loc-picker-dismiss]')) close();
            });
            document.addEventListener('keydown', function onEsc(e) {
                if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
            });
        }

        // Step-flow panel switching. Group axis is dynamic (state vs city —
        // see the PHP layout decision); the JS just shuttles the chosen
        // group key between panels.
        var steps = modal.querySelector('.loc-picker-steps');
        if (steps) {
            steps.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-step-to]');
                if (!btn) return;
                var goTo = btn.getAttribute('data-step-to');
                steps.querySelectorAll('.loc-picker-steps__panel').forEach(function (p) {
                    p.hidden = p.getAttribute('data-panel') !== goTo;
                });
                if (goTo === 'locations') {
                    var groupFilter = btn.getAttribute('data-group') || '';
                    modal.querySelectorAll('.loc-picker-card[data-group-filter]').forEach(function (c) {
                        c.hidden = c.getAttribute('data-group-filter') !== groupFilter;
                    });
                }
            });
        }

        modal.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-location-id]');
            if (!btn || btn.classList.contains('is-busy')) return;
            var locationId = btn.getAttribute('data-location-id');
            if (!locationId) return;
            submitLocation(action, btn, locationId, errorEl);
        });
    }

    // ---- On-demand drawer ------------------------------------------------
    function initDrawer() {
        var drawer = document.getElementById('locPickerDrawer');
        if (!drawer) return;
        var aside   = drawer.querySelector('.sg-drawer');
        var action  = aside ? aside.getAttribute('data-action') : '';
        var errorEl = document.getElementById('locDrawerError');

        drawer.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-location-id]');
            if (!btn || btn.classList.contains('is-busy')) return;
            var locationId = btn.getAttribute('data-location-id');
            if (!locationId) return;
            submitLocation(action, btn, locationId, errorEl);
        });
    }

    // ---- Picker trigger buttons -----------------------------------------
    // The [location_picker_button] / SG Builder trigger renders a default label
    // server-side (cache-safe); once a location is picked we swap in its name
    // here, read from the JS-readable cookie + the drawer card markup, so a
    // full-page-cached button never shows one visitor's choice to everyone.
    function getCookie(name) {
        var m = document.cookie.match('(?:^|; )' + name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1') + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : '';
    }

    function initTriggers() {
        var triggers = document.querySelectorAll('[data-loc-picker-trigger]');
        if (!triggers.length) return;

        var id = getCookie('selected_location_id').replace(/\D/g, '');
        if (!id) return; // no selection yet — leave the default label.

        // The drawer (emitted alongside the button) already lists every
        // location's name — reuse it instead of shipping a second id→name map.
        var card = document.querySelector('#locPickerDrawer .loc-drawer-card[data-location-id="' + id + '"]');
        var nameEl = card ? card.querySelector('.loc-drawer-card__name') : null;
        var name = nameEl ? nameEl.textContent.trim() : '';
        if (!name) return;

        triggers.forEach(function (btn) {
            var labelEl = btn.querySelector('.loc-picker-trigger__label');
            if (labelEl) labelEl.textContent = name;
            btn.classList.add('is-selected');
            btn.setAttribute('title', name);
        });
    }

    function init() {
        initModal();
        initDrawer();
        initTriggers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
