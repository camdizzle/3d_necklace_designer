# Chain Studio paid ads plan: month 1 on $100

Written 20 November 2026 for the owner to follow alone, without an agency or prior Ads Manager experience. Facts about the product come from `promo-context.txt` and `api/pages.js`. Facts about Meta's ad system were checked by web search on the day of writing; what was and was not confirmed is listed under [Checked](#checked) at the end. Ads Manager moves and renames buttons often, so where a label below does not match your screen, pick the nearest equivalent.

Two rules apply to every ad, caption and reply:

- The chain is **3D printed plastic with a metallic-tone finish**. Write "gold-tone", never "gold". Never say or imply metal, plating, or real gold or silver.
- Do not state a delivery time, a review, or a result you cannot back up. The site promises none, so the ads promise none.

---

## 1. Where the $100 goes

**All of it goes to Instagram ads, set up in Meta Ads Manager, sending people to the website.** One channel, one campaign.

| What | Daily | Days | Total |
|---|---|---|---|
| Ad set A: name chains, US, days 1 to 28 | $3 | 28 | $84 |
| Ad set B: 3D printer owners, days 8 to 14 only | $2 | 7 | $14 |
| Unspent buffer | | | $2 |
| **Total** | | | **$100** |

If Ads Manager refuses a daily budget as too low (see Checked: sources disagree on whether the floor for click ads is $1 or $5 a day), use this instead: ad set A at $5 a day for 17 days ($85), ad set B at $5 a day for 3 days ($15). The week-by-week rules in section 4 still apply; the checkpoints just arrive sooner.

### Why Instagram

- You already have the account, and the product is visual. A spinning chain with a name on it explains itself in two seconds.
- The creative already exists: rendered images for every gallery design, three turntable clips, and your own product photos.
- Meta sells impressions cheaply enough that $100 buys a usable number of visits. Search clicks cost several times more (below).
- It needs nothing installed on the site. A link with `utm_source` on it is enough to count arrivals.

### What not to spend on at this budget

| Not this | Why |
|---|---|
| **Google Search ads** | One industry report (WordStream/LocaliQ 2026, US search campaigns) puts the median cost per click for "Apparel, Fashion & Jewelry" at about $4.44. That is a rough vendor figure, but at that order of magnitude $100 buys around 20 to 25 clicks, which is too few to learn anything. Search is also where shoppers type "gold name necklace"; the site ranks for those terms for free through its three search pages, and a plastic chain is a poor match for someone searching for real jewellery. |
| **The "Boost post" button** | It makes one ad from one post with fewer controls. Ads Manager lets three ads share one budget and shows link clicks per ad, which is the whole point of month 1. |
| **A "Sales" campaign** | Sales campaigns need Meta to see purchases on your site, which needs the Meta pixel. There is no pixel, so Meta would have nothing to optimise towards. |
| **Splitting across Instagram, TikTok and Pinterest** | $33 per platform teaches nothing on any of them. |
| **Paying influencers or buying shout-outs** | No way to measure it beyond one `utm_source`, and one post can cost the whole budget. Sending a free chain to a small creator is a product cost, not ad spend, and is covered in section 6. |
| **Ads to Canada, the UK or Australia in month 1** | You ship there, but four countries on $3 a day spreads the money too thin. Start with the US. If you are based in one of the other three and US postage is your most expensive, swap in your own country instead; keep it to one. |

### Unit economics sanity check

Fill in your own numbers. Do this before spending anything.

```
Price per chain                          P  = $25.00
Your cost to make and deliver one chain  C  = $____
   (filament + chain parts + finish + packaging + postage
    + Stripe's fee, which is shown on each payment in your Stripe dashboard)
Margin per chain                         M  = P - C = $____

Break-even cost per order  = M x (chains per order)
   One-chain order:            break-even = M
   Four-chain order (pay for 3): revenue $75, cost 4 x C, margin = 75 - 4C

Orders needed to cover $100 of ads = 100 / M   (round up)
Actual cost per order              = ad spend / paid orders that came from ads
```

Worked examples so the formula is not abstract. These are illustrations, not estimates of your costs:

| If M is | One-chain orders needed to cover $100 |
|---|---|
| $8 | 13 |
| $12 | 9 |
| $16 | 7 |

