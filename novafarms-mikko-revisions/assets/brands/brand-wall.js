/* =============================================================================
   brand-wall.js — the homepage brand wall as three marquee columns.

   OWNER 2026-09-10: "left most column should marquee up, then mid column
   marquee down, then right most column marquee up. Edges top and bottom should
   fade into white to avoid ugly looking crop." Plus rounded corners.

   This REPLACES the scroll-linked drift that was here. That version moved the
   columns only while the reader scrolled; this one runs continuously, which is
   what was asked for and is a different thing to build: a marquee needs its
   content duplicated so the loop has somewhere to go.

   WHAT THE WALL IS (measured -- none of it is guessable from the markup):
     9 cells, 166x170 each, in a .e-grid with gap 0
     TWO layers per cell: these are Elementor FLIP-BOXES, front and back
     1 real link in the whole wall (Highlands -> smokehighlands.com)
     the ground behind it is rgb(239,240,241), which is the "white" to fade into
     the section is lazy-loaded, so none of it exists until scrolled to

   PAUSE ON HOVER AND ON FOCUS, and that is not a nicety. The cells flip on
   hover and one of them is a link; a column that keeps moving under the pointer
   makes both unusable, and content that moves for more than five seconds needs
   a way to stop (WCAG 2.2.2). Hovering a column stops that column, and
   focus-within stops it for keyboard users who cannot hover at all.

   THE CLONES ARE HIDDEN FROM ASSISTIVE TECH. Each column's tiles are duplicated
   to make the loop seamless, so without aria-hidden and inert tab handling a
   screen reader would announce nine brands as eighteen, and the Highlands link
   would appear twice in the tab order.

   MOTION IS GATED THE WAY THE REST OF THIS BUILD GATES IT: the OS
   prefers-reduced-motion and this site's own "Stop animations" switch
   (data-a11y-motion) both stop it dead, and the switch is watched live so it
   takes effect without a reload. When motion is off the wall renders as a plain
   static grid -- the original layout, not a frozen marquee.
   ============================================================================= */
