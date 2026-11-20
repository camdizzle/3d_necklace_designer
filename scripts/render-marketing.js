// Renders campaign assets into marketing/assets/ by driving the real
// designer in a headless browser:
//   instagram/<slug>-portrait.jpg (1080x1350), <slug>-square.jpg (1080x1080)
//   instagram/<slug>-turntable.mp4 for the slugs in TURNTABLES (needs ffmpeg)
//   makerworld/<slug>.3mf for the slugs in SAMPLE_FILES (needs the server
//   started with ADMIN_BYPASS_KEY and that key passed as BYPASS_KEY)
//
// Usage:  PORT=3999 ADMIN_BYPASS_KEY=k node server.js &
//         BYPASS_KEY=k node scripts/render-marketing.js [http://localhost:3999]

import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GALLERY, designHash } from '../data/gallery.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'http://localhost:3999').replace(/\/$/, '');
const OUT = path.join(ROOT, 'marketing', 'assets');
const TURNTABLES = ['your-hype-chain', 'best-dad-silver', 'gg-gamer-tag'];
const SAMPLE_FILES = ['your-hype-chain', 'best-dad-silver', 'king-twisted-star', 'gg-gamer-tag'];
const HIDE_UI = '#panel,#dimensions-display,#viewport-hint{display:none!important}';
const BG = '#14142a';

fs.mkdirSync(path.join(OUT, 'instagram'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'makerworld'), { recursive: true });

// Point the camera at the pendant from a given angle, framed with `pad`.
async function aim(page, { yaw, pitch, pad }) {
  await page.evaluate(async ({ yaw, pitch, pad, bg }) => {
    const cs = window.__chainStudio;
    cs.scene.background = new cs.scene.background.constructor(bg);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    cs.pendant.updateMatrixWorld(true);
    cs.pendant.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      ['x', 'y', 'z'].forEach((k, i) => { min[i] = Math.min(min[i], bb.min[k]); max[i] = Math.max(max[i], bb.max[k]); });
    });
    const c = min.map((v, i) => (v + max[i]) / 2);
    const fov = cs.camera.fov * Math.PI / 180;
    const dist = Math.max(
      ((max[1] - min[1]) * pad) / (2 * Math.tan(fov / 2)),
      ((max[0] - min[0]) * pad) / (2 * Math.tan(fov / 2) * cs.camera.aspect)
    );
    // Look slightly above the pendant so the bail and chain show.
    const ty = c[1] + (max[1] - min[1]) * 0.18;
    cs.controls.target.set(c[0], ty, c[2]);
    cs.camera.position.set(
      c[0] + dist * Math.sin(yaw) * Math.cos(pitch),
      ty + dist * Math.sin(pitch),
      c[2] + dist * Math.cos(yaw) * Math.cos(pitch)
    );
    cs.controls.update();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, { yaw, pitch, pad, bg: BG });
}

async function openDesign(browser, item, viewport, extraHash = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(item.slug, 'page error:', e.message));
  await page.goto(`${base}/design/${extraHash || designHash(item.state)}`);
  await page.waitForFunction(() => window.__chainStudio && window.__chainStudio.ready && window.__chainStudio.pendant, null, { timeout: 120000 });
  return { ctx, page };
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

for (const item of GALLERY) {
  const { ctx, page } = await openDesign(browser, item, { width: 1080, height: 1350 });
  await page.addStyleTag({ content: HIDE_UI });
  const canvas = page.locator('#viewport canvas');

  for (const [name, w, h, pad] of [['portrait', 1080, 1350, 2.3], ['square', 1080, 1080, 1.9]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await aim(page, { yaw: 0.38, pitch: 0.14, pad });
    await page.waitForTimeout(250);
    await canvas.screenshot({ path: path.join(OUT, 'instagram', `${item.slug}-${name}.jpg`), type: 'jpeg', quality: 88 });
  }
  console.log('images', item.slug);

  if (TURNTABLES.includes(item.slug)) {
    await page.setViewportSize({ width: 1080, height: 1350 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'turntable-'));
    const N = 96; // 4 s at 24 fps, a seamless side-to-side swing
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      await aim(page, { yaw: 0.6 * Math.sin(t), pitch: 0.12 + 0.05 * Math.cos(t), pad: 2.3 });
      await canvas.screenshot({ path: path.join(frames, `f${String(i).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 92 });
    }
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-stream_loop', '1', '-framerate', '24',
      '-i', path.join(frames, 'f%03d.jpg'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart',
      path.join(OUT, 'instagram', `${item.slug}-turntable.mp4`)
    ]);
    fs.rmSync(frames, { recursive: true, force: true });
    console.log('turntable', item.slug);
  }
  await ctx.close();
}

if (process.env.BYPASS_KEY) {
  for (const item of GALLERY.filter((g) => SAMPLE_FILES.includes(g.slug))) {
    const { ctx, page } = await openDesign(browser, item, { width: 1280, height: 800 });
    // Unlock owner export in this browser session, then export as 3MF.
    await page.evaluate((key) => { location.hash = '#bypass=' + encodeURIComponent(key); }, process.env.BYPASS_KEY);
    await page.waitForFunction(() => sessionStorage.getItem('admin_bypass') === '1', null, { timeout: 15000 });
    await page.evaluate(() => {
      const s = document.getElementById('export-format');
      s.value = '3mf';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('#export-btn')]);
    await dl.saveAs(path.join(OUT, 'makerworld', `${item.slug}.3mf`));
    console.log('3mf', item.slug);
    await ctx.close();
  }
}

await browser.close();