Now the uncomfortable part. Published benchmarks for Meta cost per click vary widely between vendors: roughly $0.29 to $1.11 in the sources found (see Checked). Those are other people's averages, not a prediction for this account. At that range, $84 buys somewhere between about 75 and 290 clicks. To get 9 orders from 75 to 290 clicks you would need 3% to 12% of clickers to pay, which is a high bar for people who had never heard of the site a minute earlier.

So treat month 1 as **buying information, not profit**. A realistic good result is: you learn which angle gets clicked, whether visitors open the designer, whether they press Order, and you get a handful of orders. If the ads pay for themselves in month 1, that is a bonus.

**The $2 print file cannot pay for ads by itself.** After Stripe's fee you keep under $2 per file, and a click will usually cost a meaningful fraction of that. Ad set B is a $14 test of whether printer owners respond at all, not a profit line.

---

## 2. Campaign setup, step by step

### Before you open Ads Manager

1. **Confirm the site is live at `https://hypechain.c23d.shop`** and that all three landing URLs in the table below open on your phone. Do not launch ads until they do.
2. **Place one real test order** on your phone, starting from a link opened inside the Instagram app (send yourself the link in a DM and tap it). Instagram opens links in its own built-in browser, and the 3D designer has to load and check out there, because that is where every ad click will land.
3. **Write down your baseline.** Open the admin dashboard and copy all nine "Last 30 days" numbers and the "Visits by source" line into a note, with the date. Everything in section 4 is measured against this.
4. **Fill in M** in the unit economics box above.
5. **Add a link in your Instagram bio** with its own tag so free traffic is counted separately from ads: `https://hypechain.c23d.shop/?utm_source=ig-bio`

### How measurement works here (read once)

The dashboard counts, for the last 30 days: home page visits, designer opens, export clicks, export checkouts, exports paid, order clicks, order checkouts, orders paid, and visits broken down by `utm_source`.

What that lets you measure:

- **How many people arrived from each ad**, because each ad gets its own `utm_source`.
- **Whether the totals moved** (designer opens, order clicks, checkouts, paid orders) compared with your baseline.
- **Cost per arrival** per ad: Ads Manager's spend divided by the dashboard's visits for that source.

What it cannot measure:

- **Which ad produced a given order.** Orders are not tagged with a source. You can only compare totals before and during the ads, and use judgement.
- **What an ad visitor did after the landing page.** When someone lands on a page with `utm_source` and then taps "Start designing", the tag is not carried into the designer, so "Designer opens" is not split by source for those visitors.
- **`utm_campaign`.** The dashboard only reads `utm_source`. `utm_campaign` is in the links below so they are ready for any future analytics, but today it shows nowhere. That is why each ad has a different `utm_source`.
- **People, repeat visits, or anything across days.** There are no cookies. A count is page loads, not unique visitors.

Things that distort the counts, so do not over-read small differences:

- "Home page visits" includes the three search landing pages, and includes search-engine crawlers (the dashboard says so).
- Meta's own systems load your link when reviewing an ad. Expect a few visits per source before any person has clicked.
- Gallery pages (`/gallery/...`) count as visits by source too, but the landing pages in the table below are better ad destinations.
- A `utm_source` only counts if it is lowercase letters, digits, hyphen or underscore, and 20 characters or fewer. The values below all fit. Do not improvise longer ones.
- The dashboard shows a rolling 30-day total, not a chart. To see a week's change you must write the numbers down weekly. If you want per-day figures, open `https://hypechain.c23d.shop/admin/api/stats` in the same browser while logged in to the admin page; it shows the raw daily counts the dashboard is built from.

Ads Manager fills the gap on the ad side. Without any pixel it reports, per ad: amount spent, impressions, link clicks, cost per link click, and link click-through rate. Those five numbers plus the dashboard are the whole measurement system.

**About the Meta pixel.** Installing it would let Meta see purchases, attribute orders to ads, and run Sales campaigns. It is a separate decision, not part of this plan, because it has consequences: the site's privacy page currently says "we do not use advertising cookies or third-party analytics" and "we do not sell your information or share it for advertising". Both statements would become untrue and the page would have to be rewritten, and visitors in the UK would very likely need to be asked for consent before the pixel loads. Decide that deliberately in month 2 or later (section 5), with advice if needed, not as a side effect of following an ad tutorial.

