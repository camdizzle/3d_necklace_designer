# Chain Studio — 3D Necklace Designer

Web-based designer for custom hip-hop neck chains with text pendants. Built with
Three.js (frontend) and an Express backend that handles Stripe payments, order
fulfillment, and a password-protected admin dashboard.

## Business model

- **Design, share, screenshot** — free, all features unlocked.
- **Export STL** — $2 per download via Stripe Checkout.
- **Order a physical print** — $25/unit via Stripe Checkout (buy 3 get 1 free).

## Stack

- **Frontend:** Vite + Three.js (vanilla JS). Source in `src/`, entry `index.html`.
- **Backend:** Express (`server.js`) serving the built `dist/` plus the API.
- **Storage:** file-based orders in `orders/` (JSON + STL). No database.
- **Payments:** Stripe Checkout + webhooks.
- **Email:** Resend (order confirmation, admin notification, shipping notice).

## Local development

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev            # Vite dev server (frontend only) on :5173
```

To run the full stack (API + built frontend) locally:

```bash
npm run build          # outputs dist/
npm start              # Express on :3000 (or $PORT)
```

## Tests

```bash
npm test               # Node built-in runner; covers pricing math + ID validation
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
| `ADMIN_BYPASS_KEY` | — | Secret key for owner export bypass. Visit `?bypass=<key>` to skip $2 export. |
| `EMAIL_API_KEY` | — | Resend API key (`re_…`). Emails are skipped if unset. |
| `EMAIL_FROM` | — | Sender / admin-notification address. |
| `BASE_URL` | yes | Public origin; Stripe success/cancel URLs derive from it. |
| `PORT` | — | Server port (defaults to `3000`). |

## API routes

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/checkout` | Create a Stripe session for a physical order. |
| `POST` | `/api/export-checkout` | Create a $2 Stripe session for an STL export. |
| `GET` | `/api/export-download/:id` | Download a paid export (402 until paid). |
| `POST` | `/api/webhooks/stripe` | Stripe webhook (`checkout.session.completed`). |
| `GET` | `/admin` | Password-protected order dashboard. |
| `GET/PUT` | `/admin/api/orders[/:id]` | List / update orders, set tracking. |

## Deployment (Plesk Node.js)

1. Push the repo and run `npm install --omit=dev` then `npm run build` on the host.
2. Set the **Application Startup File** to `server.js`.
3. Set all required env vars in the Node.js panel (see table above). Set
   `NODE_ENV=production` to enable the HSTS header.
4. In the Stripe dashboard, add a webhook endpoint at
   `${BASE_URL}/api/webhooks/stripe` subscribed to `checkout.session.completed`,
   and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Restart the app.

### Operational notes

- **Single instance only.** The rate limiter and webhook-paid markers live in
  process memory / the local `orders/` directory. Running multiple workers or
  instances would split that state — use a shared store (Redis) first.
- **Temp files** (`export_*`, `pending_*` in `orders/`) are swept automatically
  every 30 minutes once older than 2 hours.
- **Payment flow:** the webhook writes an `export_<id>.paid` marker; the download
  endpoint returns 402 until it exists, and the frontend retries with backoff.
