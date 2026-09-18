/* =============================================================================
   store-context.js — the one place that knows about stores.

   Shared foundation for the mobile drawer (revision 5), the location rail and
   deals slots (revision 2) and the location page template (revision 4). Those
   all need the same three things: the list of stores, which one the visitor
   picked, and where "shop this store" actually goes.

   Nothing in the bundle remembered a store before this. The age gate stores
   `ageVerified` and `popupShown` as cookies; there is no record anywhere of
   WHICH store a visitor chose, so a returning visitor was asked every time.
   ============================================================================= */
(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     THE MENU DESTINATION IS A PLACEHOLDER, DELIBERATELY.

     Verified live this session: /stores/<state>/<slug> returns 403 for five of
     the six stores. Only New Britain resolves, and it does so through a
     different URL space (/shop/newbritain/, which is in this bundle).

       /shop/newbritain/            200
       /stores/ma/attleboro         403      /shop/attleboro/         403
       /stores/ma/framingham        403      /shop/framingham/        403
       /stores/ma/dracut            403      /shop/woodbury/          403
       /stores/nj/woodbury          403      /shop/greenville/        403
       /stores/me/greenville        403

     Reproduced with curl and with a real Chrome navigation, so it is not bot
     protection. The owner's decision was to park it and build against a marked
     placeholder rather than guess at a replacement pattern -- /shop/<store>/
     was the obvious guess and it 403s too.

     MENU_PENDING is the single source for everything RENDERED AT RUNTIME --
     the drawer's CTA and anything else reading window.NovaStores.

     It is NOT the single source for the location pages. Those sections are
     deliberately real markup so they can be indexed (revision 4 exists so these
     pages rank, and script-rendered content is indexed unreliably), which means
     the destination is decided in static HTML that never consults this file.
     An earlier version of this comment claimed "one edit, not a hunt" -- that
     was wrong, and the review that caught it counted 66 hard-coded decisions
     across the six location pages.

     So every one of them now carries data-nf-menu="pending" (or "resolved").
     Confirming the real URL is: change MENU_PENDING here, then rewrite the
     elements matching [data-nf-menu="pending"]. Two mechanical steps, both
     complete, neither a hunt.
     ---------------------------------------------------------------------- */
  /* OWNER CALL 2026-09-09: "replace all placeholder buttons/links with actual
     buttons or links even if redirects to nowhere. we can fix those later."

     So this stops being null. Each store now carries the REAL Nova Farms menu
     URL it was always meant to point at — the same address the 257 converted
     in-page links now use, recovered from what each control originally
     replaced. That address returns a 403 today for five of six stores, which
     is the accepted cost; the payoff is that nothing here has to be found
     again when the client fixes it, because the links are already correct.

     This is still the single source of truth. One edit per store here changes
     every runtime-rendered menu control on the site. */
  var MENU_PENDING = null;         // kept: rhodeisland has no store to link to

  var STORES = [
    { id: 'attleboro',  name: 'Attleboro',   state: 'MA', stateName: 'Massachusetts',
      type: 'Rec Only',  address: '1000 Washington St, Attleboro, MA 02703',
      hours: 'Everyday: 8am – 11pm', maps: 'https://maps.app.goo.gl/dACNdVfMZV6JDrE69',
      phone: '(833) 420-6682', tel: '8334206682',
      page: 'attleboro-ma.html',            menu: 'https://novafarms.com/stores/ma/attleboro' },

    { id: 'framingham', name: 'Framingham',  state: 'MA', stateName: 'Massachusetts',
      type: 'Rec Only',  address: '1137 Worcester Rd, Framingham, MA 01701',
      hours: 'Mon – Sat: 8am – 10pm · Sun: 10am – 8pm', maps: 'https://maps.app.goo.gl/bXsGy4RMbhLp531j8',
      phone: '(508) 424-5858', tel: '5084245858',
      page: 'framingham-ma.html',           menu: 'https://novafarms.com/stores/ma/framingham' },

    { id: 'dracut',     name: 'Dracut',      state: 'MA', stateName: 'Massachusetts',
      type: 'Rec Only',  address: '1274 Merrimack Ave, Dracut, MA 01827',
      hours: 'Mon – Sat: 8am – 10pm · Sun: 8am – 8pm', maps: 'https://maps.app.goo.gl/CKRA42UgwNiRkkhs6',
      phone: '(351) 500-6467', tel: '3515006467',
      page: 'dracut-ma.html',               menu: 'https://novafarms.com/stores/ma/dracut' },

    { id: 'newbritain', name: 'New Britain', state: 'CT', stateName: 'Connecticut',
      type: 'Rec & Med', address: '623 Hartford Rd, New Britain, CT 06053',
      hours: 'Mon – Sat: 10am – 9pm · Sun: 10am – 6pm', maps: 'https://maps.app.goo.gl/GgkpSoVCazHiRPmR9',
      phone: '(959) 208-3344', tel: '9592083344',
      page: 'locations-newbritain-ct.html',
      // The one store whose menu actually resolves, and it is in this bundle.
      menu: 'newbritain.html' },

    { id: 'woodbury',   name: 'Woodbury',    state: 'NJ', stateName: 'New Jersey',
      type: 'Rec Only',  address: '642 Mantua Pike, Woodbury, NJ 08096',
      hours: 'Everyday: 8am – 10pm', maps: 'https://maps.app.goo.gl/Vugm93GwwyKdwiR37',
      phone: '(856) 202-7273', tel: '8562027273',
      page: 'woodbury-nj.html',             menu: 'https://novafarms.com/stores/nj/woodbury' },

    { id: 'greenville', name: 'Greenville',  state: 'ME', stateName: 'Maine',
      type: 'Rec Only',  address: '22 Rockwood Rd, Greenville, ME 04442',
      hours: 'Everyday: 10am – 7pm', maps: 'https://maps.app.goo.gl/d6wYcWcHjFKV5CgS8',
      phone: '(207) 695-2967', tel: '2076952967',
      page: 'greenville-me.html',           menu: 'https://novafarms.com/stores/me/greenville' },

    /* Rhode Island ships as a coming-soon slot by owner decision. It is not an
       invention: the age gate already carries a step3RhodeIsland step with an
       "RI Dispensary" placeholder and no store behind it, and RI already has a
       live wholesale presence at ri.stashie.com. Needs an opening date from the
       client -- an open-ended "coming soon" reads worse than no slot at all. */
    { id: 'rhodeisland', name: 'Rhode Island', state: 'RI', stateName: 'Rhode Island',
      type: 'Coming soon', address: null, phone: null, tel: null,
      page: null, menu: null, comingSoon: true }
  ];

  var KEY = 'novafarms:store';

  function all()      { return STORES.slice(); }
  function open_()    { return STORES.filter(function (s) { return !s.comingSoon; }); }
  function byId(id)   { for (var i = 0; i < STORES.length; i++) if (STORES[i].id === id) return STORES[i]; return null; }

  function byStates() {
    var order = ['MA', 'CT', 'NJ', 'ME', 'RI'], out = [];
    order.forEach(function (st) {
      var list = STORES.filter(function (s) { return s.state === st; });
      if (list.length) out.push({ state: st, stateName: list[0].stateName, stores: list });
    });
    return out;
  }

  /* ----------------------------------------------------------- persistence */
  // localStorage, not a cookie: the age gate already owns the cookie namespace
  // and this is a preference, not something the server needs. Wrapped because
  // storage throws outright in some privacy modes.
  function selected() {
    try {
      var s = byId(window.localStorage.getItem(KEY));
      return (s && !s.comingSoon) ? s : null;
    } catch (e) { return null; }
  }

  function select(id) {
    var s = byId(id);
    if (!s || s.comingSoon) return null;
    try { window.localStorage.setItem(KEY, id); } catch (e) { /* private mode */ }
    document.documentElement.setAttribute('data-store', id);
    window.dispatchEvent(new CustomEvent('novafarms:storechange', { detail: s }));
    return s;
  }

  function clear() {
    try { window.localStorage.removeItem(KEY); } catch (e) {}
    document.documentElement.removeAttribute('data-store');
    window.dispatchEvent(new CustomEvent('novafarms:storechange', { detail: null }));
  }

  // Which store does the page we are ON belong to? Lets a location page adopt
  // its own store without the visitor having chosen one yet.
  function ofThisPage() {
    var here = (window.location.pathname.split('/').pop() || '').toLowerCase();
    for (var i = 0; i < STORES.length; i++) {
      if (STORES[i].page && STORES[i].page.toLowerCase() === here) return STORES[i];
    }
    return null;
  }

  // Two different questions, and they are not the same store.
  //
  //   current()  — "which store am I SHOPPING?"  A saved choice wins, because
  //                that is a preference the visitor set. Used by the drawer.
  //   viewing()  — "which store am I LOOKING AT?" The page wins, because on
  //                Dracut's page you are viewing Dracut whatever you saved
  //                earlier. Used by the rail, whose job is to say so.
  //
  // Conflating them made the rail claim "Attleboro" on every location page.
  function current() { return selected() || ofThisPage(); }
  function viewing() { return ofThisPage() || selected(); }

  var cur = current();
  if (cur) document.documentElement.setAttribute('data-store', cur.id);

  window.NovaStores = {
    all: all, open: open_, byId: byId, byStates: byStates,
    selected: selected, select: select, clear: clear,
    ofThisPage: ofThisPage, current: current, viewing: viewing,
    menuPending: function (s) { return !s || !s.menu; },
    STORAGE_KEY: KEY
  };
})();