### Create the campaign

Use a computer, not the phone app. Go to `adsmanager.facebook.com` and log in with the Facebook account connected to your Instagram account. If asked, confirm the ad account, payment method and that your Instagram account is linked.

**First, cap your spend.** In Billing and payments, find "Account spending limit" and set it to **$100**. This is a hard stop that protects you from mistakes. (This setting existed when last known; its location was not re-checked on the day of writing.)

**Campaign level**

1. Click **Create**.
2. Buying type: **Auction**.
3. Objective: **Traffic**. (The six current objectives are Awareness, Traffic, Engagement, Leads, App promotion, Sales.)
4. If offered a choice between a guided or tailored setup and a manual one, choose **manual**.
5. Campaign name: `cs-launch-m1`
6. Special ad categories: none.
7. Campaign budget (also called Advantage campaign budget): **off**. You will set the budget on each ad set, so the printer-owner test cannot take money from the main ad set.
8. A/B test: off.

**Ad set A: name chains**

| Setting | Value |
|---|---|
| Ad set name | `a-chains-us` |
| Conversion location | Website |
| Performance goal | **Maximise number of link clicks** |
| Budget | **Daily budget, $3.00** |
| Schedule | Start today, set an **end date 28 days from today** |
| Location | United States (or your one chosen country) |
| Age | 18 to 44 |
| Gender | All |
| Detailed targeting / interests | Type and add the closest matches to: **Streetwear**, **Hip hop fashion**, **Necklace**, **Personalized gifts** |
| Languages | English |
| Placements | **Manual placements**. Tick Instagram only. Untick Facebook, Messenger, Audience Network and Threads. Within Instagram keep Feed, Profile feed, Explore, Stories and Reels. |

Notes on those choices:

- **Link clicks, not landing page views.** Landing page views were traditionally counted by the pixel. One source says Meta now offers that goal without a pixel, but it could not be confirmed, so use link clicks.
- **If Ads Manager only shows "Advantage+ audience"**, look for a link such as "Switch to original audience options" or "Further limit the reach". If you cannot find it, set the country and minimum age 18 as controls and enter the interests as suggestions. That is acceptable.
- **Audience Network off matters.** It places ads in other companies' apps and is a common source of accidental taps that never become real visits.
- **Always set the end date.** A daily budget with no end date keeps charging.

**Ad set B: 3D printer owners** (create it now, scheduled for week 2)

| Setting | Value |
|---|---|
| Ad set name | `b-makers-us` |
| Conversion location, performance goal, placements, location, language | Same as ad set A |
| Budget | **Daily budget, $2.00** |
| Schedule | **Start 7 days from today, end 14 days from today** |
| Age | 18 to 54 |
| Detailed targeting / interests | **3D printing**, plus the closest matches to **3D printers** or a printer brand if offered |

**Ads**

Create three ads in ad set A and one in ad set B, using the copy in section 3. For each ad:

1. Ad name: as given in section 3 (for example `gift`).
2. Identity: your Instagram account.
3. Ad setup: **Create ad** (or "Use existing post" if you have already posted that exact image or clip and want its likes to carry over).
4. Format: single image or video.
5. Upload the asset named in section 3. Upload the **portrait** image as the main one. If Ads Manager offers a per-placement crop, leave Stories and Reels on the portrait version and use the **square** file for any placement that asks for 1:1.
6. Paste primary text, headline and description.
7. Call to action: as given.
8. **Website URL: paste the full URL from the table below, including everything after the `?`.** Leave the separate "URL parameters" box empty.
9. Turn **off** any Advantage+ creative options that rewrite your text, generate image variations, or add music. Your wording about plastic and price has to stay exactly as written.
10. Use the preview to check the first line of the primary text is readable on Stories and Reels, then **Publish**.

Ads go into review, usually briefly. If one is rejected, read the stated reason, fix that one thing, and resubmit.

### Destination URLs