(function () {
  'use strict';

  var built = false, wall = null, srcCells = [], grid = null;

  function motionOff() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
             document.documentElement.getAttribute('data-a11y-motion') === 'off';
    } catch (e) { return false; }
  }

  /* The wall, identified by shape rather than by a class that means nothing on
     its own: a grid whose children carry flip-box layers painting images.
     `.e-grid` alone is on 45 of the 47 pages. */
  function findWall() {
    var grids = document.querySelectorAll('.e-grid, [class*="e-grid"]');
    for (var i = 0; i < grids.length; i++) {
      var g = grids[i];
      if (window.getComputedStyle(g).display !== 'grid') continue;
      if (g.children.length < 6) continue;
      var painted = 0;
      for (var k = 0; k < g.children.length; k++) {
        var layer = g.children[k].querySelector('.elementor-flip-box__layer');
        if (!layer) continue;
        var bi = window.getComputedStyle(layer).backgroundImage;
        if (bi && bi !== 'none' && bi.indexOf('url(') > -1) painted++;
      }
      if (painted >= 6) return g;
    }
    return null;
  }

  /* Counting the tracks is only reliable while the element IS a grid box.
     Once the marquee mounts, data-nf-wallhost makes it `display: block`, and a
     non-grid box reports the SPECIFIED value instead of resolved tracks:

         display:grid  @1440 -> "158.109px 158.125px 158.125px"   -> 3  correct
         MOUNTED block @1440 -> "repeat(3, 1fr)"                  -> 2  WRONG
         MOUNTED block @375  -> "repeat(2, 1fr)"                  -> 2  accidentally right

     Splitting "repeat(3, 1fr)" on whitespace yields two tokens, so desktop read
     2 while build() had created 3. The resize handler compares that count with
     wall.children.length, so it never matched and the wall was TORN DOWN AND
     REBUILT ON EVERY RESIZE EVENT at >=768. Mobile was stable only because the
     wrong answer happened to equal the right one.

     Parse the repeat() form explicitly, and keep the track-splitting path for
     the resolved-grid case. */
  var BASE_SECONDS = 34;   /* must match the animation duration in brand-wall.css */

  function columnCount(g) {
    var tpl = window.getComputedStyle(g).gridTemplateColumns;
    if (!tpl || tpl === 'none') return 1;
    var rep = /^\s*repeat\(\s*(\d+)\s*,/.exec(tpl);
    if (rep) return parseInt(rep[1], 10);
    return tpl.split(/\s+/).filter(Boolean).length;
  }

  function deactivate(node) {
    node.setAttribute('aria-hidden', 'true');
    var focusable = node.querySelectorAll('a[href],button,input,select,textarea,[tabindex]');
    for (var i = 0; i < focusable.length; i++) focusable[i].setAttribute('tabindex', '-1');
  }

  /* Every track animates for a fixed 34s (see the CSS) and travels -50% of its
     OWN height, so a taller track covers more ground in the same time and the
     columns drift at different speeds. Measured on the built wall:

         @1440  col0 480px/34s = 14.1 px/s   col1,col2 510px/34s = 15.0 px/s
         @375   col0 820px/34s = 24.1 px/s   col1       680px/34s = 20.0 px/s

     Mobile is the worse case: 9 source cells split 5/4 across two columns, then
     duplicated, so one track is a quarter taller than the other and visibly
     outruns it. Desktop is uneven too, just less.

     Scale each duration to its own travel so px/sec is constant. The LONGEST
     track keeps the authored 34s and the shorter ones get proportionally less,
     so nothing slows down -- the slower columns speed up to match.

     Sets animation-duration ONLY. It touches no box, no column count and no
     track content, so the -50% loop geometry is untouched -- which is the
     property the reverted margin-block change did not have. Motion-off still
     wins: those rules set `animation: none !important`, which outranks an
     inline duration. */
  function normaliseSpeed() {
    if (!wall) return;
    var tracks = wall.querySelectorAll('.nf-wall__track');
    var travel = [], i;
    for (i = 0; i < tracks.length; i++) {
      travel.push(tracks[i].getBoundingClientRect().height / 2);
    }
    var max = Math.max.apply(null, travel);
    if (!max || !isFinite(max)) return;
    for (i = 0; i < tracks.length; i++) {
      var secs = BASE_SECONDS * (travel[i] / max);
      if (secs > 0 && isFinite(secs)) {
        tracks[i].style.animationDuration = secs.toFixed(2) + 's';
      }
    }
  }

  function build() {
    if (built) return true;
    grid = findWall();
    if (!grid) return false;

    var cols = columnCount(grid);
    if (cols < 2) return false;                 // nothing to alternate

    srcCells = Array.prototype.slice.call(grid.children);
    if (srcCells.length < cols * 2) return false;   // too short to loop convincingly

    grid.setAttribute('data-nf-brandwall', '');

    wall = document.createElement('div');
    wall.className = 'nf-wall';
    wall.setAttribute('data-nf-wall', '');

    /* The wall must occupy the grid's slot exactly, and copying the grid's
       computed box does NOT achieve that -- I measured it. The section's
       .e-con-inner is a flex row (copy column 611, then this, then the grid at
       489), and a new sibling div computes flex-grow 0 with flex-basis auto
       while the columns inside it are `flex: 1 1 0` and contribute no intrinsic
       width: the wall came out 0px and the marquee was invisible. Copying
       flexGrow/Basis/width off the grid got it to 314px, still not the grid's
       489, because a flex item's resolved size is not reproducible from its own
       computed properties.

       So the wall goes INSIDE the grid instead of beside it. The grid stays the
       flex item and keeps whatever width the row gives it at any breakpoint;
       the wall simply fills it. The grid's own `display: grid` is neutralised to
       block while the marquee is mounted, and restored when motion is off. */

    for (var c = 0; c < cols; c++) {
      var col = document.createElement('div');
      col.className = 'nf-wall__col';
      // Left up, next down, next up -- alternating from the left, as asked.
      col.setAttribute('data-nf-dir', (c % 2 === 0) ? 'up' : 'down');

      var track = document.createElement('div');
      track.className = 'nf-wall__track';

      for (var i = c; i < srcCells.length; i += cols) {
        srcCells[i].setAttribute('data-nf-brandtile', '');
        track.appendChild(srcCells[i]);
      }
      // The duplicate half that makes the loop seamless.
      var originals = Array.prototype.slice.call(track.children);
      for (var d = 0; d < originals.length; d++) {
        var clone = originals[d].cloneNode(true);
        clone.setAttribute('data-nf-brandtile', '');
        clone.setAttribute('data-nf-clone', '');
        deactivate(clone);
        track.appendChild(clone);
      }

      col.appendChild(track);
      wall.appendChild(col);
    }

    grid.appendChild(wall);
    grid.setAttribute('data-nf-wallhost', '');  // display:grid -> block, see CSS
    built = true;
    sync();
    normaliseSpeed();
    return true;
  }

  /* When motion is off the marquee is not merely paused -- the original grid is
     shown instead, so the reader gets the plain static layout rather than a
     frozen strip with half its tiles clipped by the mask. */
  function sync() {
    if (!built) return;
    var off = motionOff();
    wall.hidden = off;
    if (off) {
      // Put the real tiles back into the real grid, so the reader gets the
      // original static layout rather than a frozen strip clipped by the mask.
      grid.removeAttribute('data-nf-wallhost');
      for (var i = 0; i < srcCells.length; i++) grid.appendChild(srcCells[i]);
    } else {
      grid.setAttribute('data-nf-wallhost', '');
      var cols = wall.querySelectorAll('.nf-wall__track');
      var n = wall.children.length;
      for (var c = 0; c < n; c++) {
        var track = wall.children[c].querySelector('.nf-wall__track');
        for (var k = c; k < srcCells.length; k += n) {
          track.insertBefore(srcCells[k], track.children[Math.floor(k / n)] || null);
        }
      }
    }
  }

  function init() {
    if (!build()) {
      // Lazy-loaded: retry as the page moves.
      var tries = 0;
      var retry = function () {
        if (build() || ++tries > 40) {
          window.removeEventListener('scroll', retry);
        }
      };
      window.addEventListener('scroll', retry, { passive: true });
      window.addEventListener('load', retry);
      window.setTimeout(retry, 600);
      window.setTimeout(retry, 2000);
    }

    try {
      new MutationObserver(sync).observe(document.documentElement,
        { attributes: true, attributeFilter: ['data-a11y-motion'] });
    } catch (e) {}
    try {
      window.matchMedia('(prefers-reduced-motion: reduce)')
            .addEventListener('change', sync);
    } catch (e) {}
    window.addEventListener('resize', function () {
      // Column count can change with width; rebuild from the source grid.
      if (!built || !grid) return;
      if (columnCount(grid) === wall.children.length) return;
      wall.parentNode.removeChild(wall);
      grid.removeAttribute('data-nf-wallhost');
      for (var i = 0; i < srcCells.length; i++) grid.appendChild(srcCells[i]);
      built = false; wall = null;
      build();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NovaBrandWall = { build: build, sync: sync };
})();
