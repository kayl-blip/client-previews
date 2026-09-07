/* =============================================================================
 * sg-drawer — reusable offcanvas/drawer for SGEN-CMS modules.
 *
 *   API (window.SGDrawer):
 *     SGDrawer.open(id)              // open drawer by element id
 *     SGDrawer.close(id?)            // close one (or top-most if omitted)
 *     SGDrawer.toggle(id)
 *     SGDrawer.closeAll()
 *
 *   Auto-bound triggers:
 *     [data-sg-drawer-open="<id>"]   // any element opens that drawer on click
 *     [data-sg-drawer-close]         // any descendant of .sg-drawer-host
 *                                       closes its parent drawer; can also
 *                                       be set to a specific id
 *
 *   Behavior:
 *     - On first open, the host is appended to <body> so position:fixed isn't
 *       scoped to a transformed ancestor.
 *     - Body scroll-lock via the .sg-drawer-locked class.
 *     - Escape key closes the top-most open drawer.
 *     - Multiple drawers can be open in a stack; closeAll empties the stack.
 * ============================================================================= */
(function (window, document) {
    'use strict';

    var stack = [];

    function el(id) { return id ? document.getElementById(id) : null; }

    function relocate(host) {
        if (host && host.parentNode !== document.body) {
            document.body.appendChild(host);
        }
    }

    function lockScroll() { document.body.classList.add('sg-drawer-locked'); }
    function unlockScroll() { if (!stack.length) document.body.classList.remove('sg-drawer-locked'); }

    function open(id) {
        var host = el(id);
        if (!host) return;
        if (host.classList.contains('is-open')) return;
        relocate(host);
        // After relocation the element re-enters the document tree; force a
        // synchronous reflow so the browser commits the off-screen "start"
        // state before we toggle the class. Without this, transform changes
        // applied on the same tick can be coalesced and skip the transition.
        void host.offsetWidth;
        host.classList.add('is-open');
        host.setAttribute('aria-hidden', 'false');
        stack.push(id);
        lockScroll();
    }

    function close(id) {
        var targetId = id || (stack.length ? stack[stack.length - 1] : null);
        var host = el(targetId);
        if (!host) return;
        host.classList.remove('is-open');
        host.setAttribute('aria-hidden', 'true');
        var idx = stack.lastIndexOf(targetId);
        if (idx !== -1) stack.splice(idx, 1);
        unlockScroll();
    }

    function toggle(id) {
        var host = el(id);
        if (!host) return;
        if (host.classList.contains('is-open')) close(id); else open(id);
    }

    function closeAll() {
        while (stack.length) close(stack[stack.length - 1]);
    }

    document.addEventListener('click', function (e) {
        var openTrigger = e.target.closest('[data-sg-drawer-open]');
        if (openTrigger) {
            e.preventDefault();
            open(openTrigger.getAttribute('data-sg-drawer-open'));
            return;
        }
        var closeTrigger = e.target.closest('[data-sg-drawer-close]');
        if (closeTrigger) {
            // If the attribute has a value, treat it as an explicit target id;
            // otherwise close the parent drawer host.
            var explicit = closeTrigger.getAttribute('data-sg-drawer-close');
            if (explicit) {
                close(explicit);
            } else {
                var host = closeTrigger.closest('.sg-drawer-host');
                if (host && host.id) close(host.id);
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && stack.length) close();
    });

    window.SGDrawer = { open: open, close: close, toggle: toggle, closeAll: closeAll };
})(window, document);