| Ad | Ad set | Lands on | Full URL to paste |
|---|---|---|---|
| `gift` | A | 3D printed name necklace page | `https://hypechain.c23d.shop/3d-printed-name-necklace/?utm_source=ig-gift&utm_medium=paid&utm_campaign=launch-m1` |
| `squad` | A | Custom name chain page | `https://hypechain.c23d.shop/custom-name-chain/?utm_source=ig-squad&utm_medium=paid&utm_campaign=launch-m1` |
| `name` | A | Custom name chain page | `https://hypechain.c23d.shop/custom-name-chain/?utm_source=ig-name&utm_medium=paid&utm_campaign=launch-m1` |
| `photo` | A (reserve) | Home page | `https://hypechain.c23d.shop/?utm_source=ig-photo&utm_medium=paid&utm_campaign=launch-m1` |
| `tag` | A (reserve) | Custom name chain page | `https://hypechain.c23d.shop/custom-name-chain/?utm_source=ig-tag&utm_medium=paid&utm_campaign=launch-m1` |
| `stl` | B | Name pendant STL generator page | `https://hypechain.c23d.shop/name-pendant-stl-generator/?utm_source=ig-stl&utm_medium=paid&utm_campaign=makers-m1` |
| (week 3 test, see section 4) | A | The designer itself | `https://hypechain.c23d.shop/design/?utm_source=ig-direct&utm_medium=paid&utm_campaign=launch-m1` |

After publishing, click each ad's preview link once yourself and check the next day that the source appears in "Visits by source". If a source never appears while Ads Manager shows clicks, the URL was pasted wrongly.

---

## 3. Six ads, ready to paste

Six are written; **never run more than three at once in ad set A**. On $3 a day, more than three means none of them gets enough impressions to judge. `gift`, `squad` and `name` start. `photo` and `tag` are reserves that replace losers.

Lengths: every primary text is 125 characters or fewer so it shows without a "more" cut on feed. On Reels and Stories less is shown, so each one opens with the point. Headlines are 27 characters or fewer and descriptions 25 or fewer, because some placements shorten or drop them.

Policy note that shaped the wording: Meta does not allow an ad to imply it knows something personal about the viewer, including their name. "A chain with your name on it" describes the product and is fine. "Maya, this chain is for you" is not. Never put a viewer-style greeting with a name in the text.

### Ad 1: `gift` (gift angle)

- **Asset:** `best-dad-silver` turntable clip. Fallback image: `marketing/assets/instagram/best-dad-silver-portrait.jpg`
- **Primary text:** A gift with their name on it. Design the chain free in 3D. $25 printed, free shipping. Plastic, metallic-tone finish.
- **Headline:** Design a name chain gift
- **Description:** $25 printed, ships free
- **Button:** Shop now
- **Lands on:** `/3d-printed-name-necklace/` with `utm_source=ig-gift`

Do not add "arrives by" or any holiday delivery date unless you personally know your print and postage times and are willing to honour them.

### Ad 2: `squad` (team and squad set angle)

- **Asset:** `marketing/assets/instagram/go-tigers-team-portrait.jpg`. Alternative for a bridal audience: `bride-squad-rose-portrait.jpg`
- **Primary text:** Matching chains for the team, the squad or the bridal party. Your words, your colours. $25 each, every 4th chain free.
- **Headline:** Buy 3 chains, get 1 free
- **Description:** Free shipping included
- **Button:** Shop now
- **Lands on:** `/custom-name-chain/` with `utm_source=ig-squad`

Keep the artwork generic ("Go Tigers", "Bride Squad"). Do not make ad images with real league, club or brand names or logos.

### Ad 3: `name` (design your own)

- **Asset:** `your-hype-chain` turntable clip. Fallback image: `marketing/assets/instagram/your-hype-chain-portrait.jpg`
- **Primary text:** Type a name, pick the letters and colours, spin it in 3D. Free to design, no sign-up. $25 printed. Plastic, not metal.
- **Headline:** Design your own name chain
- **Description:** Free 3D designer
- **Button:** Learn more
- **Lands on:** `/custom-name-chain/` with `utm_source=ig-name`

### Ad 4: `stl` (3D printer owners, $2 file) for ad set B

