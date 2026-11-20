// Renders the gallery images (public/gallery/*.jpg) and the share image
// (public/img/og.jpg) from data/gallery.js by driving the real designer
// in a headless browser.
//
// Usage:  npm run build && PORT=3999 node server.js &
//         node scripts/render-gallery.js [http://localhost:3999] [slug ...]
// Needs Playwright with Chromium available on this machine.

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { GALLERY, designHash } from '../data/gallery.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const base = (args[0] && args[0].startsWith('http') ? args.shift() : 'http://localhost:3999').replace(/\/$/, '');
const only = new Set(args);

const HIDE_UI = '#panel,#dimensions-display,#viewport-hint{display:none!important}';

async function shoot(page, file, { width, height, view, bg }) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async ({ view, bg }) => {
    const cs = window.__chainStudio;
    const THREEColor = cs.scene.background.constructor;
    cs.scene.background = new THREEColor(bg);
    window.dispatchEvent(new Event('resize'));
    const boxOf = (obj) => {
      const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      obj.updateMatrixWorld(true);
      obj.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        ['x', 'y', 'z'].forEach((k, i) => {
          b.min[i] = Math.min(b.min[i], bb.min[k]);
          b.max[i] = Math.max(b.max[i], bb.max[k]);
        });
      });
      return b;
    };
    const target = view === 'close' ? boxOf(cs.pendant) : boxOf(cs.chain);
    const cx = (target.min[0] + target.max[0]) / 2;
    const cy = (target.min[1] + target.max[1]) / 2;
    const cz = (target.min[2] + target.max[2]) / 2;
    const w = target.max[0] - target.min[0];
    const h = target.max[1] - target.min[1];
    const aspect = cs.camera.aspect;
    const fov = cs.camera.fov * Math.PI / 180;
    const pad = view === 'close' ? 1.75 : 1.18;
    const fitH = (h * pad) / (2 * Math.tan(fov / 2));
    const fitW = (w * pad) / (2 * Math.tan(fov / 2) * aspect);
    const dist = Math.max(fitH, fitW);
    const yaw = view === 'close' ? 0.42 : 0.2;
    const pitch = view === 'close' ? 0.16 : 0.08;
    cs.controls.target.set(cx, cy, cz);
    cs.camera.position.set(
      cx + dist * Math.sin(yaw) * Math.cos(pitch),
      cy + dist * Math.sin(pitch),
      cz + dist * Math.cos(yaw) * Math.cos(pitch)
    );
    cs.controls.update();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, { view, bg });
  await page.waitForTimeout(300);
  await page.locator('#viewport canvas').screenshot({ path: file, type: 'jpeg', quality: 86 });
  console.log('wrote', path.relative(ROOT, file));
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

for (const item of GALLERY) {
  if (only.size && !only.has(item.slug)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(item.slug, 'page error:', e.message));
  await page.goto(`${base}/design/${designHash(item.state)}`);
  await page.waitForFunction(() => window.__chainStudio && window.__chainStudio.ready && window.__chainStudio.pendant, null, { timeout: 120000 });
  await page.addStyleTag({ content: HIDE_UI });
  const out = path.join(ROOT, 'public', 'gallery');
  await shoot(page, path.join(out, `${item.slug}.jpg`), { width: 1200, height: 1200, view: 'full', bg: '#14142a' });
  await shoot(page, path.join(out, `${item.slug}-close.jpg`), { width: 1200, height: 900, view: 'close', bg: '#14142a' });
  if (item.slug === GALLERY[0].slug) {
    await shoot(page, path.join(ROOT, 'public', 'img', 'og.jpg'), { width: 1200, height: 630, view: 'close', bg: '#14142a' });
  }
  await ctx.close();
}

await browser.close();
