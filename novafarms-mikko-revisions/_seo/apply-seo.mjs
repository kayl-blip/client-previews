// Deterministic, idempotent SEO metadata + JSON-LD injector for the Nova Farms revisions bundle.
//
// WHAT IT DOES, per page:
//   1. canonical / og:url  -> the PRODUCTION novafarms.com URL (from audit.json), never the preview host
//   2. a complete Open Graph + Twitter card block (og:image/twitter:image were missing on 47/48 pages)
//   3. a JSON-LD @graph: Organization + WebSite + WebPage + BreadcrumbList, plus
//        - Store (LocalBusiness) on the 6 location pages, with NAP + geo + hours + hasOfferCatalog
//        - the relevant Store referenced from each /visit-us/ geo landing page
//        - an ItemList of all 6 Stores on the home + /locations/ index
//
// IDEMPOTENT: everything it writes lives between <!-- oso-seo:meta BEGIN --> and <!-- oso-seo:meta END -->,
// matching the bundle's existing oso-* marker convention. Re-running replaces that block, never stacks.
// It also strips PRE-EXISTING canonical/og/twitter/ld+json tags first, so no duplicates survive.
//
// NO INVENTED DATA: every value comes from _seo/nova-data.json, whose provenance is recorded in that file.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DATA = JSON.parse(readFileSync(resolve(HERE, 'nova-data.json'), 'utf8'));
const AUDIT = JSON.parse(readFileSync(resolve(ROOT, 'audit.json'), 'utf8'));
const STORE_MAP = JSON.parse(readFileSync(resolve(HERE, 'geo-page-store-map.json'), 'utf8'));

// FAQ: extracted VERBATIM from each page's visible Elementor accordion by extract-faq.mjs, so the
// emitted FAQPage always mirrors copy a visitor can actually read. faq-exclusions.json drops
// individual Q&A pairs we know to be self-contradictory or could not verify -- see that file.
let FAQ = {};
let FAQ_EX = { exclusions: [] };
try { FAQ = JSON.parse(readFileSync(resolve(HERE, 'faq-extracted.json'), 'utf8')); } catch { FAQ = {}; }
try { FAQ_EX = JSON.parse(readFileSync(resolve(HERE, 'faq-exclusions.json'), 'utf8')); } catch { FAQ_EX = { exclusions: [] }; }
const isExcluded = (file, q) => (FAQ_EX.exclusions || [])
  .some(e => e.file === file && q.toLowerCase().startsWith(String(e.questionStartsWith).toLowerCase()));

const PROD = {};
AUDIT.pages.forEach(p => { PROD[p.name] = p.source; });
// brands.html is absent from audit.json; it is a real page on the live site.
PROD['brands.html'] = PROD['brands.html'] || 'https://novafarms.com/brands/';