- **Asset:** `marketing/assets/instagram/gg-gamer-tag-square.jpg`. Better, if you have one: a real photo of a chain on your printer's bed.
- **Primary text:** Got a 3D printer? Design a name pendant and chain in your browser. Download the STL or colour-separated 3MF for $2.
- **Headline:** Name pendant STL generator
- **Description:** Design free, $2 a file
- **Button:** Learn more
- **Lands on:** `/name-pendant-stl-generator/` with `utm_source=ig-stl`

Use "Learn more", not "Download". A Download button suggests the file is free.

### Ad 5: `photo` (the real product) reserve

- **Asset:** your best real product photo, in daylight, in a hand or worn. Crop to portrait.
- **Primary text:** This is what arrives: a name chain 3D printed in plastic with a metallic-tone finish. $25, free shipping. Design yours.
- **Headline:** Custom chain, $25 shipped
- **Description:** 3D printed to order
- **Button:** Shop now
- **Lands on:** `/` with `utm_source=ig-photo`

Only use a photo of a chain that was really printed from the designer. This ad sets honest expectations, and it is the one to bring in if people click but do not order.

### Ad 6: `tag` (gamertag and streamer names) reserve

- **Asset:** `gg-gamer-tag` turntable clip. Fallback image: `marketing/assets/instagram/gg-gamer-tag-portrait.jpg`
- **Primary text:** A gamertag on a chain. Neon on black, or any colours. Design it free in 3D. $25 printed, free shipping. It's plastic.
- **Headline:** Put a gamertag on a chain
- **Description:** Design free in 3D
- **Button:** Learn more
- **Lands on:** `/custom-name-chain/` with `utm_source=ig-tag`

If you run `tag`, add the interests **Video games** and **Twitch** by duplicating ad set A rather than editing it, and pause the original for those days so the daily total stays at $3.

---

## 4. Month 1, week by week

Every threshold here is a working rule chosen for a $100 test, not an industry standard. Small numbers are noisy; when a result is close to a threshold, wait a week instead of acting.

Each Monday, record in one note: the nine dashboard numbers, the visits-by-source line, and from Ads Manager the spend, impressions, link clicks and cost per link click for each ad. The dashboard is a rolling 30 days, so the weekly change is this week's number minus last week's; if the site has more than 30 days of history, old days are also dropping off, and the `/admin/api/stats` daily figures are the more exact way to see one week.

Terms used below:

- **Ad visits** = the sum of dashboard visits for the `ig-` ad sources (not `ig-bio`).
- **Arrival rate** = ad visits divided by Ads Manager link clicks.
- **Baseline pace** = your pre-ads number divided by 30, times the days since launch. "Above baseline" means more than that.

### Days 1 to 3: check it works, change nothing else

- All three ads show "Active". If one is rejected, fix and resubmit.
- Each source appears under "Visits by source".
- **Stop and fix if:** Ads Manager shows 10 or more link clicks on an ad and the dashboard shows none for its source. The URL is wrong.
- Do not judge any ad yet. Do not edit ads that are running; each edit restarts Meta's delivery learning.

### End of week 1 (about $21 spent)

- **Arrival rate below 0.5:** more than half the clicks are not reaching the page. Check that Audience Network is unticked and that the landing page loads quickly on a phone inside Instagram. Fix that before anything else.
- **Pause an ad if** it has at least 1,000 impressions and its cost per link click is more than double the best ad's. Replace it with `photo`. If you have no real photo yet, replace with `tag`.
- **Do nothing if** Meta has given one ad most of the impressions. That is normal; it is betting on the one that gets clicked.
- **Do not act on** any ad with fewer than 500 impressions.

### Week 2 (ad set B runs alongside, about $35 spent this week)

- Ad set B starts by itself on day 8 and stops on day 14. Confirm on day 8 that it went live and `ig-stl` appears.
- **Judging the maker test at day 14:** compare "Export clicks" for week 2 with week 1. Export is used almost only by printer owners, so this is the cleanest signal on the dashboard.
  - Export clicks up by 3 or more, or any export paid above baseline: the maker audience responds. Note it for month 2.
  - No change: do not fund maker ads again. Use the free maker channels in section 6 instead.
  - Either way, ad set B ends on day 14. Do not extend it in month 1.

### End of week 2 (about $56 spent): the main checkpoint

Compare totals against baseline pace and take the **first** rule that matches:

