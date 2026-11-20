# Chain Studio launch kit

Everything here is ready to copy, paste and post from your own accounts.
Nothing has been posted for you.

| File | What it is |
| --- | --- |
| `instagram.md` | Bio, 4-week calendar (16 posts), every caption, 5 reel scripts, a photo shot list, weekly routine |
| `ads.md` | Where the $100/month goes, step-by-step Instagram ad setup, 6 ads, week-by-week rules |
| `etsy.md` | 3 listing drafts, tags, personalisation prompts, fee arithmetic, order-to-file workflow |
| `makerworld.md` | 4 free model pages for the sample files, posting order |
| `assets/instagram/` | Per design: `<slug>-portrait.jpg` (1080x1350), `<slug>-square.jpg` (1080x1080); 3 turntable clips (`.mp4`, 6 s) |
| `assets/makerworld/` | 4 sample print files (`.3mf`, colours as separate parts) |

## Read these before posting

1. **The images are 3D renders, not photos.** Lead with your real photos
   wherever you have them. Etsy in particular expects the first photo of a
   listing to be a real finished item.
2. **Etsy does not allow sending buyers to your own site.** The Etsy drafts
   contain no site name, link or site price. Keep it that way in messages and
   parcel inserts.
3. **Etsy expects 3D printed items to be your own original design.** Confirm
   the Cuban link and Twisted Star chain models are yours to sell before listing.
4. **MakerWorld restricts advertising and outside links.** The drafts mention
   the designer in one plain sentence without a link; read the current
   guidelines before adding one.
5. **Buy 3 get 1 free covers four of the same design in one order.** Different
   names are separate orders on the site.
6. **Blanks marked `[OWNER: ...]`** are facts only you know: production and
   delivery times, sizes, test-print settings. Fill them before publishing.
7. Platform rules were checked through search results, not the platforms' own
   pages (those were not reachable while writing). Each file ends with a
   "Checked" section listing what to confirm.

## Tracking

Add `?utm_source=<name>` to any link you share (lowercase letters, digits,
hyphen or underscore, up to 20 characters). The admin dashboard shows visits
per source and 30-day counts for designer opens, clicks, checkouts and paid
orders. Orders themselves are not tagged with a source.

## Regenerating assets

    npm run build && PORT=3999 ADMIN_BYPASS_KEY=<key> node server.js &
    BYPASS_KEY=<key> node scripts/render-marketing.js

Edit `data/gallery.js` to add or change designs. Needs Playwright and ffmpeg.
