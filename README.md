# Chain Studio — 3D Necklace Designer

Web-based designer for custom hip-hop neck chains with text pendants. Built with
Three.js (frontend) and an Express backend that handles Stripe payments, order
fulfillment, and a password-protected admin dashboard.

## Business model

- **Design, share, screenshot** — free, all features unlocked.
- **Export STL or colour 3MF** — $2 per download via Stripe Checkout.
- **Order a physical print** — $25/unit via Stripe Checkout (buy 3 get 1 free).

## Stack

- **Designer:** Vite + Three.js (vanilla JS). Source in `src/`, entry `design/index.html`, served at `/design/`.
- **Site pages:** landing, gallery, search pages, legal pages, `robots.txt` and `sitemap.xml` are rendered by Express (`api/pages.js`, styles in `public/site.css`, example designs in `data/gallery.js`).
- **Backend:** Express (`server.js`) serving the built `dist/` plus the API.
- **Storage:** file-based orders in `orders/` (JSON + STL). No database.
- **Payments:** Stripe Checkout + webhooks.
- **Email:** Resend (order confirmation, admin notification, shipping notice).

## Local development

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev            # Vite dev server, designer only: http://localhost:5173/design/
```

To run the full stack (API + built frontend) locally:

```bash
npm run build          # outputs dist/
npm start              # Express on :3000 (or $PORT)
```

## Tests

```bash
npm test               # Node built-in runner: pricing, ID validation, and the
                       # upload → webhook → order / paid-download paths
```

## Environment variables

Copy `.env.example` to `.env`. All are read from the process environment (set
them in the Plesk Node.js panel in production).

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes | Stripe API key (`sk_live_…` / `sk_test_…`). |
| `STRIPE_WEBHOOK_SECRET` | yes | Verifies incoming Stripe webhooks (`whsec_…`). |
| `STRIPE_PUBLISHABLE_KEY` | — | Client-side Stripe key (`pk_…`). |
| `ADMIN_USERNAME` | — | Admin dashboard user (defaults to `admin`). |
| `ADMIN_PASSWORD` | yes* | Admin dashboard password. *Dashboard returns 503 until set. |
| `ADMIN_BYPASS_KEY` | — | Secret key for owner export bypass. Visit `/design/#bypass=<key>` to skip the $2 export. |
| `CONTACT_EMAIL` | — | Address shown on the legal pages (defaults to `EMAIL_FROM`). |
| `LEGACY_HOSTS` | — | Old hostnames that 301 to `BASE_URL` (default `designer.camwow.tv`). |
| `ORDERS_DIR` | — | Where orders are stored (default `orders/`). |
| `EMAIL_API_KEY` | — | Resend API key (`re_…`). Emails are skipped if unset. |
| `EMAIL_FROM` | — | Sender / admin-notification address. |
| `BASE_URL` | yes | Public origin; Stripe success/cancel URLs derive from it. |
| `PORT` | — | Server port (defaults to `3000`). |

## API routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/`, `/gallery/…`, `/custom-name-chain/` … | Server-rendered site pages. |
| `GET` | `/design/` | The designer (Vite build). |
| `GET` | `/robots.txt`, `/sitemap.xml` | Search engine files. |
| `POST` | `/api/upload-model?format=stl\|3mf` | Binary model upload (gzip accepted); returns `uploadId`. |
| `POST` | `/api/checkout` | Create a Stripe session for a physical order. |
| `POST` | `/api/export-checkout` | Create a $2 Stripe session for an export. |
| `GET` | `/api/export-download/:id` | Download a paid export (402 until paid). |
| `POST` | `/api/verify-bypass` | Check the owner bypass key (rate limited). |
| `POST` | `/api/event` | Anonymous funnel counter. |
| `POST` | `/api/webhooks/stripe` | Stripe webhook (`checkout.session.completed`). |
| `GET` | `/admin` | Password-protected order dashboard. |
| `GET/PUT` | `/admin/api/orders[/:id]` | List / update orders, set tracking. |
| `GET` | `/admin/api/stats`, `/admin/api/backup` | Funnel counts; JSON backup of all orders. |

## Deployment (Plesk Node.js)

1. Push the repo and run `npm install` then `npm run build` on the host
   (the build needs the dev dependencies).
2. Set the **Application Startup File** to `server.js`, and the **Document
   Root** to the app's `dist` folder (e.g. `/httpdocs/dist`). Never point the
   document root at the project folder itself: Plesk's web server would then
   send the unbuilt designer page and make every project file, including
   `orders/`, downloadable.
3. Set all required env vars in the Node.js panel (see table above). Set
   `NODE_ENV=production` to enable the HSTS header.
4. In the Stripe dashboard, add a webhook endpoint at
   `${BASE_URL}/api/webhooks/stripe` subscribed to `checkout.session.completed`,
   and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Restart the app.
6. Open `${BASE_URL}/api/health`. `designerBuilt` and `siteAssetsBuilt` must
   be `true` (if not, the build did not run; see step 1) and
   `projectFolderExposed` must be `false` (if not, fix the document root; see
   step 2).

### Operational notes

- **Single instance only.** The rate limiter, funnel counters and paid markers
  live in process memory / the local `orders/` directory.
- **Orders** are JSON files written atomically. A snapshot of every order is
  saved daily to `orders/backups/` (30 kept) and can be downloaded from the
  admin dashboard. Keep a copy off the server.
- **Payment flow:** checkout stores the design record as `pending_<ref>.json`
  and Stripe metadata carries only `ref`. The webhook creates the order once per
  session and answers 500 if saving fails, so Stripe retries. Exports get an
  `export_<id>.paid` marker; the download endpoint returns 402 until it exists.
- **Temp files** (`upload_*`, `export_*`, `pending_*`) are swept after 4 hours;
  checkout sessions expire after 2.
- **Gallery images** are rendered from `data/gallery.js` with
  `node scripts/render-gallery.js` (needs Playwright) against a running server.
- **Search:** after deploying, add the site in Google Search Console and submit
  `/sitemap.xml`.