1. **Fewer than 30 ad visits in total.** The ads are not getting clicked at a workable price. Pause everything except the single best ad, and launch both reserves next to it. Go to the week 3 rule for this case.
2. **30 or more ad visits, but "Designer opens" has risen above baseline by fewer than one quarter of the ad visits.** People arrive and leave without trying the designer. Duplicate your best ad, change only its Website URL to the `/design/` URL with `utm_source=ig-direct`, and pause the original. Those visitors land straight in the designer and are counted by source as designer opens.
3. **Designer opens are up, but "Order clicks" is not above baseline.** People play with it and do not want to buy. Make sure `photo` is live, because a real photo answers "what am I actually getting". Leave the budget alone.
4. **Order clicks are up but "Order checkouts" or "Orders paid" are not.** The drop is in the order form or checkout, and ads cannot fix that. Repeat the phone test order from section 2 and look for what stops you. Leave the ads running.
5. **At least one paid order above baseline.** Change nothing. Let it run.

### Week 3 (about $21)

- Run whatever the checkpoint decided. One change only; do not stack changes.
- **If you were in case 1** and by the end of week 3 the cost per ad visit is still above $1.50: **turn the campaign off and keep the remaining money.** Unspent budget is a better result than another week of the same.
- Otherwise, at the end of the week, pause the weaker of the live ads by cost per link click so week 4 runs on one or two.

### Week 4 (about $21)

- Run the best one or two ads unchanged to the end date.
- On the day after the end date, take the final snapshot and fill this in:

```
Total ad spend (from Ads Manager)                 $____
Ad visits (dashboard, ig- sources, not ig-bio)     ____
Cost per ad visit = spend / ad visits             $____
Designer opens above baseline                      ____
Order clicks above baseline                        ____
Orders paid above baseline                         ____
Exports paid above baseline                        ____
Cost per order = spend / orders paid above baseline   $____
Your margin M                                     $____
```

"Above baseline" is the honest ceiling on what ads produced. Some of those orders may have come from your own posts or search, so the true cost per order from ads is that number or worse.

### Shifting budget

There is only one real lever at this size, which is which ads are live inside ad set A. Do not raise the daily budget in month 1, do not move ad set B's money, and do not add a second country. If you stop early, the money stays in your pocket; it does not need to be spent.

---

## 5. Month 2, by outcome

### Outcome 1: orders came in

Meaning: paid orders ran clearly above baseline while ads were on.

- Work out cost per order and compare it with M.
- **Cost per order at or below M:** run the same campaign again with the same $100. Keep the winning ad, retire the rest, and add one new ad made from a customer's or your own photo of a delivered chain. Do not add a channel or a country yet; repeat the result first.
- **Cost per order above M but under about twice M:** worth one more month, because month 1 included testing waste. Run only the winning ad for the full 28 days and see whether the number improves.
- **Cost per order more than twice M:** treat it as outcome 2.
- This is the point to decide about the Meta pixel. With real orders arriving, purchase tracking would let Meta optimise for buyers instead of clickers. It would also mean rewriting the privacy page and adding a consent step for UK visitors. If you are not ready for that, a smaller step with no privacy change is to have each order record the `utm_source` the visitor arrived with, so the admin page can show orders by source. That is a code change to request separately.

### Outcome 2: clicks but no orders

Meaning: ad visits were reasonable (cost per ad visit under about $1) and orders did not rise.

Stop buying clicks. More traffic into a page that does not convert is the most expensive mistake available. Spend $0 until the following are done, then restart at $50 for two weeks with only the `photo` ad:

- Look at where the dashboard numbers fell off: visits to designer opens, designer opens to order clicks, or order clicks to paid. Fix that step and only that step.
- Put real product photos in front of visitors. The site currently shows 3D renders. A buyer deciding on $25 wants to see the actual object.
- Watch three people who have never seen the site try to order on their own phone, without helping them. Note where they hesitate.
- Check the first screen of the landing page states the price, "free shipping", and "plastic" before any scrolling.
- If `ig-direct` was never tested, test it in the restart.

### Outcome 3: few clicks

Meaning: fewer than about 50 link clicks for the month, or cost per link click above about $1.50 throughout.

The creative is not stopping thumbs; the website has not been tested yet.

