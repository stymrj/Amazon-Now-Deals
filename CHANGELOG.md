# Changelog

## v2.0.0 — 2026-11-08

- Full catalogue: 12 browse groups / 98 subcategories (was 3 aisles) plus 7 keyword groups; only the Ice Cream Store node uses the `merch` endpoint.
- Blank-results fix: empty scans now report the cause (no Brand ID, signed out, robot check, Amazon 503, rate limit) with a fetched-count status line, instead of an empty grid.
- Second fetch shape: keyword searches fall back to the `/s?i=amazontez` search page and parse its cards (relaxed `div[data-asin]` selector, sponsored cards skipped) when `tez/browse` returns nothing.
- Brand ID detection: page links, `a-state` scripts and page HTML, in addition to session storage and URL params.
- Paging from `data.metadata.hasMoreWidgets` / `nextOffset`; default depth 2 pages per category (max 5); offset cap raised 30 → 50.
- In-browser Self-test button (parser, `/s` fallback, error messages, paging) — same checks as `node test-results-tab.js`.
- JSON export alongside CSV; `test-results-tab.js` regression test (70-item fixture → 70 cards) and `test/bot-platform.test.js` (bot fetch layer).
- Bot: paging from `data.metadata`, page size corrected to 10, Dairy / Snacks / Beverages / Home Care groups added to `bot/config.json`.
- Added `scripts/` audit helpers: per-category item counts and 70%-off deals per price bracket.
