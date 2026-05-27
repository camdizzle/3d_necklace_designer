# Chain Studio — 3D Necklace Designer

## Business Model
- All features unlocked for every user (no pro/free tiers)
- Design, share, screenshot: free
- Export (STL): $2 per download via Stripe Checkout
- Order physical print: $25/unit via Stripe Checkout (unchanged)

## Production Readiness (from codebase review 2026-05-27)

### P0 — Blockers (export money path is currently broken)
- [x] **Webhook destroys paid exports.** Fixed: webhook now checks
      `session.metadata?.type === 'export'` and skips order creation, instead
      writing a `.paid` marker file. (api/webhooks.js)
- [x] **No payment verification on export download.** Fixed: download endpoint
      returns 402 until the `.paid` marker exists; frontend retries with backoff.
      (api/orders.js, src/main.js)
- [x] **OBJ/GLB exports silently broken.** Fixed: removed OBJ/GLB options from
      the format selector (STL-only). Removed dead `exportByFormat` import.
      (index.html, src/main.js)

### P1 — Important (fix before / around launch)
- [x] **Temp STL files leak forever.** Fixed: periodic sweep (every 30 min)
      deletes export_*/pending_* files older than 2 hours. (api/orders.js)
- [x] **No slider debounce → rebuild storm.** Fixed: 80ms debounce on all
      slider inputs in bindSlider. (src/ui.js)
- [x] **Relief heightmap memory growth.** Fixed by debounce — old geometry is
      already properly disposed each rebuild; rapid-fire was the issue.
- [x] **Unvalidated share-URL state → NaN geometry.** Fixed: numeric params are
      validated (isFinite + clamped to ±1000), booleans coerced. (src/shareUrl.js)
- [x] **Unhandled rebuild/font-load failures.** Fixed: rebuildPendant body
      wrapped in try/catch; errors logged to console. (src/main.js)

### P2 — Hardening / hygiene
- [x] **No security headers / HTTPS enforcement.** Fixed: added X-Content-Type-
      Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, and HSTS
      (production only). (server.js)
- [ ] **Remove stray large binaries from repo:** `LA+Kings+generic.3mf` (12MB)
      and `new_chain_loop.stl` (6MB) are unreferenced. Consider Git LFS for the
      committed chain STLs + fonts (~25MB).
- [ ] **Sync base64 STL conversion blocks the main thread** (byte-by-byte
      `String.fromCharCode` + `btoa`) for seconds on large meshes, in both export
      and order flows. Use a chunked/async approach. (src/main.js)
- [ ] **No automated tests** for a payment app. At minimum cover pricing math and
      the export/order security boundaries.
- [x] **Pin Node version** via `engines` in package.json (>=18.0.0).
- [x] **Dead code:** removed unused `exportByFormat` import in src/main.js.
- [ ] **In-memory rate limiter** resets on restart and won't span multiple
      workers — fine for single-instance Plesk, document the assumption.
- [ ] **Empty README** (82 bytes) — add deploy/runbook + env-var docs.
- [x] **Cosmetic CSS injection** via color values in the order-modal `innerHTML`.
      Fixed: added `safeHexColor()` validator. (src/main.js)

## Domain Migration
- [ ] Move from `designer.camwow.tv` to `hypechain.c23d.shop`
      (also update `BASE_URL`, Stripe success/cancel URLs, and the Stripe
      webhook endpoint — export/order redirects all derive from BASE_URL)

## Chain STL Designs (pending from user)
- [ ] Rope chain STL
- [ ] Box chain STL
- [ ] Figaro chain STL
- [ ] Snake chain STL

NOTE: rope, box, cuban, figaro, and snake all currently load the same
placeholder `chain_loop.stl` (src/chainLoader.js); only Twisted Star has a
dedicated mesh. Cuban Link is considered done pending the real STLs above.
