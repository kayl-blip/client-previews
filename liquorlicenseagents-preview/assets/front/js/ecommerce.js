/*! SG Ecommerce front init - vanilla JS */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function init() {
        if (window.SGEcomPlugins) {
            SGEcomPlugins.products('.sgcom-products-wrapper');
            SGEcomPlugins.productForm('.sgcom-product-form');
            SGEcomPlugins.productGallery('.sgcom-product-thumbnail');
            SGEcomPlugins.productZoom('.sgcom-product-thumbnail .thumb img');
        }

        document.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.sgcom-mini-cart .sgcom-remove-item');
            if (removeBtn) {
                e.preventDefault();
                var item = removeBtn.closest('.mini-cart-item');
                var url = removeBtn.getAttribute('href');
                if (item && url) {
                    item.classList.add('is-removing');
                    item.innerHTML = '<div class="sg-d-flex sg-align-items-center sg-gap-3 sg-w-100">' +
                        '<div class="spinner-border spinner-border-sm sg-text-muted" role="status"></div>' +
                        '<div class="sg-text-muted sg-small">Removing item…</div></div>';
                }
                fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                    .then(function () {
                        if (window.sgcom && window.sgcom.cart && window.sgcom.cart.refresh) window.sgcom.cart.refresh(true);
                        document.dispatchEvent(new CustomEvent('sgcom:cart:removed'));
                    })
                    .catch(function () {
                        if (window.sgcom && window.sgcom.cart && window.sgcom.cart.refresh) window.sgcom.cart.refresh(true);
                        document.dispatchEvent(new CustomEvent('sgcom:cart:removed'));
                    });
            }
        });

        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-cart-button]');
            if (!btn) return;
            var mode = btn.getAttribute('data-cart-mode') || btn.dataset.cartMode;
            if (!mode || mode === 'auto') {
                var c = window.sgcom && window.sgcom.config && window.sgcom.config.cart;
                mode = (c && (c.button && c.button.mode || c.mode)) || 'redirect';
            }
            if (mode === 'dropdown') return;
            e.preventDefault();
            if (window.sgcom && window.sgcom.cart && window.sgcom.cart.open) window.sgcom.cart.open(mode);
        });
    }

    ready(init);
})();
