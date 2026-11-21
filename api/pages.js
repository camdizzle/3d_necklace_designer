// Server-rendered pages: landing, gallery, search-intent pages, legal
// pages, robots.txt and sitemap.xml. Plain template strings, no engine.
// The designer itself is the Vite build served from /design/.

import express from 'express';
import { GALLERY, designUrl } from '../data/gallery.js';
import { PHOTOS } from '../data/photos.js';
import { recordEvent } from './orders.js';

export const pagesRouter = express.Router();

const SITE = 'Chain Studio';

function baseUrl(req) {
  return (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function contactEmail() {
  const raw = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || '';
  const m = raw.match(/[^\s<>]+@[^\s<>]+/);
  return m ? m[0] : '';
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function layout(req, { title, description, path, image = '/img/og.jpg', body, head = '', index = true }) {
  const base = baseUrl(req);
  const url = base + path;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
${index ? '' : '<meta name="robots" content="noindex">'}
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(base + image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#16213e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
<script>
  // Remember where this visitor first came from (?utm_source=…) for 30
  // days, so a later order can be credited to it. Stays in this browser.
  try {
    var s = new URLSearchParams(location.search).get('utm_source');
    var k = 'cs_source', now = Date.now(), cur = JSON.parse(localStorage.getItem(k) || 'null');
    if (s && /^[a-z0-9_-]{1,20}$/i.test(s) && !(cur && now - cur.at < 2592e6)) {
      localStorage.setItem(k, JSON.stringify({ src: s.toLowerCase(), at: now }));
    }
  } catch (e) {}
</script>
${head}
</head>
<body>
<header class="site-header">
  <a class="brand" href="/">CHAIN STUDIO</a>
  <nav>
    <a href="/gallery/">Gallery</a>
    <a href="/#pricing">Pricing</a>
    <a class="btn btn-small" href="/design/">Start designing</a>
  </nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="footer-links">
    <a href="/design/">Designer</a>
    <a href="/gallery/">Gallery</a>
    <a href="/custom-name-chain/">Custom name chains</a>
    <a href="/3d-printed-name-necklace/">3D printed name necklaces</a>
    <a href="/name-pendant-stl-generator/">Name pendant STL generator</a>
    <a href="/terms/">Terms</a>
    <a href="/privacy/">Privacy</a>
    <a href="/refunds/">Refunds &amp; returns</a>
  </div>
  <p>&copy; ${new Date().getFullYear()} ${SITE}. Chains are 3D printed in plastic with a metallic-tone finish.</p>
</footer>
</body>
</html>`;
}

function galleryCard(item) {
  return `<a class="card" href="/gallery/${item.slug}/">
  <img src="/gallery/${item.slug}-close.jpg" alt="${esc(item.title)} — 3D render of a custom chain" width="1200" height="900" loading="lazy">
  <span>${esc(item.title)}</span>
</a>`;
}

const PRICING = `<section id="pricing" class="section">
  <h2>Simple pricing</h2>
  <div class="price-grid">
    <div class="price">
      <h3>Design</h3>
      <p class="amount">Free</p>
      <p>Every font, shape and colour. No account. Share a link or save a screenshot.</p>
    </div>
    <div class="price price-main">
      <h3>Printed and shipped</h3>
      <p class="amount">$25 <small>per chain</small></p>
      <p>We 3D print your design and ship it free to the US, Canada, UK and Australia. Buy 3, get a 4th free, even with a different name on each.</p>
    </div>
    <div class="price">
      <h3>Print it yourself</h3>
      <p class="amount">$2 <small>per file</small></p>
      <p>Download an STL, or a 3MF that keeps each colour as its own part for multi-colour printers.</p>
    </div>
  </div>
</section>`;

const CTA = `<section class="section cta">
  <h2>Make yours in a couple of minutes</h2>
  <p>It runs in your browser. Nothing to install, no sign-up.</p>
  <a class="btn" href="/design/">Start designing — free</a>
</section>`;

function faqSection(faqs) {
  return `<section class="section">
  <h2>Questions</h2>
  <div class="faq">
${faqs.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('\n')}
  </div>
</section>`;
}

function faqLd(faqs) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') }
    }))
  });
}

const HOME_FAQ = [
  ['What is the chain made of?', 'Each chain is 3D printed in plastic and finished in a gold, silver, rose gold or platinum tone. It is not metal, which keeps it light, bold and affordable.'],
  ['How much does it cost?', 'Designing is free. A printed chain is $25 with free shipping, and every 4th chain in an order is free, even if each one has a different name. A print file for your own 3D printer is $2.'],
  ['Where do you ship?', 'We ship printed chains to the United States, Canada, the United Kingdom and Australia. You get an email with a tracking number when your chain ships.'],
  ['Can I print it myself?', 'Yes. Export an STL for any 3D printer, or a 3MF that keeps every colour as a separate part so a multi-colour printer can assign a filament to each one.'],
  ['Do I need an account?', 'No. Open the designer and start. You only enter details at checkout, which is handled by Stripe.'],
  ['Can I share a design before buying?', 'Yes. The Share button copies a link that opens your exact design, so friends can see it or tweak it.']
];

// ---------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------
pagesRouter.get('/', (req, res) => {
  recordEvent('landing_view', req.query.utm_source);
  const base = baseUrl(req);
  const body = `
<script>
  // Old links pointed at "/" for shared designs and checkout returns.
  if (/^#(design|bypass)=/.test(location.hash) || /[?&](export|order|bypass)=/.test(location.search)) {
    location.replace('/design/' + location.search + location.hash);
  }
</script>
<section class="hero">
  <div class="hero-text">
    <h1>Design your own name chain in 3D</h1>
    <p class="lead">Type a name, pick a pendant shape, font and colours, and spin it around in 3D. Order it printed for <strong>$25 with free shipping</strong>, or download the file and print it yourself for <strong>$2</strong>.</p>
    <a class="btn" href="/design/">Start designing — free</a>
    <p class="note">No sign-up. Works on phone and desktop.</p>
  </div>
  <a class="hero-art" href="/design/"><img src="/gallery/your-hype-chain-close.jpg" alt="Gold custom name chain reading Your Hype Chain on a Cuban link, rendered in 3D" width="1200" height="900"></a>
</section>

<section class="section">
  <h2>How it works</h2>
  <ol class="steps">
    <li><h3>Design it</h3><p>Up to three lines of text, 26 fonts, 9 pendant shapes, and a colour for every line. See every change live in 3D.</p></li>
    <li><h3>Pick your chain</h3><p>Cuban link or Twisted Star, in gold, silver, rose gold or platinum tone.</p></li>
    <li><h3>Order or download</h3><p>We print and ship it to you, or you download the model for your own printer.</p></li>
  </ol>
</section>

${PHOTOS.length ? `<section class="section">
  <h2>From our customers</h2>
  <div class="cards">
${PHOTOS.map((p) => `    <figure class="card photo"><img src="/photos/${esc(p.file)}" alt="${esc(p.alt)}" loading="lazy"><figcaption>${esc(p.caption || '')}</figcaption></figure>`).join('\n')}
  </div>
</section>` : ''}

<section class="section">
  <h2>Made with Chain Studio</h2>
  <p class="sub">3D previews from the designer. Open any design and make it yours.</p>
  <div class="cards">
${GALLERY.slice(0, 8).map(galleryCard).join('\n')}
  </div>
  <p class="center"><a class="link" href="/gallery/">See the full gallery</a></p>
</section>

${PRICING}

<section class="section">
  <h2>What you can make</h2>
  <ul class="features">
    <li><strong>Name chains</strong> in chunky bubble letters or flowing script.</li>
    <li><strong>Gifts</strong> for birthdays, Father's Day, graduations and bridal parties.</li>
    <li><strong>Team and squad chains</strong> in your colours, with a free chain in every four.</li>
    <li><strong>Nameplates</strong> on a heart, star, shield, circle, oval, diamond or rectangle.</li>
    <li><strong>Your own shape</strong> from an SVG file or the outline of a picture.</li>
    <li><strong>Print files</strong> as STL or colour-separated 3MF.</li>
  </ul>
</section>

${faqSection(HOME_FAQ)}
${CTA}`;

  const head = [
    jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: base + '/' }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Custom 3D printed name chain',
      description: 'A custom name chain designed in the Chain Studio 3D designer and 3D printed in plastic with a metallic-tone finish.',
      image: [base + '/img/og.jpg', base + '/gallery/your-hype-chain.jpg'],
      brand: { '@type': 'Brand', name: SITE },
      offers: {
        '@type': 'Offer', price: '25.00', priceCurrency: 'USD',
        availability: 'https://schema.org/InStock', url: base + '/design/',
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'USD' },
          shippingDestination: ['US', 'CA', 'GB', 'AU'].map((c) => ({ '@type': 'DefinedRegion', addressCountry: c }))
        }
      }
    }),
    faqLd(HOME_FAQ)
  ].join('\n');

  res.type('html').send(layout(req, {
    title: 'Chain Studio — Design a Custom Name Chain in 3D',
    description: 'Free 3D name chain designer. Pick fonts, shapes and colours, then order your chain 3D printed for $25 with free shipping, or download the print file for $2.',
    path: '/',
    body,
    head
  }));
});

// ---------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------
pagesRouter.get('/gallery/', (req, res) => {
  recordEvent('landing_view', req.query.utm_source);
  const body = `
<section class="section first">
  <h1>Chain design gallery</h1>
  <p class="sub">Example chains made in the designer. Open one to change the name, font and colours.</p>
  <div class="cards">
${GALLERY.map(galleryCard).join('\n')}
  </div>
</section>
${CTA}`;
  res.type('html').send(layout(req, {
    title: 'Custom Chain Design Gallery — Chain Studio',
    description: 'Browse example custom name chains: bubble letters, script nameplates, team colours and gift chains. Open any design and make it yours.',
    path: '/gallery/',
    body
  }));
});

pagesRouter.get('/gallery/:slug/', (req, res, next) => {
  const item = GALLERY.find((g) => g.slug === req.params.slug);
  if (!item) return next();
  recordEvent('landing_view', req.query.utm_source);
  const base = baseUrl(req);
  const others = GALLERY.filter((g) => g !== item).slice(0, 4);
  const body = `
<section class="section first detail">
  <div class="detail-art">
    <img src="/gallery/${item.slug}-close.jpg" alt="${esc(item.title)} — close-up 3D render" width="1200" height="900">
    <img src="/gallery/${item.slug}.jpg" alt="${esc(item.title)} — full chain 3D render" width="1200" height="1200" loading="lazy">
  </div>
  <div class="detail-text">
    <h1>${esc(item.title)}</h1>
    <p class="lead">${esc(item.blurb)}</p>
    <a class="btn" href="${esc(designUrl(item))}">Customize this design</a>
    <p class="note">Change the text, font, shape and colours, then order it printed for $25 with free shipping or download the print file for $2.</p>
  </div>
</section>
<section class="section">
  <h2>More designs</h2>
  <div class="cards">
${others.map(galleryCard).join('\n')}
  </div>
</section>`;
  res.type('html').send(layout(req, {
    title: `${item.title} — Custom Chain Design | Chain Studio`,
    description: `${item.blurb} Open this design in the free 3D designer and make it yours.`,
    path: `/gallery/${item.slug}/`,
    image: `/gallery/${item.slug}-close.jpg`,
    body,
    head: jsonLd({
      '@context': 'https://schema.org', '@type': 'ImageObject',
      name: item.title, description: item.blurb,
      contentUrl: `${base}/gallery/${item.slug}-close.jpg`
    })
  }));
});

// ---------------------------------------------------------------------
// Search-intent pages
// ---------------------------------------------------------------------
const INTENT_PAGES = [
  {
    path: '/custom-name-chain/',
    title: 'Custom Name Chain — Design Yours in 3D | Chain Studio',
    description: 'Make a custom name chain with your name, your font and your colours. Preview it in 3D, then get it 3D printed and shipped for $25.',
    h1: 'Custom name chains, designed by you',
    lead: 'A name chain should look the way you picture it. Type the name, choose the lettering, and turn it around in 3D before you spend anything.',
    picks: ['your-hype-chain', 'king-twisted-star', 'go-tigers-team', 'gg-gamer-tag'],
    sections: [
      ['Bold letters that read from across the room', 'The outline style floats chunky letters on a contrasting base, so a name stays readable at a distance. Eight bubble and display fonts are built for it, and each line of text can have its own colour.'],
      ['One, two or three lines', 'Stack a first name over a nickname, add a number, or keep it to one big word. Each line has its own font, size, spacing and curve.'],
      ['Your chain, your finish', 'Choose a Cuban link or Twisted Star chain in a gold, silver, rose gold or platinum tone. The pendant and the chain can match or contrast.'],
      ['Honest about what it is', 'These chains are 3D printed in plastic with a metallic-tone finish. They are light enough to wear all day and cost $25 with free shipping, not hundreds.']
    ],
    faqs: [
      ['How long can the name be?', 'Each line holds up to about 16 to 20 characters, and you can use up to three lines. Shorter text prints with bolder letters.'],
      ['Can I match team or school colours?', 'Yes. Every line of text takes any colour, and the base behind the letters has its own colour too.'],
      ['Is there a discount for groups?', 'Every 4th chain in an order is free, so a set of four costs the same as three. Each chain can have a different name: add each design to the same order.']
    ]
  },
  {
    path: '/3d-printed-name-necklace/',
    title: '3D Printed Name Necklace — Custom Made to Order | Chain Studio',
    description: 'Order a 3D printed name necklace made from your own design. Choose a pendant shape, font and colours. $25 with free shipping, buy 3 get 1 free.',
    h1: '3D printed name necklaces, made to order',
    lead: 'Every necklace is printed from the design you make, so no two orders are the same. See the exact model in 3D first, with its real size in millimetres.',
    picks: ['maya-heart-nameplate', 'best-dad-silver', 'bride-squad-rose', 'class-of-2027-circle'],
    sections: [
      ['Nine pendant shapes', 'Raise a name on a heart, star, shield, circle, oval, diamond or rectangle plate, float the letters on their own with the outline style, or upload an SVG for a shape of your own.'],
      ['Script or block lettering', 'There are 26 fonts: eight script fonts for a classic nameplate look, ten clean block fonts, and eight bubble fonts for a louder style.'],
      ['Made for gifting', 'Birthdays, Father\'s Day, graduations and bridal parties all work. Add a note at checkout if you need something specific, and send friends a share link to get their opinion first.'],
      ['What arrives', 'A plastic chain and pendant printed as designed, in the finish tone you picked. You get a confirmation email when you order and a tracking number when it ships.']
    ],
    faqs: [
      ['How big is the pendant?', 'The designer shows the pendant\'s width, height and depth in millimetres as you work, and you can scale it up or down.'],
      ['Is it real gold or silver?', 'No. It is plastic with a gold, silver, rose gold or platinum tone. That is why it costs $25.'],
      ['What if it arrives damaged?', 'Tell us within 14 days and we will reprint it or refund you. See the <a href="/refunds/">refund policy</a>.']
    ]
  },
  {
    path: '/name-pendant-stl-generator/',
    title: 'Name Pendant STL Generator — Custom Chain Files for 3D Printing | Chain Studio',
    description: 'Generate a custom name pendant and chain as an STL or colour-separated 3MF for your 3D printer. Free to design, $2 per download.',
    h1: 'Name pendant STL generator',
    lead: 'Design a name pendant in the browser and download a print-ready file for your own printer. The designer is free; a file is $2.',
    picks: ['your-hype-chain', 'gg-gamer-tag', 'go-tigers-team', 'king-twisted-star'],
    sections: [
      ['STL or colour 3MF', 'STL gives you one solid model for any slicer. 3MF keeps the chain, the base and each colour of lettering as separate parts, so on a multi-colour printer you assign a filament to each part instead of painting the model by hand.'],
      ['Sized in millimetres', 'The live readout shows the pendant\'s real dimensions. Lock the pendant to a fixed size, or scale the pendant and chain separately to fit your bed.'],
      ['A print check before you pay', 'The designer warns you about lettering that is too small, parts that are too thin, and pendants too large for most beds before you buy the file.'],
      ['Pendant with or without the chain', 'Hide the chain to export the pendant alone, or keep it to print the whole piece. Outline pendants print flat with the letters facing up.']
    ],
    faqs: [
      ['Which printers does the 3MF work with?', 'Any slicer that reads standard 3MF. Each colour is a separate part with its colour stored, which suits multi-colour systems that assign filaments per part.'],
      ['Can I sell prints of my design?', 'Yes. You can print and sell chains you design. You are responsible for having the right to use any names, logos or artwork you add. See the <a href="/terms/">terms</a>.'],
      ['Can I change the design after I buy?', 'Each download is one file. Your design is still in the designer after checkout, so you can tweak it and buy another.']
    ]
  }
];

for (const page of INTENT_PAGES) {
  pagesRouter.get(page.path, (req, res) => {
    recordEvent('landing_view', req.query.utm_source);
    const picks = page.picks.map((slug) => GALLERY.find((g) => g.slug === slug)).filter(Boolean);
    const body = `
<section class="section first">
  <h1>${esc(page.h1)}</h1>
  <p class="lead narrow">${esc(page.lead)}</p>
  <p><a class="btn" href="/design/">Start designing — free</a></p>
  <div class="cards">
${picks.map(galleryCard).join('\n')}
  </div>
</section>
<section class="section prose">
${page.sections.map(([h, p]) => `  <h2>${esc(h)}</h2>\n  <p>${esc(p)}</p>`).join('\n')}
</section>
${PRICING}
${faqSection(page.faqs)}
${CTA}`;
    res.type('html').send(layout(req, {
      title: page.title, description: page.description, path: page.path, body, head: faqLd(page.faqs)
    }));
  });
}

// ---------------------------------------------------------------------
// Legal pages
// ---------------------------------------------------------------------
function contactLine() {
  const email = contactEmail();
  return email
    ? `Email <a href="mailto:${esc(email)}">${esc(email)}</a>`
    : 'Reply to your order confirmation email';
}

const LEGAL = {
  '/terms/': {
    title: 'Terms of Service',
    description: 'The terms for using the Chain Studio designer and buying printed chains or print files.',
    body: () => `
<p>These terms apply when you use ${SITE} or buy from it. By using the site you agree to them.</p>
<h2>The designer</h2>
<p>The designer is free to use. Designs are stored in your browser and in any share link you create. Anyone with a share link can open that design.</p>
<h2>Printed chains</h2>
<p>Printed chains are made to order from the design you submit. They are 3D printed in plastic with a metallic-tone finish; they are not metal. Colours on screen are a guide and the printed colour can differ slightly. Small print lines and marks are a normal part of 3D printing.</p>
<p>The 3D preview and the "print check" warnings are guidance. Please check spelling, size and colours before you pay, because we print what you send.</p>
<h2>Print files</h2>
<p>When you buy a print file you may print it as many times as you like, for yourself or to sell the printed items. You may not resell or redistribute the file itself. We cannot promise a file will print well on every printer or with every setting.</p>
<h2>Your content</h2>
<p>You are responsible for the names, text, images and shapes you add. Do not use logos, brands, characters or artwork you do not have the right to use, and do not submit hateful or unlawful content. We may decline and refund an order for these reasons.</p>
<h2>Payment</h2>
<p>Prices are in US dollars and shown before you pay. Payments are processed by Stripe; we never see your card number.</p>
<h2>Shipping</h2>
<p>We ship to the United States, Canada, the United Kingdom and Australia. Shipping is free. You may be responsible for any import duties or taxes charged by your country.</p>
<h2>Returns and refunds</h2>
<p>See the <a href="/refunds/">refund policy</a>.</p>
<h2>Liability</h2>
<p>Chains are novelty accessories. They contain small parts and are not suitable for children under 3. To the extent the law allows, our liability for any order is limited to the amount you paid for it. Nothing in these terms limits rights you have under consumer law.</p>
<h2>Changes and contact</h2>
<p>We may update these terms; the version on this page applies to new orders. ${contactLine()} with any question.</p>`
  },
  '/privacy/': {
    title: 'Privacy Policy',
    description: 'What information Chain Studio collects, why, and who it is shared with.',
    body: () => `
<p>This page explains what ${SITE} collects and why.</p>
<h2>If you only use the designer</h2>
<p>You do not need an account. Your design, saved presets and panel layout are kept in your browser's local storage on your device. We count page visits and button clicks as anonymous daily totals (for example, "42 exports started today"). These counts are not linked to you, and we do not use advertising cookies or third-party analytics.</p>
<p>Images or SVG files you load into the designer are processed in your browser. The finished 3D model is uploaded to us only when you start a checkout.</p>
<h2>If you buy something</h2>
<p>For a printed chain we keep your name, email address, shipping address, the design and its 3D model, any comments you add, and the order amount. We use this to make and ship the order, email you about it, and handle problems. For a print file we keep the model only long enough for you to download it.</p>
<p>Payments are handled by Stripe, which receives your payment details directly; we never see or store your card number. Order emails are sent through Resend, which receives your name and email address for that purpose. Our web host stores standard server logs, including IP addresses.</p>
<h2>What we do not do</h2>
<p>We do not sell your information or share it for advertising.</p>
<h2>Keeping and deleting</h2>
<p>We keep order records for as long as we need them for accounting and support. You can ask for a copy of your information or ask us to delete it, and we will do so unless we are required to keep it.</p>
<h2>Contact</h2>
<p>${contactLine()} with any privacy request.</p>`
  },
  '/refunds/': {
    title: 'Refunds and Returns',
    description: 'What happens if a Chain Studio order arrives damaged or wrong, and how refunds work for custom chains and print files.',
    body: () => `
<p>Every chain is made to order from your design, so the rules are a little different from ordinary shopping.</p>
<h2>Printed chains</h2>
<ul>
  <li><strong>Damaged, defective or not what you designed:</strong> contact us within 14 days of delivery with a photo. We will reprint it or refund you, your choice.</li>
  <li><strong>Lost in the post:</strong> if tracking shows it never arrived, contact us and we will reprint it or refund you.</li>
  <li><strong>Changed your mind, or a typo in your own text:</strong> because the chain is custom made we cannot take it back, but contact us quickly; if we have not started printing we can change or cancel the order.</li>
</ul>
<h2>Print files</h2>
<p>A print file is a digital download and is not refundable once downloaded. If the file is faulty or the download failed, contact us and we will fix it or refund you.</p>
<h2>How refunds are paid</h2>
<p>Refunds go back to the card you paid with through Stripe, usually within 5 to 10 business days.</p>
<h2>Contact</h2>
<p>${contactLine()} and include your order ID.</p>
<p class="note">Nothing here limits rights you have under the consumer law of your country.</p>`
  }
};

for (const [path, page] of Object.entries(LEGAL)) {
  pagesRouter.get(path, (req, res) => {
    res.type('html').send(layout(req, {
      title: `${page.title} — ${SITE}`,
      description: page.description,
      path,
      body: `<section class="section first prose legal"><h1>${page.title}</h1>${page.body()}</section>`
    }));
  });
}

// ---------------------------------------------------------------------
// robots.txt and sitemap.xml
// ---------------------------------------------------------------------
pagesRouter.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`
  );
});

pagesRouter.get('/sitemap.xml', (req, res) => {
  const base = baseUrl(req);
  const paths = [
    '/', '/design/', '/gallery/',
    ...INTENT_PAGES.map((p) => p.path),
    ...GALLERY.map((g) => `/gallery/${g.slug}/`),
    ...Object.keys(LEGAL)
  ];
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join('\n') +
    '\n</urlset>\n'
  );
});