const ORG_ID = 'https://novafarms.com/#organization';
const SITE_ID = 'https://novafarms.com/#website';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&')
  .replace(/&#8211;/g, '-')
  .replace(/&#8217;/g, String.fromCharCode(39))
  .replace(/&#8216;/g, String.fromCharCode(39))
  .replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

const storeNode = (key) => {
  const s = DATA.stores[key];
  const node = {
    '@type': ['Store', 'LocalBusiness'],
    '@id': s.url + '#store',
    name: s.name,
    url: s.url,
    image: DATA.shareImage.url,
    logo: DATA.org.logo,
    telephone: s.phone,
    email: s.email,
    priceRange: '$$',
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Debit Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.street,
      addressLocality: s.city,
      addressRegion: s.region,
      postalCode: s.zip,
      addressCountry: s.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
    hasMap: s.maps,
    openingHoursSpecification: s.hours.map(h => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    parentOrganization: { '@id': ORG_ID },
    areaServed: { '@type': 'State', name: s.region },
    // Real, visible product CATEGORIES only. No invented SKUs, prices or availability: the menu is
    // injected client-side by Alpine IQ / Terpli / Surfside, so no product data exists in the HTML
    // to mark up. See _seo/PROVENANCE.md.
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: s.medical ? 'Medical & Recreational Cannabis Menu' : 'Recreational Cannabis Menu',
      itemListElement: DATA.offerCategories.map(c => ({ '@type': 'OfferCatalog', name: c })),
    },
  };
  const sa = (s.sameAs || []);
  if (sa.length) node.sameAs = sa;
  return node;
};

const titleCase = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const breadcrumb = (prodUrl, title) => {
  const u = new URL(prodUrl);
  const segs = u.pathname.split('/').filter(Boolean);
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://novafarms.com/' }];
  let acc = 'https://novafarms.com/';
  segs.forEach((sg, i) => {
    acc += sg + '/';
    const last = i === segs.length - 1;
    items.push({ '@type': 'ListItem', position: i + 2, name: last ? title : titleCase(sg), item: acc });
  });
  return { '@type': 'BreadcrumbList', '@id': prodUrl + '#breadcrumb', itemListElement: items };
};

function buildGraph(file, prodUrl, title, desc) {
  const org = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: DATA.org.name,
    legalName: DATA.org.legalName,
    url: DATA.org.url,
    email: DATA.org.email,
    description: DATA.org.description,
    logo: { '@type': 'ImageObject', '@id': 'https://novafarms.com/#logo', url: DATA.org.logo, contentUrl: DATA.org.logo },
    image: { '@id': 'https://novafarms.com/#logo' },
    contactPoint: Object.values(DATA.stores).map(s => ({
      '@type': 'ContactPoint',
      telephone: s.phone,
      email: s.email,
      contactType: 'customer service',
      areaServed: s.region,
      name: s.name,
    })),
  };
  if (DATA.org.sameAs && DATA.org.sameAs.length) org.sameAs = DATA.org.sameAs;

  const site = {
    '@type': 'WebSite', '@id': SITE_ID, url: DATA.org.url, name: DATA.org.name,
    publisher: { '@id': ORG_ID }, inLanguage: 'en-US',
  };

  const page = {
    '@type': 'WebPage',
    '@id': prodUrl + '#webpage',
    url: prodUrl,
    name: title,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    breadcrumb: { '@id': prodUrl + '#breadcrumb' },
    primaryImageOfPage: {
      '@type': 'ImageObject', url: DATA.shareImage.url,
      width: DATA.shareImage.width, height: DATA.shareImage.height,
    },
    inLanguage: 'en-US',
  };
  if (desc) page.description = desc;

  const graph = [org, site, page, breadcrumb(prodUrl, title)];

  // FAQPage - only from Q&A visibly present on THIS page, minus documented exclusions.
  const faqAll = FAQ[file] || [];
  const faqUse = faqAll.filter(it => !isExcluded(file, it.q));
  if (faqUse.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': prodUrl + '#faq',
      url: prodUrl,
      isPartOf: { '@id': SITE_ID },
      about: { '@id': ORG_ID },
      inLanguage: 'en-US',
      mainEntity: faqUse.map(it => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
    });
    page.hasPart = { '@id': prodUrl + '#faq' };
  }

  const locKey = Object.keys(DATA.stores).find(k => DATA.stores[k].url === prodUrl);
  if (locKey) {
    graph.push(storeNode(locKey));
    page.mainEntity = { '@id': DATA.stores[locKey].url + '#store' };
  } else if (STORE_MAP[file]) {
    const k = STORE_MAP[file].store;
    graph.push(storeNode(k));
    page.mainEntity = { '@id': DATA.stores[k].url + '#store' };
  } else if (prodUrl === 'https://novafarms.com/' || prodUrl === 'https://novafarms.com/locations/') {
    Object.keys(DATA.stores).forEach(k => graph.push(storeNode(k)));
    graph.push({
      '@type': 'ItemList',
      '@id': prodUrl + '#storelist',
      name: 'Nova Farms Dispensary Locations',
      numberOfItems: Object.keys(DATA.stores).length,
      itemListElement: Object.keys(DATA.stores).map((k, i) => ({
        '@type': 'ListItem', position: i + 1, item: { '@id': DATA.stores[k].url + '#store' },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// --- strip tags we are about to re-emit, so nothing duplicates ---------------------------------
function stripOld(html) {
  let h = html.replace(/<!-- oso-seo:meta BEGIN -->[\s\S]*?<!-- oso-seo:meta END -->\s*/g, '');
  h = h.replace(/[ \t]*<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '');
  h = h.replace(/[ \t]*<meta[^>]+property=["']og:[^"']*["'][^>]*>\s*/gi, '');
  h = h.replace(/[ \t]*<meta[^>]+name=["']twitter:[^"']*["'][^>]*>\s*/gi, '');
  h = h.replace(/[ \t]*<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
  return h;
}

const files = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
const report = [];
let changed = 0;

for (const file of files) {
  const prodUrl = PROD[file];
  if (!prodUrl) { report.push({ file, status: 'SKIPPED - no production URL mapping' }); continue; }

  const src = readFileSync(resolve(ROOT, file), 'utf8');
  let html = stripOld(src);

  const title = decode((src.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || DATA.org.name);
  const descRaw = (src.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || [])[1];
  const desc = decode(descRaw || '');

  const locKey = Object.keys(DATA.stores).find(k => DATA.stores[k].url === prodUrl);
  const ogType = locKey ? 'business.business' : 'website';
  const graph = buildGraph(file, prodUrl, title, desc);

  const block = [
    '<!-- oso-seo:meta BEGIN -->',
    '<link rel="canonical" href="' + esc(prodUrl) + '">',
    '<meta property="og:locale" content="en_US">',
    '<meta property="og:type" content="' + ogType + '">',
    '<meta property="og:site_name" content="' + esc(DATA.org.name) + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    desc ? '<meta property="og:description" content="' + esc(desc) + '">' : null,
    '<meta property="og:url" content="' + esc(prodUrl) + '">',
    '<meta property="og:image" content="' + esc(DATA.shareImage.url) + '">',
    '<meta property="og:image:secure_url" content="' + esc(DATA.shareImage.url) + '">',
    '<meta property="og:image:type" content="image/webp">',
    '<meta property="og:image:width" content="' + DATA.shareImage.width + '">',
    '<meta property="og:image:height" content="' + DATA.shareImage.height + '">',
    '<meta property="og:image:alt" content="' + esc(DATA.org.name) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    desc ? '<meta name="twitter:description" content="' + esc(desc) + '">' : null,
    '<meta name="twitter:image" content="' + esc(DATA.shareImage.url) + '">',
    '<meta name="twitter:image:alt" content="' + esc(DATA.org.name) + '">',
    '<script type="application/ld+json">' + JSON.stringify(graph) + '</script>',
    '<!-- oso-seo:meta END -->',
  ].filter(Boolean).join('\n');

  if (!/<\/head>/i.test(html)) { report.push({ file, status: 'SKIPPED - no </head>' }); continue; }
  // NOTE: the replacement MUST be a function. With a replacement *string*, JS expands the special
  // patterns $$ / $& / $` / $' / $n inside it -- which silently turned priceRange "$$" into "$".
  html = html.replace(/<\/head>/i, () => block + '\n</head>');
  writeFileSync(resolve(ROOT, file), html, 'utf8');
  changed++;
  report.push({
    file, status: 'ok', prodUrl, ogType,
    hasStore: !!(locKey || STORE_MAP[file]),
    storeKey: locKey || (STORE_MAP[file] ? STORE_MAP[file].store : null),
    faqTotal: (FAQ[file] || []).length,
    faqEmitted: (FAQ[file] || []).filter(it => !isExcluded(file, it.q)).length,
    titleLen: title.length, descLen: desc.length, descMissing: !descRaw,
  });
}

console.log('\nPages written: ' + changed + '/' + files.length);
console.log('With Store schema: ' + report.filter(r => r.hasStore).length);
const faqPages = report.filter(r => r.faqEmitted > 0);
console.log('With FAQPage schema: ' + faqPages.length +
  ' (' + faqPages.reduce((a, r) => a + r.faqEmitted, 0) + ' Q&A emitted of ' +
  report.reduce((a, r) => a + (r.faqTotal || 0), 0) + ' visible)');
faqPages.forEach(r => console.log('   - ' + r.file + ': ' + r.faqEmitted + '/' + r.faqTotal +
  (r.faqEmitted < r.faqTotal ? '  (' + (r.faqTotal - r.faqEmitted) + ' EXCLUDED - see faq-exclusions.json)' : '')));
const noDesc = report.filter(r => r.descMissing);
console.log('Missing meta description (og/twitter description omitted for these): ' + noDesc.length);
noDesc.forEach(r => console.log('   - ' + r.file));
const skipped = report.filter(r => r.status !== 'ok');
if (skipped.length) { console.log('SKIPPED:'); skipped.forEach(r => console.log('   - ' + r.file + ' :: ' + r.status)); }
writeFileSync(resolve(HERE, 'apply-report.json'), JSON.stringify(report, null, 1));
console.log('report -> _seo/apply-report.json');
