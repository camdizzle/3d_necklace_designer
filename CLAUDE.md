# Chain Studio — 3D Necklace Designer

## Business Model
- All features unlocked for every user (no pro/free tiers)
- Design, share, screenshot: free
- Export (STL): $2 per download via Stripe Checkout
- Order physical print: $25/unit via Stripe Checkout (unchanged)

## Layout
- `/` landing, `/gallery/`, search pages, legal pages: Express, `api/pages.js`
- `/design/`: the designer (Vite, `design/index.html`, `src/`)
- Example designs: `data/gallery.js`; images via `scripts/render-gallery.js`
- Marketing kit: `marketing/`

## Backlog (remaining work)

### Chain STL Designs (pending real meshes from user)
- [ ] Rope chain STL
- [ ] Box chain STL
- [ ] Figaro chain STL
- [ ] Snake chain STL

Only Cuban Link (`chain_loop.stl`) and Twisted Star have real meshes, so only
those two are offered in the designer. To add a style: put the mesh in
`public/`, map it in `src/chainLoader.js`, add it to `CHAIN_TYPES` in
`src/main.js` and to the select in `design/index.html`.

### Owner follow-ups
- [ ] Review the drafted terms / privacy / refund pages (`api/pages.js`)
- [ ] Set `CONTACT_EMAIL` in the host environment
- [ ] Verify the site in Google Search Console and submit `/sitemap.xml`
- [ ] Replace gallery renders with real product photos where available

### Nice-to-have / optional
- [ ] Git LFS for the chain STLs + fonts (~25MB).
