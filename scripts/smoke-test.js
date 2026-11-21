// Browser smoke test: builds nothing, starts the server on a spare port
// with a throwaway orders folder, opens the site in Chromium and checks
// the pages, the designer, the chain and the order window.
//   npm run build && npm run smoke
// Needs Playwright with Chromium (CI installs it; see .github/workflows).

import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;
const ordersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-orders-'));

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), BASE_URL: BASE, ORDERS_DIR: ordersDir },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start\n' + serverLog);
}

let browser;
try {
  await waitForServer();
  for (const p of ['/', '/gallery/', '/custom-name-chain/', '/terms/', '/robots.txt', '/sitemap.xml']) {
    const r = await fetch(BASE + p);
    ok(r.status === 200, `${p} returned ${r.status}`);
  }

  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', devices['iPhone 13']]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/design/`);
    await page.waitForFunction(
      () => window.__chainStudio && window.__chainStudio.chain && window.__chainStudio.pendant,
      null, { timeout: 120000 }
    ).catch(() => failures.push(`${name}: the designer did not finish loading the chain and pendant`));

    const layout = await page.evaluate(() => {
      const panel = document.getElementById('panel').getBoundingClientRect();
      const body = document.querySelector('#panel .section-body');
      const bar = document.getElementById('action-bar')?.getBoundingClientRect();
      return {
        sectionPadding: body ? parseFloat(getComputedStyle(body).paddingLeft) : 0,
        barVisible: !!bar && bar.width > 0 && bar.bottom <= window.innerHeight + 1,
        panelWidth: panel.width
      };
    });
    ok(layout.sectionPadding >= 12, `${name}: settings panel has no side padding (script did not run?)`);
    ok(layout.barVisible, `${name}: order bar is not visible`);

    await page.click('#order-btn');
    await page.waitForSelector('#order-modal.open .cart-item', { timeout: 30000 })
      .catch(() => failures.push(`${name}: order window did not open with the design`));
    ok(errors.length === 0, `${name}: page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
} catch (err) {
  failures.push(err.message);
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.rmSync(ordersDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Smoke test FAILED:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Smoke test passed.');
