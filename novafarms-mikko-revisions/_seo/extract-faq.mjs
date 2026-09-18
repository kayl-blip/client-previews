// Extract the VISIBLE FAQ accordions from the bundle's location pages.
//
// Why extract rather than author: Google requires FAQPage markup to match Q&A that is actually
// VISIBLE on the page. The clone kept the visible Elementor accordions but dropped the FAQPage
// JSON-LD. So the honest fix is to read the questions and answers straight out of the rendered
// markup and emit schema that mirrors them exactly -- never to write new copy.
//
// Output: _seo/faq-extracted.json  { "<file>": [ { q, a }, ... ] }
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const decode = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8217;/g, String.fromCharCode(8217))
  .replace(/&#8216;/g, String.fromCharCode(8216))
  .replace(/&#8211;/g, String.fromCharCode(8211))
  .replace(/&#8212;/g, String.fromCharCode(8212))
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, String.fromCharCode(39))
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

const out = {};
const files = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

for (const file of files) {
  const html = readFileSync(resolve(ROOT, file), 'utf8');
  // Each accordion entry is a <details> ... <summary> with the question ... then a role="region" body.
  const items = [];
  const detailRe = /<details[^>]*>([\s\S]*?)<\/details>/gi;
  let m;
  while ((m = detailRe.exec(html)) !== null) {
    const chunk = m[1];
    const qm = chunk.match(/<div class="e-n-accordion-item-title-text">([\s\S]*?)<\/div>/i);
    if (!qm) continue;
    const q = decode(qm[1]);
    if (!/\?$/.test(q)) continue;           // "View Hours" etc. are not questions
    const rm = chunk.match(/role="region"[^>]*>([\s\S]*?)$/i);
    if (!rm) continue;
    const a = decode(rm[1]);
    if (!a || a.length < 20) continue;
    items.push({ q, a });
  }
  if (items.length) out[file] = items;
}

writeFileSync(resolve(HERE, 'faq-extracted.json'), JSON.stringify(out, null, 1));
let total = 0;
for (const [f, items] of Object.entries(out)) {
  console.log('\n=== ' + f + ' (' + items.length + ') ===');
  items.forEach((it, i) => {
    total++;
    console.log('  Q' + (i + 1) + ': ' + it.q);
    console.log('      A: ' + it.a.slice(0, 150) + (it.a.length > 150 ? '...' : ''));
  });
}
console.log('\nTOTAL Q&A pairs extracted: ' + total);
