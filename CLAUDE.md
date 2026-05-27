# Chain Studio — 3D Necklace Designer

## Business Model
- All features unlocked for every user (no pro/free tiers)
- Design, share, screenshot: free
- Export (STL/OBJ/GLB): $2 per download via Stripe Checkout
- Order physical print: $25/unit via Stripe Checkout (unchanged)

## Production Readiness (from codebase review 2026-05-27)

### P0 — Blockers (export money path is currently broken)
- [ ] **Webhook destroys paid exports.** `checkout.session.completed` fires for
      $2 export payments too; the handler calls `createOrder()` which RENAMES
      `export_<id>.stl` → `ORD-xxx.stl`. The buyer's `/api/export-download/<id>`
      then 404s — they pay and get nothing. Also creates junk $2 "orders" in the
      fulfillment dashboard. Fix: webhook must skip sessions where
      `metadata.type === 'export'`. (api/webhooks.js)
- [ ] **No payment verification on export download.** `/api/export-download/:id`
      serves the STL to anyone who knows the (random) id, with no Stripe check.
      Verify `session.payment_status === 'paid'` (or mark paid via webhook)
      before serving. (api/orders.js)
- [ ] **OBJ/GLB exports silently broken.** The $2 flow always runs `STLExporter`
      and serves `necklace.stl`, ignoring `state.exportFormat`. Customer can pick
      OBJ/GLB, pay $2, and get an STL. Either export per-format or remove the
      OBJ/GLB options from the UI. (src/main.js, api/orders.js)

### P1 — Important (fix before / around launch)
- [ ] **Temp STL files leak forever.** `export_*.stl` and `pending_*.stl` are
      written before payment; abandoned checkouts are never cleaned. Add a sweep
      that deletes temp files older than N hours. (api/orders.js)
- [ ] **No slider debounce → rebuild storm.** Every slider tick triggers a full
      synchronous geometry rebuild (TextGeometry + Clipper + Box3); relief/
      threshold sliders re-run image processing each tick. Debounce/throttle
      `rebuildPendant`. (src/ui.js, src/main.js)
- [ ] **Relief heightmap memory growth.** `createHeightmapData` allocates a fresh
      resolution² PlaneGeometry every rebuild; combined with no debounce it leaks
      fast when a relief image is active. (src/pendantGenerator.js)
- [ ] **Unvalidated share-URL state → NaN geometry.** Restored numeric params
      (outlineWidth, plateThickness, offsets, lockedPlateW/H) aren't type/range
      checked; a crafted hash can feed NaN/extreme values into geometry. Add
      finite/clamp validation. (src/shareUrl.js)
- [ ] **Unhandled rebuild/font-load failures.** `rebuildPendant` has no try/catch;
      a font CDN hiccup throws an uncaught rejection and the pendant silently
      fails to update with no user feedback. (src/main.js)

### P2 — Hardening / hygiene
- [ ] **No security headers / HTTPS enforcement.** Add helmet (HSTS, CSP, etc.)
      and redirect HTTP→HTTPS. (server.js)
- [ ] **Remove stray large binaries from repo:** `LA+Kings+generic.3mf` (12MB)
      and `new_chain_loop.stl` (6MB) are unreferenced. Consider Git LFS for the
      committed chain STLs + fonts (~25MB).
- [ ] **Sync base64 STL conversion blocks the main thread** (byte-by-byte
      `String.fromCharCode` + `btoa`) for seconds on large meshes, in both export
      and order flows. Use a chunked/async approach. (src/main.js)
- [ ] **No automated tests** for a payment app. At minimum cover pricing math and
      the export/order security boundaries.
- [ ] **Pin Node version** via `engines` in package.json for the Plesk host.
- [ ] **Dead code:** unused `exportByFormat` import in src/main.js.
- [ ] **In-memory rate limiter** resets on restart and won't span multiple
      workers — fine for single-instance Plesk, document the assumption.
- [ ] **Empty README** (82 bytes) — add deploy/runbook + env-var docs.
- [ ] **Cosmetic CSS injection** via color values in the order-modal `innerHTML`
      (escaped, so not XSS). Validate hex format. (src/main.js)

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
