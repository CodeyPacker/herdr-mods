// npm install --no-save playwright, then node scripts/render-thumbnails.mjs.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mods = JSON.parse(await fs.readFile(path.join(root, 'gallery/mods.json'), 'utf8'));
const template = await fs.readFile(path.join(root, 'gallery/template.html'), 'utf8');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const selected = process.argv[2];
  if (selected && !mods.some(mod => mod.id === selected)) throw new Error(`Unknown mod: ${selected}`);
  for (const mod of mods.filter(mod => !selected || mod.id === selected)) {
    await page.setContent(template);
    const source = await fs.readFile(path.join(root, 'gallery/sources', `${mod.id}.png`));
    await page.evaluate(({ mod, src }) => {
      document.querySelector('#title').innerText = mod.title;
      document.querySelector('#description').innerText = mod.description;
      document.querySelector('.shot').src = src;
    }, { mod, src: `data:image/png;base64,${source.toString('base64')}` });
    await page.locator('.shot').evaluate(image => image.decode());
    await page.evaluate(() => document.fonts.ready);
    const title = await page.locator('h1').boundingBox();
    if (title.x + title.width > 463 || title.y < 37) throw new Error(`${mod.id}: title exceeds copy area`);
    const image = await page.screenshot({ animations: 'disabled' });
    const outputs = new Set([`${mod.id}/preview.png`, `${mod.id}/thumbnail.png`, ...mod.previous]);
    for (const output of outputs) await fs.writeFile(path.join(root, output), image);
    console.log(`${mod.id}: 1280 × 720`);
  }
  const cards = mods.map(m => `<a href="../${m.id}/thumbnail.png"><img src="../${m.id}/thumbnail.png" alt="${m.title.replace('\n',' ')}"><span>${m.title.replace('\n',' ')}</span></a>`).join('');
  await fs.writeFile(path.join(root, 'gallery/index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Gallery thumbnail review</title><style>body{margin:32px;background:#101522;color:#eee;font:16px Arial}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}a{color:inherit;text-decoration:none}img{width:100%;display:block;border-radius:10px}span{display:block;padding:10px 0}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>Gallery thumbnail review</h1><p>1280 × 720. Click any preview to inspect its full size. Git Good and Branch are unchanged.</p><main>${cards}</main></html>`);
  await page.goto(pathToFileURL(path.join(root, 'gallery/index.html')).href);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.screenshot({ path: path.join(root, 'gallery/preview.png'), fullPage: true });
} finally { await browser.close(); }
