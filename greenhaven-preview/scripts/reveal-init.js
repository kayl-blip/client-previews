/* Runs in <head>, before anything is painted. Three jobs: the age gate (see below); starting the
   menu page at the top; and marking the document so [data-reveal] blocks start hidden instead of
   flashing visible and then fading out. If site.js never arrives to reveal them, the mark is
   removed after three seconds and everything simply shows. */
(function (d) {
  // Age gate: it is visible unless this browser has already confirmed. Decided here, before paint.
  try { if (localStorage.getItem('gh-age-ok') === '1') d.classList.add('age-ok'); } catch (e) {}
  // Menu page: the store's menu sizes itself only while it is on screen. A reload or Back restores
  // the old scroll offset while the page is still short, the frame ends up above the viewport and
  // stays a blank 150px box. So this one page always starts at the top.
  // (The end of the address is tested, not the whole of it, so this also holds when the site is served from a sub-folder.)
  try { if (/\/menu(\/|\/index\.html)?$/.test(location.pathname)) history.scrollRestoration = 'manual'; } catch (e) {}
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  d.classList.add('has-reveal');
  setTimeout(function () { if (!window.__ghReveal) d.classList.remove('has-reveal'); }, 3000);
})(document.documentElement);
