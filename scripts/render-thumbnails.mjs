// npm install --no-save playwright, then node scripts/render-thumbnails.mjs.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const selected = process.argv[2];
  if (selected && !mods.some(mod => mod.id === selected)) throw new Error(`Unknown mod: ${selected}`);
  for (const mod of mods.filter(mod => !selected || mod.id === selected)) {
    if (mod.originalArtwork) {
      const image = execFileSync('git', ['show', `${mod.originalArtwork.commit}:${mod.originalArtwork.file}`], { cwd: root, maxBuffer: 20_000_000 });
      for (const output of new Set([`${mod.id}/preview.png`, `${mod.id}/thumbnail.png`, ...mod.previous])) await fs.writeFile(path.join(root, output), image);
      console.log(`${mod.id}: original artwork preserved`);
      continue;
    }
    await page.setContent(template);
    const source = await fs.readFile(path.join(root, 'gallery/sources', `${mod.id}.png`));
    await page.evaluate(({ mod, src }) => {
      document.querySelector('#title').innerText = mod.title;
      document.querySelector('#description').innerText = mod.description;
      for (const text of mod.badges ?? []) { const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = text; document.querySelector('#badges').append(badge); }
      if (mod.platforms?.length) {
        const row = document.createElement('span'); row.className = 'badge platforms';
        const logos = {
          macos: ['macOS', '<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.77 3.08.83 1.18-.24 2.31-.96 3.57-.87 1.51.12 2.64.72 3.39 1.8-3.1 1.86-2.36 5.95.48 7.1-.57 1.5-1.31 2.99-2.53 4.12l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.35 4.5-3.74 4.25z"/>'],
          windows: ['Windows', '<path d="M2 2h9v9H2zm11 0h9v9h-9zM2 13h9v9H2zm11 0h9v9h-9z"/>'],
        };
        for (const platform of mod.platforms) {
          const [label, path] = logos[platform];
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
          svg.innerHTML = path; row.append(svg);
        }
        document.querySelector('#badges').append(row);
      }
      document.querySelector('.shot').src = src;
      if (mod.screenshotRadius !== undefined) document.querySelector('.shot').style.borderRadius = `${mod.screenshotRadius}px`;
    }, { mod, src: `data:image/png;base64,${source.toString('base64')}` });
    await page.locator('.shot').evaluate(image => image.decode());
    await page.evaluate(() => document.fonts.ready);
    const title = await page.locator('h1').boundingBox();
    if (title.x + title.width > 463 || title.y < 37) throw new Error(`${mod.id}: title exceeds copy area`);
    const image = await page.screenshot({ animations: 'disabled' });
    const outputs = new Set([`${mod.id}/preview.png`, `${mod.id}/thumbnail.png`, ...mod.previous]);
    for (const output of outputs) await fs.writeFile(path.join(root, output), image);
    console.log(`${mod.id}: 2560 × 1440`);
  }
  const cards = mods.map(m => `<a href="../${m.id}/thumbnail.png"><img src="../${m.id}/thumbnail.png" alt="${m.title.replace('\n',' ')}"><span>${m.title.replace('\n',' ')}</span></a>`).join('');
  await fs.writeFile(path.join(root, 'gallery/index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Gallery thumbnail review</title><style>body{margin:32px;background:#101522;color:#eee;font:16px Arial}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}a{color:inherit;text-decoration:none}img{width:100%;display:block;border-radius:10px}span{display:block;padding:10px 0}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>Gallery thumbnail review</h1><p>2560 × 1440 exports; Islands retains its original artwork. Click any preview to inspect its full size. Git Good and Branch are unchanged.</p><main>${cards}</main></html>`);
  await page.goto(pathToFileURL(path.join(root, 'gallery/index.html')).href);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.screenshot({ path: path.join(root, 'gallery/preview.png'), fullPage: true });
} finally { await browser.close(); }
