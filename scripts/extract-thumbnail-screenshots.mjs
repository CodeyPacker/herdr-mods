// Reuse the existing UI pixels. Crop away promotional artwork and straighten perspective.
// Requires sharp. SHARP_MODULE may point to an existing installation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const config = JSON.parse(await fs.readFile(path.join(root, 'gallery/screenshot-crops.json'), 'utf8'));

// Solve the eight coefficients mapping a unit rectangle to the screenshot's four corners.
function transform(corners) {
  const matrix = [];
  [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v], i) => {
    const [x,y] = corners[i];
    matrix.push([u,v,1,0,0,0,-u*x,-v*x,x], [0,0,0,u,v,1,-u*y,-v*y,y]);
  });
  for (let i = 0; i < 8; i++) {
    let pivot = i;
    for (let j = i + 1; j < 8; j++) if (Math.abs(matrix[j][i]) > Math.abs(matrix[pivot][i])) pivot = j;
    [matrix[i],matrix[pivot]] = [matrix[pivot],matrix[i]];
    const divisor = matrix[i][i];
    if (Math.abs(divisor) < 1e-10) throw new Error('Invalid screenshot corners');
    for (let k = i; k < 9; k++) matrix[i][k] /= divisor;
    for (let j = 0; j < 8; j++) if (j !== i) {
      const factor = matrix[j][i];
      for (let k = i; k < 9; k++) matrix[j][k] -= factor * matrix[i][k];
    }
  }
  return matrix.map(row => row[8]);
}

const selected = process.argv[2];
for (const crop of config.screenshots.filter(crop => !selected || crop.id === selected)) {
  if (crop.capture) {
    const original = await fs.readFile(path.join(root, crop.capture));
    if (!crop.dialog) {
      await sharp(original).extract(crop.crop).png().toFile(path.join(root, 'gallery/sources', `${crop.id}.png`));
      console.log(`${crop.id}: supplied screenshot, original editor pixels`);
      continue;
    }
    const { left, top, width, height, radius } = crop.dialog;
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="white"/></svg>`);
    const dialog = await sharp(original).extract({ left, top, width, height }).ensureAlpha()
      .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const blurred = await sharp(original).blur(crop.blur).png().toBuffer();
    const full = await sharp(blurred).composite([{ input: dialog, left, top }]).png().toBuffer();
    await sharp(full).extract(crop.crop).png().toFile(path.join(root, 'gallery/sources', `${crop.id}.png`));
    console.log(`${crop.id}: supplied screenshot, blurred background, original dialog pixels`);
    continue;
  }
  const original = execFileSync('git', ['show', `${config.commit}:${crop.file}`], { cwd: root, maxBuffer: 20_000_000 });
  const { data, info } = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / config.coordinateWidth;
  const h = transform(crop.corners.map(point => point.map(n => n * scale)));
  const output = Buffer.alloc(crop.width * crop.height * info.channels);
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const u = x / (crop.width - 1), v = y / (crop.height - 1);
    const d = h[6] * u + h[7] * v + 1;
    const sx = (h[0] * u + h[1] * v + h[2]) / d;
    const sy = (h[3] * u + h[4] * v + h[5]) / d;
    if (sx < 0 || sy < 0 || sx >= info.width - 1 || sy >= info.height - 1) throw new Error(`${crop.id}: crop outside source`);
    const ix = Math.floor(sx), iy = Math.floor(sy), dx = sx - ix, dy = sy - iy;
    const at = (iy * info.width + ix) * info.channels;
    for (let c = 0; c < info.channels; c++) {
      const top = data[at+c] * (1-dx) + data[at+info.channels+c] * dx;
      const bottom = data[at+info.width*info.channels+c] * (1-dx) + data[at+(info.width+1)*info.channels+c] * dx;
      output[(y*crop.width+x)*info.channels+c] = Math.round(top*(1-dy)+bottom*dy);
    }
  }
  await sharp(output, { raw: { width: crop.width, height: crop.height, channels: info.channels } }).png().toFile(path.join(root, 'gallery/sources', `${crop.id}.png`));
  console.log(`${crop.id}: reused ${config.commit}:${crop.file}`);
}