- Renders can read as an ad for an app. Shoot new material on a phone: a chain coming off the printer, a hand holding it up to the light, someone putting it on. Keep each clip under 10 seconds with the name readable in the first second.
- Post those as normal Reels first, for free. Whichever gets the most plays and shares becomes the ad.
- Spend at most $30: two new ads at $3 a day for 10 days. If cost per link click is still above $1.50, stop paid ads and put the time into section 6. Paid ads are not obliged to work for every product at every budget.

---

## 6. Free actions that matter more than the ads

At $100 a month, these will very likely move more orders than the campaign. Do the first four before launching.

1. **Photograph and film real chains.** Daylight, a hand or a neck for scale, the name sharp. These are your best ads, your best posts, and the proof the renders cannot give.
2. **Tag every link you share** so the dashboard separates sources: `?utm_source=ig-bio` for the bio, `ig-story` for story link stickers, and a short name for anywhere else (`reddit`, `facebook`, `email`). Lowercase, 20 characters or fewer.
3. **Post the turntable clips and photos as Reels** two or three times a week. Organic Reels reach people who do not follow you, at no cost, and show you which design people react to before you pay to promote it.
4. **Ask every buyer for a photo.** One line in your shipping email or a card in the parcel. Repost with permission. Do not write or invent reviews; show real ones when they exist.
5. **Sell sets in person.** The buy-3-get-1-free offer fits local sports teams, bridal parties, school groups and gaming clubs. Design a sample in their colours, use the Share button, and send the link to the organiser. One yes is four chains.
6. **Go where printer owners already are.** Share a finished multi-colour print and how the 3MF colour parts worked in 3D printing communities, following each community's rules on self-promotion. For the $2 file this reaches the right people at no cost, which paid ads cannot do profitably.
7. **Submit the sitemap** (`https://hypechain.c23d.shop/sitemap.xml`) in Google Search Console and Bing Webmaster Tools. The three search landing pages exist to bring in free search visits, and they only work once indexed.
8. **Reply to every comment and DM the same day,** and answer "is it real gold?" plainly: no, it is 3D printed plastic with a gold-tone finish, which is why it is $25.
9. **Send a free chain to two or three small creators** whose audience fits (streetwear, a local team, a streamer), with their own tagged link. This costs product, not ad budget, and their post is real footage you can ask to reuse.

---

## Checked

Checked by web search on 20 November 2026. Meta's own policy site (`transparency.meta.com`) could not be opened from the environment this was written in, so Meta's rules below come from search-result summaries of Meta's pages and from third-party guides, not from reading the pages directly. Re-check anything marked "not confirmed" in Ads Manager itself, which is the final authority.

### Verified (to the level stated)

