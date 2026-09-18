/* =============================================================================
   story-rows.js — direction D, "editorial rows", for the long store-story block.

   OWNER PICK from the four layouts at
   claude.ai/code/artifact/e47a7b8a-9ea7-4a7d-9479-b9ef8e358f5a — "let's go with D".

   WHAT IT DOES
   Takes the "Learn About Nova Farms <store>" run — today a wall of 15 stacked
   paragraphs — and turns each H2 and the prose under it into an alternating
   image/text row.

   WHY IT IS STRUCTURAL AND NOT A TEMPLATE
   The block is NOT the same section on every store. Measured heading counts in
   the run: New Britain 11, Dracut 10, Woodbury 9, Attleboro 7. The headings
   differ too — Dracut has "Why Shop at Nova Farms?" with three H3 sub-blocks,
   Attleboro has "Why Visit / What Is Our Dispensary Near / Check Out the
   Offers", Woodbury has five including "Local Attractions". Only the closing
   boilerplate is shared. So nothing here matches on heading text: it walks the
   run and starts a new row at every H2, which works for three blocks or five.

   WHICH PAGES: attleboro-ma, dracut-ma, locations-newbritain-ct, woodbury-nj.
   Verified by grep — those are the four that carry the run. framingham-ma and
   greenville-me are stubs on the client's own live site and have none of this
   copy, so this script finds no anchor there and does nothing. index.html has
   no such block either. That is correct behaviour, not a gap in the script.

   ⚠ THE IMAGERY IS STILL MOSTLY NOT OF THE STORE. Inventoried across the whole
   assets tree, and re-checked against the live WordPress media library (783
   items enumerated via wp-json, not guessed from filenames):
     - the store photos shipped as 800x305 letterbox strips with no retina
       headroom at the ~550px these render at. There was no higher-resolution
       master anywhere -- not on disk, and not upstream: the live site's largest
       derivative is also 800x305. They have since been resolution-restored with
       a faithful upscaler (Topaz precision, no generative detail), so the strips
       are no longer the constraint they were;
     - Dracut still has ONE store photograph. Woodbury has TWO -- its sales floor
       and its exterior -- and rows 1 and 2 used to show the same one twice;
     - the two 300x300 store interiors were deliberately unused here because they
       upscaled 1.7x; they have since been restored to 1200x1200 as well;
     - there is NO staff photography anywhere in the bundle. Not one file.
   So of the fifteen rows this fills, seven use the store's own photograph and
   eight fall back to farm, brand or interior imagery. Every row that does
   carries data-nf-fallback="true" in the DOM. Higher resolution is not the same
   thing as having the picture: new store photography is still the only real fix.

   NO COPY IS REWRITTEN and no element is deleted — the client's own widgets are
   moved into row containers, so removing the two injected lines from the four
   pages restores the pages exactly.
   ============================================================================= */
