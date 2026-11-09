# Changelog

## v2.0.0 — 2026-11-08
- Fixed (2026-11-09): install button now reads “Amazon Now Deals” instead of the generic “PriceDrop Hunter”, so the dragged bookmark is named after this store instead of colliding with every other tool.
- Fixed (2026-11-09): highest-discount items are fetched again — the parser now reads MRP as a string (`"₹999"`) or plain number, prices keyed `value` / `max` / `text` instead of only `amount`, and savings percents as strings, floats or 0–1 fractions. Those shapes used to parse to 0% off (or drop the item entirely), so the 30% minimum-discount filter hid genuine 85–95% off deals. Same fix in the Telegram bot path (`bot/core.js` price, `bot/platform.js` normalise); covered by `fixtures/sample-high-discount.json`, section 7 of `test-results-tab.js`, and `test/bot-platform.test.js`.
- Fixed (2026-11-09): Telegram bot wiring — the bot now exits 1 (was a silent 0) when `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are missing on a real run, so a misconfigured scheduled run fails visibly; the bot page cap is raised 30 → 50 so `PAGES` 1–5 works as documented (was silently capped at 3 pages); the workflow now passes optional `MAX_WORKERS` / `MAX_ALERTS` (defaults 3 / 40) and the schedule is documented as 03:01–18:31 UTC = 08:31–00:01 IST.
- Fixed (2026-11-09): wrong info corrected — the README no longer claims the bot sends back-in-stock alerts (Amazon exposes no stock status; every product is treated as available); the install page drag step now names the “Amazon Now Deals” button (was still “PriceDrop Hunter”), the mobile bookmark is named “Amazon Now Deals” (was “PriceDrop”), the stats band reads 132 subcategories & keywords (was “35+”), the Telegram step says “Send test” (the real button label), and the group names match the catalogue exactly. The Testing section now states the real check counts (36 results-tab, 13 bot-platform).

- Full catalogue: 12 browse groups / 98 subcategories (was 3 aisles) plus 7 keyword groups; only the Ice Cream Store node uses the `merch` endpoint.
- Blank-results fix: empty scans now report the cause (no Brand ID, signed out, robot check, Amazon 503, rate limit) with a fetched-count status line, instead of an empty grid.
- Second fetch shape: keyword searches fall back to the `/s?i=amazontez` search page and parse its cards (relaxed `div[data-asin]` selector, sponsored cards skipped) when `tez/browse` returns nothing.
- Brand ID detection: page links, `a-state` scripts and page HTML, in addition to session storage and URL params.
- Paging from `data.metadata.hasMoreWidgets` / `nextOffset`; default depth 2 pages per category (max 5); offset cap raised 30 → 50.
- In-browser Self-test button (parser, `/s` fallback, error messages, paging) — same checks as `node test-results-tab.js`.
- JSON export alongside CSV; `test-results-tab.js` regression test (70-item fixture → 70 cards) and `test/bot-platform.test.js` (bot fetch layer).
- Bot: paging from `data.metadata`, page size corrected to 10, Dairy / Snacks / Beverages / Home Care groups added to `bot/config.json`.
- Added `scripts/` audit helpers: per-category item counts and 70%-off deals per price bracket.