| Point | What was found | Source |
|---|---|---|
| Campaign objective names | Six objectives: Awareness, Traffic, Engagement, Leads, App promotion, Sales. Consistent across several 2026 guides. Objective cannot be changed after creation. | [Influee](https://influee.co/blog/meta-campaign-objectives), [Enrich Labs](https://www.enrichlabs.ai/blog/meta-ads-campaign-objectives-explained), [Buffer](https://buffer.com/library/facebook-ads-guide/amp/) |
| Sales campaigns depend on purchase tracking | Stated in third-party guides; consistent with how the pixel works. | [Influee](https://influee.co/blog/meta-campaign-objectives), [feature.fm help](https://help.feature.fm/articles/26317639038349-Meta-Ads-Conversion-Campaigns) |
| Link clicks do not need a pixel | Stated by Jon Loomer and others. | [Jon Loomer](https://www.jonloomer.com/qvt/landing-page-views-no-longer-require-a-pixel/) |
| Ad text lengths | Primary text: about 125 characters shown before truncation, with a much larger hard maximum. Headline: 40 in most guides, 27 in some. Description: 30 in some guides, 25 in others, and sometimes not shown. Reels show less. The ads above use the lowest of these (125 / 27 / 25). | [Sendible](https://www.sendible.com/insights/instagram-character-limit), [Lettercounter](https://lettercounter.org/blog/facebook-instagram-ads-character-limits/), [Strike Social](https://strikesocial.com/blog/meta-ad-specs/), [Sprout Social](https://sproutsocial.com/insights/instagram-ad-sizes/) |
| Personalised-product wording | Meta's Personal Attributes policy bars ads that assert or imply the viewer's personal attributes, including implying the advertiser knows their name. Meta's own allowed example is of the form "We print customizable t-shirts and stickers with your name"; its not-allowed example addresses a named person. | [Meta: Privacy violations and personal attributes](https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/) (via search summary), [Social Media Examiner](https://www.socialmediaexaminer.com/?p=241806) |
| Boost vs Ads Manager | Boost offers a small set of goals and fewer controls; Ads Manager can also promote an existing post. | [Hootsuite](https://blog.hootsuite.com/boosted-posts-vs-ad/), [Metricool](https://metricool.com/boost-instagram-posts/) |
| Meta cost ranges (rough) | Cost per click from about $0.29 (Madgicx median, all campaigns) through $0.60 to $0.78 (WordStream/LocaliQ and ContentStudio, traffic campaigns) to about $1.11 (an ecommerce traffic median). Ecommerce cost per 1,000 impressions around $14 to $15. Vendors use different data and definitions; these are context, not predictions. | [Coupler](https://blog.coupler.io/facebook-ads-statistics/), [ContentStudio](https://contentstudio.io/blog/meta-ads-benchmarks), [Madgicx](https://madgicx.com/research/meta-ads-benchmarks), [Triple Whale](https://triplewhale.com/blog/facebook-ads-benchmarks) |
| Google Search cost (rough) | Median search cost per click of about $4.44 for "Apparel, Fashion & Jewelry", US, April 2025 to March 2026. One vendor's accounts; Google publishes no such table. | [WordStream 2026 benchmarks](https://wordstream.com/blog/2026-google-ads-benchmarks) |
| What the site's dashboard records | Read from the code in this repo (`api/orders.js`, `api/pages.js`, `src/main.js`, `views/admin.html`): which pages count visits, the `utm_source` format rule, that orders carry no source, and that `utm_campaign` is not read. | This repository |

### Not confirmed

- **Minimum daily budget.** Sources conflict. Several say $1 a day for impression-based ad sets. For click-based ad sets some say $1 and several say $5. Meta's developer documentation confirms minimums exist per optimisation type and vary by account and currency but lists no dollar figures. The plan uses $3 and $2 a day with a $5-a-day fallback; Ads Manager will tell you immediately if a number is too low. Sources: [Meta developer docs: minimum budgets](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/minimum_budgets), [Stackmatix](https://www.stackmatix.com/blog/how-much-to-run-ads-on-facebook), [Flighted](https://www.flighted.co/blog/how-to-determine-your-starting-meta-ads-budget), [Cropink](https://cropink.com/minimum-budget-for-facebook-ads).
- **Landing page views without a pixel.** One source reports Ads Manager now says this goal works without a pixel; older sources say it needs one. Not confirmed on Meta's pages, so the plan uses link clicks.
- **A policy on "see it before you buy" style claims.** No specific Meta rule on this wording was found. The general expectation that ad claims be true still applies, and the claim is true here (the designer and Share link are free), but Meta's misleading-claims wording was not read directly.
- **Exact current Ads Manager labels and screens**, including the Account spending limit location, the wording of the manual-placement and "original audience options" switches, the list of call-to-action buttons offered for Traffic campaigns ("Shop now", "Learn more"), and the names of the Advantage+ creative toggles. These are from prior knowledge and change often.
- **Interest names** (Streetwear, Hip hop fashion, Necklace, Personalized gifts, 3D printing). Meta adds and removes interests; pick the nearest match offered.
- **UK consent requirement for the Meta pixel.** Stated from general knowledge of UK cookie rules, not checked on the day and not legal advice.
- **Seasonal ad prices.** It is widely said that Meta ads cost more from late November through December. Not checked. If month 1 runs through that period, expect the higher end of any range and do not read a poor cost per click as proof the ads are bad.
- **Asset files.** The `marketing/assets/instagram/` folder and the turntable clips were not present in the checkout this was written from, so file names follow the stated pattern (`<slug>-portrait.jpg`, `<slug>-square.jpg`) and image dimensions were not checked against Instagram's placement sizes.
- **Whether the site is already live on `hypechain.c23d.shop`.** The repo backlog lists the domain move as outstanding.
