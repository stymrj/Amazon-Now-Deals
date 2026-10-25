# PriceDrop Hunter for Amazon Now

Scans Amazon Now by category and keyword, ranks products by real savings, and tracks price changes between scans. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Amazon-Now-Deals/

## Features

- Ranks by percent off and rupees saved together
- Labels products that are new or cheaper than your last scan
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV export and copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser

## Install

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the button to your bookmarks bar. Open amazon.in and click the bookmark.

**Bookmarklet (mobile).** Copy the code from the page, create a bookmark, and paste the code as its address. Run it from the address bar on amazon.in.

**Userscript.** Install `dist/amazon-now-deals.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every amazon.in page.

**Demo.** Use "Try the demo" on the install page to explore the interface with sample data.

## Keyboard shortcuts

`/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. In Hunter's sidebar, open **Telegram alerts**, paste the token and chat ID, press **Send test message**, then switch alerts on.
5. Optional: set **Auto-scan** (for example every 15 minutes) and keep the tab open.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## How it gets data

Uses the `tez/browse` JSON endpoints that the Amazon Now pages use, from your logged-in session. The brand ID is detected from the page or entered in the sidebar.

## Limitations

- Only three browse node IDs are bundled (Atta & Flours, Rice & Grains, Ice Cream); everything else uses keyword search.
- Keyword search uses the `searchByKeyword` endpoint, which is not verified in every region.
- Stock status is not exposed, so every product is treated as available.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
favicon.svg
```

Run `node build.js` after any change.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
