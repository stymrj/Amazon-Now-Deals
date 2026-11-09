# PriceDrop Hunter for Amazon Now — v2

Scans the Amazon Now categories and keywords you pick and shows the biggest discounts, then the best deals of each group. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Amazon-Now-Deals/

## What's new in v2 (2026-11-08)

- **Full catalogue:** 12 browse groups, 98 subcategories (Grocery & Staples, Dairy, Bread & Eggs, Snacks, Sweets & Treats, Beverages & Drinks, Ice Creams & Frozen, Personal Care & Beauty, Oral Care & Health, Home Care & Cleaning, Kitchen & Home, Fresh Produce & Meat, Baby Care, Paan Corner) plus 7 keyword groups — up from 3 browse aisles. Only the Ice Cream Store node uses the `merch` endpoint; the rest use `category`.
- **Blank-results fix:** a scan that fetches nothing now says why instead of showing an empty grid — signed out / no Brand ID, robot check, Amazon 503 rush-hour page, or rate limit. The empty state shows how many products the last scan fetched and the exact fetch problem.
- **Second fetch shape:** when the `tez/browse` JSON endpoint returns nothing for a keyword, the scan retries once against the Amazon Now global search page (`/s?i=amazontez`) and parses its product cards (relaxed `div[data-asin]` selector, sponsored cards skipped).
- **Better Brand ID detection:** session storage, URL params, page links carrying `brandId`/`qcbrand`/`almBrandId`, `a-state` scripts, and page HTML — so the scan works without pasting the ID by hand.
- **Smarter paging:** reads `data.metadata.hasMoreWidgets` / `nextOffset` from `tez/browse` instead of guessing, scans 2 pages per category by default (up to 5 in the picker), and follows up to 5 pages of results (offset 0–50).
- **Highest-discount fix:** the parser now reads every price shape the API sends — MRP as a string (`"₹999"`) or plain number, prices keyed `value` / `max` / `text` instead of only `amount`, and savings percents as strings, floats or 0–1 fractions. Before, those items parsed to 0% off (or dropped entirely) and the 30% minimum-discount filter hid them, so the deepest discounts never appeared. The same fix is in the Telegram bot path. Covered by `fixtures/sample-high-discount.json` and section 7 of `node test-results-tab.js`.
- **In-browser self-test:** a Self-test button in the sidebar runs the parser, the `/s` fallback and the error messages over built-in fixtures and reports pass/fail. Same checks run in `node test-results-tab.js`.
- **JSON export** alongside CSV; CSV building is now a shared helper covered by the test.
- **Bot:** `bot/platform.js` now reports paging from `data.metadata` (page size corrected to 10) and `bot/config.json` adds Dairy, Snacks, Beverages and Home Care groups. Audit helpers in `scripts/` (`audit-category-pages.js`, `audit-bracket-pages.js`) check per-category item counts and 70%-off deals per price bracket.
- **Bookmark name fixed:** the install button now reads **Amazon Now Deals** instead of the generic “PriceDrop Hunter”, so the bookmark you drag to your bookmarks bar is named after this store.

## Why v2 is stronger

The browser tool already had what a plain deal list doesn't, and v2 keeps all of it: price history with a sparkline on every product you've seen, lowest-ever and price-drop labels, saved-item tracking with per-item drop alerts, a cross-category best-deals row, unit price (per kg / litre / piece) with a value sort, one-tap presets, a shopping list with totals, CSV/JSON export, and light/dark themes. On top of that, v2 adds the reliability layer a deal finder needs most: two fetch shapes with a fallback, retries with backoff on 429/503, real paging signals instead of guessed offsets, and diagnostics that name the cause of zero results. The Telegram bot dedupes by product and keeps a 30-day price history (`data/state.json`), so it sends new deals and price drops — not the same list every run. It cannot report restocks: Amazon exposes no stock status, so every product is treated as available.

## Features

- Asks which categories to scan, then shows the biggest discounts first
- Best deals of each category in one swipeable row, with See all
- Ranks by percent off and rupees saved together
- Labels products that are new, cheaper than last time, or at their lowest price ever
- Price history sparkline on every product you have seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever, best value
- A setup checklist on first open, plus a scan-status line when a scan fetched nothing
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV and JSON export, copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser

## Install

![Install walkthrough](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.gif)

[Watch the walkthrough video (MP4)](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.mp4)

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the **Amazon Now Deals** button to your bookmarks bar. Open amazon.in and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**. It is a bookmark of about 380 characters that loads the latest version from GitHub Pages, so it fits on any phone. Create a bookmark named **Amazon Now Deals**, paste it as the address, and run it from the address bar on amazon.in. The full bookmarklet (about 65 KB, no network needed) is in `dist/bookmarklet.txt`.

