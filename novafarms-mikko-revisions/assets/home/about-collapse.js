/* =============================================================================
   about-collapse.js — revision 3, the "Find out more" expander.

   The markup this wraps is the client's own Elementor content, so the disclosure
   is applied around it rather than rewritten into it. That keeps the copy
   untouched and the change reversible.

   Deliberately a real <button aria-expanded> controlling a labelled region, not
   a CSS checkbox hack: revision 1 owes the client a keyboard- and
   screen-reader-usable site, and a disclosure that only works with a mouse would
   undercut it. Same pattern as the drawer's disclosure groups, so the site has
   one expander behaviour rather than three.
   ============================================================================= */
(function () {
  'use strict';

  var STORY     = '.elementor-element-a968cca';   // the origin-story panel
  var STATEMENT = '.elementor-element-0747d94';   // the brand-statement panel

  // Mirror the disclosure state onto <html>. The two panels are siblings, so
  // CSS cannot reach across from one to the other; this is how the statement
  // panel follows the same toggle. Added when the owner asked for it to
  // collapse too (reviews 2.41 -> 2.04 screens).
  function setState(open) {
    document.documentElement.setAttribute('data-nf-about', String(open));
  }

  function init() {
    var panel = document.querySelector(STORY);
    if (!panel || panel.getAttribute('data-expanded')) return;   // idempotent

    var inner = panel.querySelector('.e-con-inner') || panel.firstElementChild;
    if (!inner) return;

    panel.classList.add('nf-about');
    panel.setAttribute('data-expanded', 'false');

    // Wrap the existing content so it can be clipped without touching it.
    var body = document.createElement('div');
    body.className = 'nf-about__body';
    body.id = 'nf-about-body';
    while (inner.firstChild) body.appendChild(inner.firstChild);
    inner.appendChild(body);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nf-about__toggle';
    btn.setAttribute('aria-expanded', 'false');

    // aria-controls takes a space-separated list, so the button correctly
    // announces that it governs BOTH regions, not just the story.
    var statement = document.querySelector(STATEMENT);
    var controls = body.id;
    if (statement) {
      if (!statement.id) statement.id = 'nf-about-statement';
      controls += ' ' + statement.id;
    }
    btn.setAttribute('aria-controls', controls);
    setState(false);

    var label = document.createElement('span');
    label.textContent = 'Find out more';
    var caret = document.createElement('span');
    caret.className = 'nf-about__caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    btn.appendChild(label);
    btn.appendChild(caret);

    btn.addEventListener('click', function () {
      var open = panel.getAttribute('data-expanded') === 'true';
      panel.setAttribute('data-expanded', String(!open));
      btn.setAttribute('aria-expanded', String(!open));
      setState(!open);
      label.textContent = open ? 'Find out more' : 'Show less';
      // Collapsing from below the fold would otherwise leave the reader
      // stranded mid-page with no visible anchor.
      if (open) {
        var top = panel.getBoundingClientRect().top;
        if (top < 0) panel.scrollIntoView({
          block: 'start',
          behavior: (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
                     document.documentElement.getAttribute('data-a11y-motion') === 'off')
                    ? 'auto' : 'smooth'
        });
      }
    });

    inner.appendChild(btn);

    // The contrast corrector may already have walked this subtree; the wrapper
    // changed the ancestry, so let it re-measure.
    if (typeof window.a11yBaseRun === 'function') window.a11yBaseRun();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
})();