(function () {
  'use strict';

  /* Art per store, in row order. Chosen against measured dimensions, not
     filenames. `fallback: true` means "this is not a photograph of this store".
     16:9 is the row aspect (see story-rows.css) because it is near-native for
     BOTH the 800x305 strips and the 1.78 farm imagery. */
  var ART = {
    attleboro: [
      { src: 'assets/in-pages/attleboro-updated-thumbnail.webp' },
      { src: 'assets/in-pages/nova-rebrand-hero-nate-farm-1-scaled.webp', fallback: true },
      { src: 'assets/in-pages/new-attleboro-store-interior.webp' }
    ],
    dracut: [
      { src: 'assets/in-pages/dracut-thumbnail.webp' },
      { src: 'assets/in-pages/farm-nova-2025-bg.webp', fallback: true },
      { src: 'assets/deals/deal-store-interior.jpg', fallback: true }
    ],
    newbritain: [
      { src: 'assets/in-pages/newbritain-thumbnail.webp' },
      { src: 'assets/in-pages/newbritain-ct-rotator-hero-bg.webp', fallback: true },
      { src: 'assets/in-pages/newbritain-interior-2.webp' }
    ],
    /* Woodbury's prose run is SIX H2s, not four, so a three-entry pool starved
       rows 4-6 of art entirely — 1140px-wide single-column rows with ~554px of
       dead space beside the text at 1440. That is the "missing images" the
       client reported. Three further defects were measured in the old pool and
       are fixed here rather than carried forward:

         - rows 1 and 2 were THE SAME PHOTOGRAPH. woodbury-thumbnail.webp is an
           800x305 letterbox crop of nj-rotator-best-dispensary-bg.webp (mean
           |diff| 18.4/255 on the best-matching window, against 72.1 for an
           unrelated Nova interior). The strip is dropped; the scene survives at
           row 1 at its native 1920x1080 instead of upscaling 2.03x.
         - nj-rotator-best-dispensary-bg was marked fallback:true and is NOT a
           fallback — its rotator top-layer reads "2025 NEW JERSEY — WINNER —
           BEST DISPENSARY". It is the Woodbury sales floor. Flag removed.
         - farm-texture-fullscreen-web-1.webp is not a photograph at all. It is a
           2400x1600 RGBA overlay, RGB mean 223/223/223 with a flat 22.5 stdev
           per channel and alpha mean 141 — a semi-transparent diagonal-stripe
           texture, which is why row 3 rendered as a pale striped placeholder.

       Row 5 is the store's own exterior: pylon sign, ENTER/EXIT, and the parking
       its copy promises ("Ample parking is available right in front of the
       store"). Sourced from the live WordPress media library, which was
       enumerated in full (783 items) to establish that Woodbury has exactly two
       usable photographs — this one and the sales floor. The rest stay honest
       fallbacks. New Woodbury photography is still the real fix. */
    woodbury: [
      { src: 'assets/in-pages/nj-rotator-best-dispensary-bg.webp' },
      { src: 'assets/in-pages/farm-nova-2025-bg.webp', fallback: true },
      { src: 'assets/in-pages/sprawling-farm.jpg', fallback: true },
      { src: 'assets/in-pages/joint-line-up.jpg', fallback: true },
      { src: 'assets/in-pages/Nova-Farms-Woodbury-edited-resized.jpg' },
      { src: 'assets/in-pages/thorndike-nova-sized.webp', fallback: true }
    ]
  };

  function storeId() {
    try {
      var s = window.NovaStores && window.NovaStores.viewing && window.NovaStores.viewing();
      if (s && s.id) return s.id;
    } catch (e) { /* store context absent, or private mode */ }
    return null;
  }

  function headingIn(node) {
    return node.querySelector('h2, h3');
  }

  function build(lead) {
    // the Elementor widget wrapping the "Learn About..." heading
    var widget = lead;
    while (widget && !/elementor-element-[0-9a-f]{6,}/.test(widget.className || '')) {
      widget = widget.parentElement;
    }
    if (!widget) return;
    var run = widget.parentElement;                       // the .e-con-inner
    if (!run || run.getAttribute('data-nf-story')) return;   // idempotent

    var kids = Array.prototype.slice.call(run.children);
    if (kids.length < 3) return;

    /* Group: the first child is the section label and stays full width. After
       that, a child whose first heading is an H2 opens a new group; everything
       until the next H2 belongs to it. */
    var groups = [], cur = null;
    for (var i = 1; i < kids.length; i++) {
      var h = headingIn(kids[i]);
      if (h && h.tagName === 'H2') {
        cur = { head: kids[i], body: [] };
        groups.push(cur);
      } else if (cur) {
        cur.body.push(kids[i]);
      }
    }
    if (groups.length < 2) return;                        // nothing to lay out

    var pool = ART[storeId()] || [];

    groups.forEach(function (g, n) {
      var row = document.createElement('div');
      row.className = 'nf-story__row' + (n % 2 ? ' is-flipped' : '');

      var text = document.createElement('div');
      text.className = 'nf-story__text';

      // Insert the row where the group's heading currently sits, THEN move the
      // widgets in — so document order, and therefore reading order, is
      // unchanged for a screen reader.
      run.insertBefore(row, g.head);

      var art = pool[n];
      if (art) {
        var fig = document.createElement('div');
        fig.className = 'nf-story__art';
        // Decorative: every row's meaning is in the heading and prose beside it,
        // so an alt would only repeat what is about to be read.
        fig.setAttribute('role', 'presentation');
        if (art.fallback) fig.setAttribute('data-nf-fallback', 'true');

        /* A REAL <img>, not the inline CSS background this used to set.

           WHY IT CHANGED. Elementor ships a container lazy-load rule inline in
           each of these four pages (woodbury-nj.html:1201-1204 and the same
           block in the other three):

               .e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload),
               .e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload) *
               { background-image: none !important; }

           The trailing " *" kills backgrounds on every descendant, and an
           !important STYLESHEET declaration beats an inline style, so while
           that rule is live the art div's own style attribute holds the right
           url() and getComputedStyle reports "none".

           ⚠ CORRECTION, and it matters: that rule DOES lift for a real reader,
           and an earlier version of this comment claimed it never did. The page
           ships an IntersectionObserver (woodbury-nj.html, the inline script
           after the footer) with rootMargin 200px that adds .e-lazyloaded and
           then unobserve()s, so the class is permanent once a container comes
           near the viewport. Measured on the pre-fix code with a human-paced
           scroll (600px steps, 350ms dwell): .e-lazyloaded goes 2/28 at load to
           16/29, and all three art divs paint their backgrounds. The "12 blanked
           pictures" finding was an artifact of a probe that scrolled in 30-45ms
           steps — faster than an IntersectionObserver callback can run — and
           then jumped back to the top. Do not trust a fast synthetic scroll to
           tell you what this page does.

           So an <img> is NOT load-bearing for correctness here. It is kept
           because it is still the better element for the job — the browser owns
           loading, decoding and srcset, object-fit does the cropping, and the
           element is structurally out of reach of any background-image rule —
           but it buys robustness, not a bug fix. The real defect on this section
           was the ART pool being shorter than the heading run (see ART above).

           For the record, since it was measured: moving the url into a custom
           property and re-declaring background-image: var(--nf-art) !important
           in our own sheet does NOT work. Both declarations are author-origin
           !important, so specificity decides, and Elementor's (0,5,0) selector
           outranks our (0,2,0) one.

           loading="lazy" IS set, and the earlier rationale for omitting it was
           wrong on its facts. It claimed "the CSS background it replaces was
           eager"; it was not — a background-image computing to none is never
           requested at all, and once it does resolve it is gated by the same
           IntersectionObserver above. Leaving these eager made 12 decorative
           pictures, all of them 4-7 screens below the fold, load on first paint:
           measured +6 image requests before any scroll on this page alone, and
           about +1.2MB across the four story pages. */
        var img = document.createElement('img');
        img.className = 'nf-story__img';
        img.src = art.src;
        img.alt = '';                              // decorative, see above
        img.setAttribute('aria-hidden', 'true');   // keep it out of the a11y tree
        img.decoding = 'async';
        img.loading = 'lazy';                      // 4-7 screens down; see above
        fig.appendChild(img);

        row.appendChild(fig);
      } else {
        row.className += ' is-plain';       // no art left in the pool
      }

      row.appendChild(text);
      text.appendChild(g.head);
      g.body.forEach(function (b) { text.appendChild(b); });
    });

    run.setAttribute('data-nf-story', 'rows');

    // The contrast corrector may already have walked this subtree.
    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  function init() {
    var heads = document.querySelectorAll('h2');
    for (var i = 0; i < heads.length; i++) {
      if (/^Learn About Nova Farms/i.test((heads[i].textContent || '').trim())) {
        build(heads[i]);
        return;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  window.addEventListener('load', init);
})();
