/*! SG Ecommerce plugin - vanilla JS */
(function () {
    'use strict';

    window.sgcom = window.sgcom || {};

    function deepExtend(target, src) {
        if (!src || typeof src !== 'object') return target;
        for (var key in src) {
            if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
            var val = src[key];
            if (val && typeof val === 'object' && !Array.isArray(val) && val.nodeType === undefined) {
                if (!target[key] || typeof target[key] !== 'object') target[key] = {};
                deepExtend(target[key], val);
            } else {
                target[key] = val;
            }
        }
        return target;
    }

    sgcom.config = deepExtend({
        cart: {
            mode: 'minicart',
            endpoints: {
                mini_cart: (typeof Defaults !== 'undefined' && Defaults.base_url) ? Defaults.base_url + 'cart/mini_cart' : 'cart/mini_cart'
            },
            urls: {}
        }
    }, sgcom.config || {});

    if (typeof Defaults !== 'undefined' && Defaults.base_url) {
        if (!sgcom.config.cart.urls || !sgcom.config.cart.urls.state) {
            sgcom.config.cart.urls = sgcom.config.cart.urls || {};
            sgcom.config.cart.urls.state = Defaults.base_url + 'do_shopping/cart_state';
        }
        if (!sgcom.config.cart.urls.main) {
            sgcom.config.cart.urls.main = Defaults.base_url + 'cart';
        }
    }

    function renderCartPlaceholder() {
        return '<div class="sgcom-cart-header">' +
            '<span class="placeholder col-4"></span>' +
            '<span class="placeholder btn-close disabled"></span>' +
            '</div>' +
            '<div class="sgcom-mini-cart sg-p-3 placeholder-glow">' +
            Array.from({ length: 4 }).map(function () {
                return '<div class="sg-d-flex sg-gap-3 sg-mb-3">' +
                    '<div class="placeholder col-2 rounded" style="height:56px;"></div>' +
                    '<div class="sg-flex-grow-1">' +
                    '<span class="placeholder col-8 sg-mb-1"></span>' +
                    '<span class="placeholder col-6 sg-mb-1"></span>' +
                    '<span class="placeholder col-4"></span>' +
                    '</div></div>';
            }).join('') +
            '<hr><div class="sg-d-flex sg-justify-content-between sg-mb-2">' +
            '<span class="placeholder col-4"></span><span class="placeholder col-3"></span></div>' +
            '<div class="sg-d-flex sg-justify-content-between sg-mb-2">' +
            '<span class="placeholder col-4"></span><span class="placeholder col-3"></span></div>' +
            '<div class="sg-mt-3">' +
            '<span class="placeholder col-12 btn btn-outline-secondary disabled"></span>' +
            '<span class="placeholder col-12 btn btn-primary disabled sg-mt-2"></span></div></div>';
    }

    sgcom.cart = sgcom.cart || {};
    sgcom.cart.refresh = function (a, b) {
        var cb = typeof a === 'function' ? a : b;
        var url = sgcom.config.cart.urls && sgcom.config.cart.urls.state;
        if (!url) return;
        fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = res.count; });
                if (sgcom.cart._drawer) sgcom.cart._drawer.update(res.html, res.count);
                if (sgcom.cart._popup && sgcom.cart._popup.isOpen && sgcom.cart._popup.isOpen()) sgcom.cart._popup.update(res);
                document.dispatchEvent(new CustomEvent('sgcom:cart:updated', { detail: res }));
                if (typeof cb === 'function') cb(res);
            })
            .catch(function () { if (typeof cb === 'function') cb(null); });
    };

    sgcom.cart.drawer = function () {
        var drawer, backdrop, startX = 0;

        function ensureMarkup() {
            drawer = document.getElementById('sgcom-cart-drawer');
            backdrop = document.querySelector('.sgcom-cart-backdrop');
            if (drawer) {
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.className = 'sgcom-cart-backdrop';
                    drawer.parentNode.insertBefore(backdrop, drawer);
                }
                return;
            }
            var frag = document.createDocumentFragment();
            backdrop = document.createElement('div');
            backdrop.className = 'sgcom-cart-backdrop';
            drawer = document.createElement('div');
            drawer.id = 'sgcom-cart-drawer';
            drawer.className = 'sgcom-cart-drawer';
            frag.appendChild(backdrop);
            frag.appendChild(drawer);
            document.body.appendChild(frag);
            drawer.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; });
            drawer.addEventListener('touchmove', function (e) {
                var diffX = e.touches[0].clientX - startX;
                if (diffX > 80) close();
            });
        }

        function open() {
            ensureMarkup();
            if (!drawer || !backdrop) return;
            drawer.innerHTML = renderCartPlaceholder();
            drawer.classList.remove('open');
            backdrop.classList.remove('show');
            document.body.classList.add('sgcom-drawer-open');
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    if (drawer) drawer.classList.add('open');
                    if (backdrop) backdrop.classList.add('show');
                });
            });
            sgcom.cart.refresh();
        }

        function update(html, count) {
            ensureMarkup();
            if (!drawer) return;
            count = count != null ? count : 0;
            drawer.innerHTML = '<div class="sgcom-cart-header">' +
                '<h5 class="sgcom-cart-title">Your Cart <span class="sgcom-cart-count">(' + count + ')</span></h5>' +
                '<button class="sgcom-minicart-close" aria-label="Close">&times;</button></div>' + (html || '');
        }

        function close() {
            document.body.classList.remove('sgcom-drawer-open');
            if (drawer) drawer.classList.remove('open');
            if (backdrop) backdrop.classList.remove('show');
            if (typeof history.replaceState === 'function' && window.location.hash === '#cart') {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        }

        document.addEventListener('click', function (e) {
            if (e.target.closest('.sgcom-cart-backdrop, .sgcom-minicart-close')) close();
        });
        document.addEventListener('keyup', function (e) { if (e.key === 'Escape') close(); });
        return { open: open, close: close, update: update };
    };

    /* #cart hash: open cart drawer when URL hash is #cart or link with href="#cart" / data-open-cart is clicked */
    (function () {
        function openCartFromHash() {
            if (window.location.hash === '#cart' && sgcom.cart && sgcom.cart.open) sgcom.cart.open('drawer');
        }
        window.addEventListener('hashchange', openCartFromHash);
        if (window.location.hash === '#cart') setTimeout(openCartFromHash, 0);
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest('[href="#cart"], [data-open-cart]');
            if (!trigger) return;
            e.preventDefault();
            if (sgcom.cart && sgcom.cart.open) {
                sgcom.cart.open('drawer');
                if (typeof history.replaceState === 'function') history.replaceState(null, '', window.location.pathname + window.location.search + '#cart');
            }
        });
    })();

    sgcom.cart.popup = function () {
        var modalEl;

        function ensureMarkup() {
            if (document.getElementById('sgcom-popupcart')) {
                modalEl = document.getElementById('sgcom-popupcart');
                return;
            }
            document.body.insertAdjacentHTML('beforeend',
                '<div class="sg-modal fade sgcom-popupcart" id="sgcom-popupcart" tabindex="-1">' +
                '<div class="sg-modal-dialog sg-modal-dialog-centered sg-modal-lg">' +
                '<div class="sg-modal-content">' +
                '<div class="sg-modal-header">' +
                '<h5 class="sg-modal-title">Your Cart <span class="sgcom-cart-count"></span></h5>' +
                '<button type="button" class="btn-close" data-sg-dismiss="modal" aria-label="Close"></button>' +
                '</div><div class="sg-modal-body sgcom-popupcart-body"></div></div></div></div>');
            modalEl = document.getElementById('sgcom-popupcart');
            modalEl.addEventListener('click', function (e) {
                if (e.target === modalEl || e.target.closest('[data-sg-dismiss="modal"]')) close();
            });
            document.addEventListener('keyup', function (e) { if (e.key === 'Escape') close(); });
        }

        function close() {
            if (modalEl) modalEl.classList.remove('show');
        }

        function open() {
            ensureMarkup();
            var body = modalEl.querySelector('.sgcom-popupcart-body');
            var countEl = modalEl.querySelector('.sgcom-cart-count');
            if (body) body.innerHTML = renderCartPlaceholder();
            if (countEl) countEl.textContent = '';
            modalEl.classList.add('show');
            sgcom.cart.refresh(function (state) {
                if (state && modalEl) {
                    if (body) body.innerHTML = state.html || '';
                    if (countEl) countEl.textContent = '(' + (state.count || 0) + ')';
                }
            });
        }

        function update(state) {
            if (!modalEl) return;
            var body = modalEl.querySelector('.sgcom-popupcart-body');
            var countEl = modalEl.querySelector('.sgcom-cart-count');
            if (body) body.innerHTML = state.html || '';
            if (countEl) countEl.textContent = '(' + (state.count || 0) + ')';
        }

        function isOpen() {
            return modalEl && modalEl.classList.contains('show');
        }

        return { open: open, update: update, isOpen: isOpen };
    };

    sgcom.ui = sgcom.ui || {};
    sgcom.ui.toast = function (msg, type, delay) {
        type = type || 'success';
        delay = delay || 3000;
        var container = document.getElementById('sgcom-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sgcom-toast-container';
            container.className = 'sgcom-toast-container';
            document.body.appendChild(container);
        }
        var toast = document.createElement('div');
        toast.className = 'sgcom-toast ' + type;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(function () { toast.remove(); }, 300);
        }, delay);
    };

    sgcom.cart.open = function (modeOverride) {
        var mode = modeOverride || (sgcom.config.cart && sgcom.config.cart.mode) || 'redirect';
        switch (mode) {
            case 'dropdown':
                return;
            case 'drawer':
                sgcom.cart._drawer = sgcom.cart._drawer || sgcom.cart.drawer();
                sgcom.cart._drawer.open();
                return;
            case 'popup':
                sgcom.cart._popup = sgcom.cart._popup || sgcom.cart.popup();
                sgcom.cart._popup.open();
                break;
            case 'redirect':
            default:
                window.location.href = (sgcom.config.cart && sgcom.config.cart.urls && sgcom.config.cart.urls.main) || '';
                return;
        }
    };

    sgcom.cart.handleSuccess = function (res) {
        var mode = (sgcom.config.cart && sgcom.config.cart.mode) || 'redirect';
        if (mode === 'minicart') mode = 'drawer';
        switch (mode) {
            case 'drawer':
                sgcom.cart._drawer = sgcom.cart._drawer || sgcom.cart.drawer();
                if (sgcom.cart._drawer && sgcom.cart._drawer.open) {
                    setTimeout(function () { sgcom.cart._drawer.open(); }, 0);
                }
                break;
            case 'popup':
                sgcom.cart._popup = sgcom.cart._popup || sgcom.cart.popup();
                if (sgcom.cart._popup && sgcom.cart._popup.open) {
                    setTimeout(function () { sgcom.cart._popup.open(); }, 0);
                }
                break;
            case 'toast':
                sgcom.ui.toast(res && res.msg ? res.msg : 'Added to cart', 'success');
                break;
            case 'auto':
                window.location.href = window.location.href;
                break;
            case 'redirect':
            default:
                window.location.href = (sgcom.config.cart && sgcom.config.cart.urls && sgcom.config.cart.urls.main) || '';
                break;
        }
    };

    function toElements(selOrEl) {
        if (typeof selOrEl === 'string') return Array.prototype.slice.call(document.querySelectorAll(selOrEl));
        if (selOrEl && selOrEl.nodeType === 1) return [selOrEl];
        if (selOrEl && (selOrEl.length !== undefined || selOrEl.forEach)) return Array.prototype.slice.call(selOrEl);
        return [];
    }

    /* ========== sgcomProducts ========== */
    function initSgcomProducts(selector) {
        toElements(selector).forEach(function (wrapper) {
            function getBaseUrl() {
                return (window.Defaults && (Defaults.current_url || Defaults.base_url)) || window.location.pathname;
            }

            function buildUrl(paramsObj) {
                paramsObj = paramsObj || {};
                var base = getBaseUrl();
                var url = new URL(base, window.location.origin);
                var current = new URL(window.location.href);
                current.searchParams.forEach(function (v, k) { url.searchParams.set(k, v); });
                Object.keys(paramsObj).forEach(function (key) {
                    var val = paramsObj[key];
                    if (val !== null && val !== '') url.searchParams.set(key, val);
                });
                return url.toString();
            }

            function updateQueryParam(key, value) {
                window.history.replaceState(null, '', buildUrl({ [key]: value }));
            }

            function loadProducts(urlString) {
                var url = new URL(urlString, window.location.origin);
                var params = {};
                url.searchParams.forEach(function (v, k) { params[k] = v; });
                var blockArgs = {};
                try {
                    var dataArgs = wrapper.getAttribute('data-args');
                    if (dataArgs) blockArgs = JSON.parse(dataArgs);
                } catch (e) {}
                var dataToSend = Object.assign({}, blockArgs, params);
                var qs = Object.keys(dataToSend).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(dataToSend[k]); }).join('&');
                var productsEl = wrapper.querySelector('.sgcom-products');
                if (productsEl) productsEl.classList.add('loading');
                fetch((typeof Defaults !== 'undefined' ? Defaults.base_url : '') + 'do_shopping/ajax_get_products?' + qs, { credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (productsEl && res.products_html) {
                            var parent = productsEl.parentNode;
                            var div = document.createElement('div');
                            div.innerHTML = res.products_html;
                            while (div.firstChild) parent.insertBefore(div.firstChild, productsEl);
                            productsEl.remove();
                        }
                        if (window.SGPlugins && SGPlugins.sgCarousel) SGPlugins.sgCarousel(wrapper.querySelectorAll('.sgen--blocks_carousel'));
                    })
                    .finally(function () {
                        if (productsEl) productsEl.classList.remove('loading');
                    });
            }

            function reloadProducts() {
                var sortEl = wrapper.querySelector('.sgcom-sort-control');
                var layoutEl = wrapper.querySelector('.sgcom-view-grid.active, .sgcom-view-list.active');
                var sort = sortEl ? sortEl.value : '';
                var layout = layoutEl && (layoutEl.getAttribute('data-layout') || layoutEl.dataset.layout) || '';
                window.location.href = buildUrl({ sortby: sort, layout: layout });
            }

            wrapper.addEventListener('change', function (e) {
                if (e.target.classList && e.target.classList.contains('sgcom-sort-control')) reloadProducts();
            });
            wrapper.addEventListener('click', function (e) {
                var t = e.target.closest('.sgcom-view-grid, .sgcom-view-list');
                if (!t) return;
                wrapper.querySelectorAll('.sgcom-view-grid, .sgcom-view-list').forEach(function (el) { el.classList.remove('active'); });
                t.classList.add('active');
                updateQueryParam('layout', t.getAttribute('data-layout') || t.dataset.layout || '');
                reloadProducts();
            });
        });
    }

    /* ========== sgcomProductForm ========== */
    function initSgcomProductForm(selector, options) {
        var settings = Object.assign({
            attributeWrapper: '.variant-selection-item',
            priceSelector: '.sgcom-product-price',
            stockSelector: '.sgcom-product-stock'
        }, options || {});
        toElements(selector).forEach(function (formEl) {
            var variations = [];
            try {
                var v = formEl.getAttribute('data-variations') || formEl.dataset.variations;
                if (v) variations = JSON.parse(v);
            } catch (e) {}
            if (!variations.length) return;

            var priceBox = document.querySelector(settings.priceSelector);
            var stockBox = document.querySelector(settings.stockSelector);

            function getSelectedAttrs() {
                var attrs = {};
                formEl.querySelectorAll(settings.attributeWrapper).forEach(function (wrap) {
                    var attrId = parseInt(wrap.getAttribute('data-attribute_id') || wrap.dataset.attribute_id, 10);
                    if (!attrId) return;
                    var radio = wrap.querySelector('input[type="radio"]:checked');
                    if (radio) {
                        attrs[attrId] = parseInt(radio.value, 10);
                        return;
                    }
                    var sel = wrap.querySelector('select');
                    if (sel) attrs[attrId] = parseInt(sel.value, 10) || 0;
                });
                return attrs;
            }

            function findVariant() {
                var selected = getSelectedAttrs();
                return variations.find(function (v) {
                    if (Object.keys(selected).length !== v.terms.length) return false;
                    return v.terms.every(function (t) { return selected[t.attribute_id] == t.value; });
                });
            }

            var variantDataKey = '_sgcomSelectedVariant';
            function updateUI() {
                var v = findVariant();
                if (!v) {
                    formEl[variantDataKey] = undefined;
                    formEl.dispatchEvent(new CustomEvent('sgcom:variant:reset', { bubbles: true }));
                    return;
                }
                formEl[variantDataKey] = v._rowid || true;
                if (priceBox && v.price_display) priceBox.innerHTML = v.price_display;
                if (stockBox) {
                    var stock = (v.stock - v.sold + v.refund);
                    stockBox.classList.toggle('sg-text-danger', stock <= 0);
                    stockBox.classList.toggle('sg-text-success', stock > 0);
                    stockBox.textContent = stock > 0 ? stock + ' in stock' : 'Out of stock';
                }

                // Update quantity field max attribute based on variant stock
                var qtyField = formEl.querySelector('.sgcom-product-qty');
                if (qtyField) {
                    var availableStock = v.stock - v.sold + v.refund;
                    availableStock = Math.max(0, availableStock);
                    qtyField.setAttribute('max', availableStock);
                    if (parseInt(qtyField.value) > availableStock) {
                        qtyField.value = availableStock > 0 ? 1 : 0;
                    }
                }

                formEl.dispatchEvent(new CustomEvent('sgcom:variant:change', { bubbles: true, detail: v }));
            }

            formEl.addEventListener('change', function (e) {
                if (e.target.tagName === 'SELECT') updateUI();
                if (e.target.type === 'radio' && e.target.closest(settings.attributeWrapper)) {
                    var wrap = e.target.closest(settings.attributeWrapper);
                    if (wrap) {
                        wrap.querySelectorAll('.active').forEach(function (a) { a.classList.remove('active'); });
                        var label = e.target.closest('label');
                        if (label) label.classList.add('active');
                    }
                    updateUI();
                }
            });
            // Handle variant reset for quantity field
            document.addEventListener('sgcom:variant:reset', function (e) {
                if (e.target !== formEl) return;
                var qtyField = formEl.querySelector('.sgcom-product-qty');
                if (qtyField) {
                    var initialMax = qtyField.getAttribute('data-initial-max') || '0';
                    qtyField.setAttribute('max', initialMax);
                    qtyField.value = '1';
                }
            });

            formEl.addEventListener('submit', function (e) {
                e.preventDefault();
                var hasVariants = formEl.querySelectorAll('.variant-selection-item').length > 0;
                if (hasVariants && !formEl[variantDataKey]) {
                    sgcom.ui.toast('Please select product options', 'error');
                    return;
                }
                var submitBtn = formEl.querySelector('[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.classList.add('loading');
                    submitBtn.textContent = 'Adding...';
                }
                var formData = new FormData(formEl);
                var addUrl = (typeof formEl.action === 'string' && formEl.action) ? formEl.action : (sgcom.config.cart && sgcom.config.cart.urls && sgcom.config.cart.urls.add) || '';
                fetch(addUrl, {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                }).then(function (r) { return r.json(); }).then(function (res) {
                    if (res && res.error) {
                        sgcom.ui.toast(res.msg || 'Error adding to cart', 'error');
                        return;
                    }
                    sgcom.cart.handleSuccess(res || {});
                    document.dispatchEvent(new CustomEvent('sgcom:cart:added', { detail: res }));
                }).catch(function () {
                    sgcom.ui.toast('Could not add to cart', 'error');
                }).finally(function () {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('loading');
                        submitBtn.textContent = 'Add to cart';
                    }
                });
            });
            setTimeout(updateUI, 100);
        });
    }

    /* ========== sgcomProductGallery ========== */
    function initSgcomProductGallery(selector) {
        toElements(selector).forEach(function (gallery) {
            var mainImg = gallery.querySelector('.thumb img');
            var defaultSrc = mainImg && (mainImg.getAttribute('data-default') || mainImg.dataset.default);
            var galleryRow = gallery.querySelector('.gallery');
            var originalGalleryHTML = galleryRow ? galleryRow.innerHTML : '';

            function setActiveThumb(thumb) {
                if (!galleryRow) return;
                galleryRow.querySelectorAll('.gallery-thumb').forEach(function (t) { t.classList.remove('active'); });
                if (thumb) thumb.classList.add('active');
            }

            // Activate first thumb on init
            if (galleryRow) {
                var firstThumb = galleryRow.querySelector('.gallery-thumb');
                if (firstThumb) firstThumb.classList.add('active');
            }

            gallery.addEventListener('click', function (e) {
                var thumb = e.target.closest('.gallery-thumb');
                if (!thumb || !mainImg) return;
                var url = thumb.getAttribute('data-main') || thumb.dataset.main || thumb.src;
                if (url) {
                    mainImg.src = url;
                    mainImg.dispatchEvent(new CustomEvent('sgZoomRefresh'));
                }
                setActiveThumb(thumb);
            });
            document.addEventListener('sgcom:variant:change', function (e) {
                var v = e.detail;
                if (!v || !mainImg) return;
                if (v.thumbnail) {
                    mainImg.src = v.thumbnail;
                    mainImg.dispatchEvent(new CustomEvent('sgZoomRefresh'));
                }
                // Rebuild gallery row with variant images
                if (galleryRow && v.gallery_images && v.gallery_images.length) {
                    var items = [];
                    if (v.thumbnail) {
                        items.push({ thumb: v.thumbnail, main: v.thumbnail });
                    }
                    v.gallery_images.forEach(function (gi) { items.push(gi); });
                    galleryRow.innerHTML = '';
                    items.forEach(function (img, idx) {
                        var div = document.createElement('div');
                        div.className = 'gallery-item';
                        var imgEl = document.createElement('img');
                        imgEl.src = img.thumb;
                        imgEl.setAttribute('data-main', img.main);
                        imgEl.className = 'gallery-thumb' + (idx === 0 ? ' active' : '');
                        div.appendChild(imgEl);
                        galleryRow.appendChild(div);
                    });
                } else if (v.thumbnail && galleryRow) {
                    // No variant-specific gallery — restore original then swap first thumb to variant image
                    galleryRow.innerHTML = originalGalleryHTML;
                    var firstThumb = galleryRow.querySelector('.gallery-thumb');
                    if (firstThumb) {
                        firstThumb.src = v.thumbnail;
                        firstThumb.setAttribute('data-main', v.thumbnail);
                    }
                    setActiveThumb(firstThumb);
                }
            });
            document.addEventListener('sgcom:variant:reset', function () {
                if (mainImg && defaultSrc) {
                    mainImg.src = defaultSrc;
                    mainImg.dispatchEvent(new CustomEvent('sgZoomRefresh'));
                }
                if (galleryRow && originalGalleryHTML) {
                    galleryRow.innerHTML = originalGalleryHTML;
                    setActiveThumb(galleryRow.querySelector('.gallery-thumb'));
                }
            });
        });
    }

    /* ========== sgcomProductZoom ========== */
    function initSgcomProductZoom(selector, zoomFactor) {
        zoomFactor = zoomFactor || 2;
        toElements(selector).forEach(function (img) {
            var wrapper = img.closest('.thumb');
            if (!wrapper) return;
            var zoomPane = wrapper.querySelector('.zoom-pane');
            if (!zoomPane) {
                zoomPane = document.createElement('div');
                zoomPane.className = 'zoom-pane';
                wrapper.appendChild(zoomPane);
            }

            function refreshZoom() {
                var rect = wrapper.getBoundingClientRect();
                var cw = rect.width;
                var ch = rect.height;
                var nw = img.naturalWidth;
                var nh = img.naturalHeight;
                if (!nw || !nh) return;
                var ratio = nw / nh;
                var dw, dh;
                if (ratio < 1) { dh = ch; dw = ch * ratio; } else { dw = cw; dh = cw / ratio; }
                zoomPane.style.backgroundImage = 'url("' + img.src.replace(/"/g, '\\"') + '")';
                zoomPane.style.backgroundSize = (dw * zoomFactor) + 'px ' + (dh * zoomFactor) + 'px';
            }

            function moveZoom(e) {
                var rect = img.getBoundingClientRect();
                var x = e.pageX - rect.left;
                var y = e.pageY - rect.top;
                x = Math.max(0, Math.min(x, rect.width));
                y = Math.max(0, Math.min(y, rect.height));
                var xp = (x / rect.width) * 100;
                var yp = (y / rect.height) * 100;
                zoomPane.style.backgroundPosition = xp + '% ' + yp + '%';
            }

            wrapper.addEventListener('mouseenter', function () { refreshZoom(); zoomPane.style.display = ''; });
            wrapper.addEventListener('mouseleave', function () { zoomPane.style.display = 'none'; });
            wrapper.addEventListener('mousemove', moveZoom);
            img.addEventListener('load', refreshZoom);
            img.addEventListener('sgZoomRefresh', refreshZoom);
            refreshZoom();
        });
    }

    window.SGEcomPlugins = {
        products: initSgcomProducts,
        productForm: initSgcomProductForm,
        productGallery: initSgcomProductGallery,
        productZoom: initSgcomProductZoom
    };

    if (typeof jQuery !== 'undefined') {
        jQuery.fn.sgcomProducts = function () { initSgcomProducts(this); return this; };
        jQuery.fn.sgcomProductForm = function (opts) { initSgcomProductForm(this, opts); return this; };
        jQuery.fn.sgcomProductGallery = function () { initSgcomProductGallery(this); return this; };
        jQuery.fn.sgcomProductZoom = function (zf) { initSgcomProductZoom(this, zf); return this; };
    }
})();
