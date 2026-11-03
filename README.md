# ReturnWindow

Snap a receipt and see exactly when you can still return each item. ReturnWindow
reads the receipt on your phone and applies the store's return policy. That
includes category exceptions, member perks and 2026 holiday extensions. It also
tracks warranties and drafts the claim email when something breaks.

**Live app:** https://datawithdon.github.io/returnwindow/

It's a static web app with no account and no server. Your purchases and receipt
photos stay in your browser.

## Features

- **Receipt scanning on the device.** Tesseract.js runs on your phone and picks
  out the store, date, total, order number, a printed "return by" date and item
  lines. Paper receipts and screenshots of order confirmations both work.
- **Optional Claude vision.** For faded or crumpled receipts, you can send the
  photo to Claude with your own API key. It can run automatically when the
  on-device result looks weak.
- **Policies for 25 US retailers:** Amazon, Walmart, Target, Costco, Best Buy,
  Apple, The Home Depot, Lowe's, IKEA, Kohl's, Macy's, Nordstrom, REI, Sam's
  Club, DICK'S, Ulta, Sephora, Old Navy, Gap, T.J. Maxx, Wayfair, Staples,
  Nike, lululemon and Newegg.
  - Category windows, e.g. Target's 14 days for Apple products, Walmart's 30
    for electronics, or Home Depot's 48 hours for major appliances.
  - Member and store-card windows, e.g. Best Buy Plus/Total, Target Circle
    Card, REI Co-op, Gap Encore.
  - 2026 holiday extensions (Target, Best Buy, Macy's, Ulta, Sephora).
  - Delivery-date clocks for online orders.
  - Each item's category is guessed from its name on the receipt.
  - You can add your own stores with a custom window.
- **Timeline** of what's returnable now, what closes soon, warranties, all
  purchases, and items you've returned or kept.
- **Reminders.** A notification appears when a window is closing (lead time is
  set in Settings), and the app icon shows a badge where the phone supports it.
- **Price drops.** Log a lower price you've seen and ReturnWindow shows how
  much you'd save by returning and rebuying, or by asking for a price
  adjustment, before the deadline.
- **Claim kit.** A return checklist and a pre-filled warranty email, with copy,
  `mailto:` and share-with-receipt buttons.
- **Backup and restore** as JSON, optionally including receipt photos. Works
  offline as an installable PWA.

## Where the policy data comes from

Every window in [`js/retailers.js`](js/retailers.js) was checked on 2026-11-02
on the retailer's own website, and each entry links its source. Entries are
marked by how they were checked:

- `page`: the policy page itself was read (Target, Costco, Best Buy, Apple,
  Ulta, Nordstrom).
- `search`: the retailer's site blocked automated reading, so the figure comes
  from a search restricted to that retailer's domain.

Nothing is filled in from memory. When sources disagreed or were old, the
**shorter** window was kept and a note explains why. A deadline shown too early
costs you nothing; one shown too late costs a refund. Holiday extensions are
applied only where the 2026 dates were confirmed.

Policies change and stores make exceptions, so check the store before a
close call.

## Reminders on a static site

There's no server to send push notifications. Instead, reminders fire when you
open the app, when it comes back to the foreground, and hourly while it's open.
Each item is announced once at each threshold: your lead time, 1 day left and
the last day. On iPhone, notifications need the app added to the Home Screen.

## Run locally

```sh
npm start        # serves on http://127.0.0.1:8000
npm test         # node --test, no dependencies
```

Camera capture and the service worker need HTTPS or `localhost`.

## Project layout

| Path | What |
|---|---|
| `js/retailers.js` | Sourced return policies (data) |
| `js/policy.js` | Deadline engine: categories, members, holiday rules, warranties |
| `js/parse.js` | Receipt text → store, date, total, items |
| `js/ocr.js`, `js/ai.js` | Tesseract.js reader, optional Claude vision reader |
| `js/store.js`, `js/photos.js` | localStorage state with sanitising, IndexedDB photos |
| `js/notify.js`, `js/claims.js` | Reminders, return checklist / warranty email text |
| `js/views/` | Timeline, add/edit, purchase, stores, settings |
| `vendor/tesseract/` | Vendored OCR engine and English model |

See [SECURITY.md](SECURITY.md) for the privacy and hardening details.

## License

MIT. Not affiliated with any retailer. Store names are trademarks of their owners.
