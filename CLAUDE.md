# Chain Studio — 3D Necklace Designer

## Business Model
- All features unlocked for every user (no pro/free tiers)
- Design, share, screenshot: free
- Export (STL or 3MF): $2 per download via Stripe Checkout
- Order physical print: $25/unit via Stripe Checkout; an order can hold several
  designs and every 4th chain across the order is free; promo codes allowed

## Layout
- `/` landing, `/gallery/`, search pages, legal pages: Express, `api/pages.js`
- `/design/`: the designer (Vite root `src/`, page `src/design/index.html`)
- Example designs: `data/gallery.js`; images via `scripts/render-gallery.js`
- Marketing kit: `marketing/`
- Customer photos: `data/photos.js` + `public/photos/`
- Checks: `npm test`, `npm run smoke` (after build), `npm run check-live -- <url>` after deploys

## Backlog (remaining work)

### Chain STL Designs (pending real meshes from user)
- [ ] Rope chain STL
- [ ] Box chain STL
- [ ] Figaro chain STL
- [ ] Snake chain STL

Only Cuban Link (`chain_loop.stl`) and Twisted Star have real meshes, so only
those two are offered in the designer. To add a style: put the mesh in
`public/`, map it in `src/chainLoader.js`, add it to `CHAIN_TYPES` in
`src/main.js` and to the select in `src/design/index.html`.

### Owner follow-ups
- [ ] Review the drafted terms / privacy / refund pages (`api/pages.js`)
- [ ] Set `CONTACT_EMAIL` in the host environment
- [ ] Verify the site in Google Search Console and submit `/sitemap.xml`
- [ ] Add real customer photos (`data/photos.js`)
- [ ] Provide chain facts (length, clasp, fits over head?) for the site's questions

### Nice-to-have / optional
- [ ] Git LFS for the chain STLs + fonts (~25MB).
