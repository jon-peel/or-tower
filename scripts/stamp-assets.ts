// Netlify build step: add a content hash to the script/stylesheet links in site/index.html
// (app.js → app.js?v=<hash>). Cloudflare tells browsers to cache JS/CSS for hours, so without a
// new URL per deploy, browsers and OBS keep running the old code after an update.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const html = 'site/index.html';
let out = readFileSync(html, 'utf8');
for (const file of ['dist/app.js', 'dist/app.css']) {
  const hash = createHash('sha256').update(readFileSync(`site/${file}`)).digest('hex').slice(0, 10);
  const before = out;
  out = out.replace(`"/${file}"`, `"/${file}?v=${hash}"`);
  if (out === before) throw new Error(`${file} not referenced in ${html}`);
  console.log(`${file} → ?v=${hash}`);
}
writeFileSync(html, out);
