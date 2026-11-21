// After a deploy, check the live site is serving what it should.
//   npm run check-live -- https://hypechain.c23d.shop
// Exits with an error if any check fails.

const base = (process.argv[2] || process.env.BASE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: npm run check-live -- https://your-site');
  process.exit(2);
}

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail });
  } catch (err) {
    results.push({ ok: false, name, detail: err.message });
  }
}
async function get(path, opts) {
  return fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...opts });
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

await check('home page', async () => {
  const r = await get('/');
  expect(r.status === 200, `status ${r.status}`);
  const html = await r.text();
  expect(html.includes('/site.css'), 'no stylesheet link');
  return 'ok';
});
await check('site stylesheet', async () => {
  const r = await get('/site.css');
  expect(r.status === 200 && /css/.test(r.headers.get('content-type') || ''), `status ${r.status} ${r.headers.get('content-type')}`);
  return 'ok';
});
let bundle = null;
await check('designer is the built page', async () => {
  const r = await get('/design/');
  expect(r.status === 200, `status ${r.status}`);
  const html = await r.text();
  bundle = (html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/) || [])[1];
  expect(bundle, 'the page is not the built designer (no /assets/ script). Run `npm run build` and check the document root is dist/.');
  return bundle;
});
await check('designer script', async () => {
  expect(bundle, 'skipped');
  const r = await get(bundle);
  expect(r.status === 200 && /javascript/.test(r.headers.get('content-type') || ''), `status ${r.status} ${r.headers.get('content-type')}`);
  return 'ok';
});
await check('compact chain mesh', async () => {
  const r = await get('/meshes/chain_loop.mesh');
  expect(r.status === 200, `status ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  expect(buf[0] === 0x1f && buf[1] === 0x8b, 'not the packed mesh file');
  return `${(buf.length / 1048576).toFixed(2)} MB`;
});
await check('fonts', async () => {
  const r = await get('/fonts/coiny.typeface.json');
  expect(r.status === 200, `status ${r.status}`);
  return 'ok';
});
for (const path of ['/robots.txt', '/sitemap.xml', '/gallery/', '/terms/']) {
  await check(path, async () => {
    const r = await get(path);
    expect(r.status === 200, `status ${r.status}`);
    return 'ok';
  });
}
for (const path of ['/package.json', '/server.js', '/orders/stats.json', '/.env']) {
  await check(`${path} is not public`, async () => {
    const r = await get(path);
    expect(r.status !== 200, 'downloadable! Set the hosting document root to the dist/ folder.');
    return `status ${r.status}`;
  });
}
await check('health', async () => {
  const r = await get('/api/health');
  expect(r.status === 200, `status ${r.status}`);
  const h = await r.json();
  expect(h.designerBuilt && h.siteAssetsBuilt, JSON.stringify(h));
  return JSON.stringify(h);
});

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