**Userscript.** Install `dist/amazon-now-deals.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every amazon.in page.

## Use

Pick categories in the picker, press Scan, and watch deals arrive — up to 4 categories fetch in parallel with a progress bar. Items are deduped across pages and categories. Press **Self-test** in the sidebar any time to check the parser without scanning.

Keyboard shortcuts: `/` search, `S` scan or stop, `Esc` close.

## Telegram alerts (browser)

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. On the store, open Hunter, press **Telegram** in the top bar, paste the token and chat ID, press **Send test**, then switch alerts on.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## Telegram bot (GitHub Actions)

Hunter can also run on its own, without a browser, on GitHub Actions. Every 30 minutes between 08:31 and 00:01 IST (03:01–18:31 UTC) it scans Amazon Now, compares with the previous run (kept in `data/state.json`), and sends what changed to Telegram: a morning catalogue, new deals, and price drops. Identical prices are not re-sent.

1. Fork [github.com/stymrj/Amazon-Now-Deals](https://github.com/stymrj/Amazon-Now-Deals).
2. Create a bot with `@BotFather` (`TELEGRAM_BOT_TOKEN`) and get your chat ID from `@userinfobot` (`TELEGRAM_CHAT_ID`).
3. On amazon.in/tez/browse/home while logged in, copy the Cookie header from DevTools → Network (`AMAZON_COOKIE`) and the `brandId` from a `tez/browse` request URL (`AMAZON_BRAND_ID`). Hunter's sidebar also has a Brand ID field — it auto-detects the ID for scans, or paste the ID there to save it.
4. In your fork, add those four as **Secrets**, and set the **Variable** `BOT_ENABLED` = `true`.
5. In **Actions**, enable workflows, run **Telegram deal alerts** with **Print the messages instead of sending them** ticked to preview, then run it again for real.

Optional variables: `MIN_DISCOUNT`, `THRESHOLDS` (e.g. `staples=55,icecream=55`), `GROUPS`, `PAGES` (1–5), `DIGEST_HOUR_IST`, `MAX_WORKERS` (default 3), `MAX_ALERTS` (default 40), `RUNNER` (`self-hosted` if GitHub's IPs get blocked). Groups and thresholds live in `bot/config.json`.

Local run: `cp .env.example .env`, then `node bot/run.js --dry-run` (prints, sends nothing) or `node bot/run.js`. Node 18+, no `npm install` needed.

A session cookie works like your password for that site. Keep it only in GitHub **Secrets** or your local `.env` (already in `.gitignore`), never in a commit or an issue. If one ever leaks, log out of all devices on Amazon to cancel it. Cookies expire; when the bot reports that Amazon refused the session, copy a fresh one.

## How it gets data

Uses the `tez/browse` JSON endpoints the Amazon Now pages use (`category` / `merch` / `searchByKeyword`, with your Brand ID and session), from your signed-in tab — plus the `/s?i=amazontez` search page as a fallback when the JSON endpoint returns nothing for a keyword. Requests retry with backoff on HTTP 429/503.

## Troubleshooting

- **Blank results / "0 products":** read the message under the checklist — it names the cause. Sign in to Amazon, open amazon.in/tez/browse/home so your Amazon Now address and Brand ID are set, then scan again.
- **Robot check / 503:** Amazon showed a check or a rush-hour error page. Open amazon.in normally, complete any check, wait a few minutes, and retry. This is Amazon throttling, not an empty deal list.
- **Only some categories empty:** that aisle may genuinely have no deals at your minimum discount — lower it, or pick fewer categories for a faster scan (98 aisles × 2 pages takes a while).
- **Telegram test fails in the bookmarklet:** install the userscript; some shops block bookmarklets from calling Telegram.
- **Bot run fails with `Missing settings: …`:** the named secret is not set in your fork — add it under Settings → Secrets and variables → Actions.
- **Bot run exits 1, `TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set`:** set both secrets; a scheduled run with `BOT_ENABLED=true` but no Telegram credentials is a failed run, not a quiet skip.
- **Bot reports `Amazon refused the session (HTTP 401/403)` or `returned a web page instead of data (signed out or a robot check)`:** the session cookie expired or Amazon challenged it — copy a fresh `AMAZON_COOKIE` from a logged-in tab.
- **Scheduled runs do nothing:** set the repository **Variable** `BOT_ENABLED` to `true` — the schedule is gated on it. Manual runs from Actions always run.

## Testing

```bash
node --check src/deals.js bot/platform.js bot/core.js   # syntax
node test-results-tab.js                                # 36 checks: 70-item fixture -> 70 cards, /s fallback, retries, diagnostics, CSV, unit price
node test/bot-platform.test.js                          # 13 checks: bot fetch layer with stubbed fetch
node build.js                                           # rebuilds dist/ and index.html
```

The browser tests use fixtures, not the live site: the parser, fallback, cutoff and error paths are verified offline. Live Amazon Now endpoints still need a manual browser test — sign in, scan a keyword, and confirm cards appear.

## Limitations

- You must be signed in to Amazon with an Amazon Now address; otherwise Amazon returns no data and Hunter tells you so.
- Stock status is not exposed, so every product is treated as available.
- The endpoints are undocumented and can change.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
scripts/             category + price-bracket audit helpers (run on amazon.in)
fixtures/            sample tez payload used by the regression test
test/                bot platform test (stubbed fetch)
bot/                 Telegram bot: run.js, core.js, platform.js, config.json
.github/workflows/   telegram-bot.yml (every 30 min, 08:31–00:01 IST)
.env.example         settings for local runs
build.js             builds dist/ and index.html
```

Run `node build.js` after any change.

## License

MIT — see `LICENSE`. The fetch layer adapts MIT-licensed code; the original copyright notice is preserved in `LICENSE`.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
