# Chain Studio — 3D Necklace Designer

## Business Model
- All features unlocked for every user (no pro/free tiers)
- Design, share, screenshot: free
- Export (STL): $2 per download via Stripe Checkout
- Order physical print: $25/unit via Stripe Checkout (unchanged)

## Backlog (remaining work)

### Domain Migration
- [ ] Move from `designer.camwow.tv` to `hypechain.c23d.shop`
      (also update `BASE_URL`, Stripe success/cancel URLs, and the Stripe
      webhook endpoint — export/order redirects all derive from BASE_URL)

### Chain STL Designs (pending real meshes from user)
- [ ] Rope chain STL
- [ ] Box chain STL
- [ ] Figaro chain STL
- [ ] Snake chain STL

NOTE: rope, box, cuban, figaro, and snake all currently load the same
placeholder `chain_loop.stl` (src/chainLoader.js); only Twisted Star has a
dedicated mesh. Cuban Link is considered done pending the real STLs above.

### Nice-to-have / optional
- [ ] Git LFS for the still-referenced chain STLs + fonts (~25MB).
