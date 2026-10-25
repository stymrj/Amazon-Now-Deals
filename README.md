# PriceDrop Hunter for Amazon Now

Scans Amazon Now by category and keyword, ranks products by real savings, and tracks price changes between scans. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Amazon-Now-Deals/

## Features

- Ranks by percent off and rupees saved together
- Labels products that are new, cheaper than last time, or at their lowest price ever
- Price history sparkline on every product you have seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever, best value
- A setup checklist on first open
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV export and copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser

## Install

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the button to your bookmarks bar. Open amazon.in and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**. It is a bookmark of about 380 characters that loads the latest version from GitHub Pages, so it fits on any phone. Create a bookmark, paste it as the address, and run it from the address bar on amazon.in. The full bookmarklet (about 45 KB, no network needed) is in `dist/bookmarklet.txt`.

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

## Telegram bot (GitHub Actions)

Hunter can also run on its own, without a browser, on GitHub Actions. Every 30 minutes it scans Amazon Now, compares with the previous run, and sends what changed to Telegram.

| | Browser tool | Telegram bot |
| :--- | :--- | :--- |
| Runs | In your browser tab | On GitHub Actions (free for public repos) |
| When | When you open it, or auto-scan while the tab is open | Every 30 minutes, 08:31 to 00:01 IST |
| Uses | Your open Amazon Now session | A copy of your session stored as a GitHub secret |
| Alerts | New deals, price drops, saved items | New deals, price drops, back in stock, a morning catalogue |

### What gets sent

- **Morning catalogue:** the first run after 9 AM IST sends every deal above your threshold.
- **New deals:** products seen for the first time that meet the threshold.
- **Price drops:** products that are cheaper than the last run.
- **Back in stock:** qualifying products that were out of stock last run.
- **Nothing else:** identical prices are not re-sent, and if nothing changed the bot stays silent.

### Step 1: Copy the repository

Click **Fork** at the top of [github.com/stymrj/Amazon-Now-Deals](https://github.com/stymrj/Amazon-Now-Deals). Everything below happens in your fork.

### Step 2: Create your Telegram bot

1. In Telegram, open `@BotFather`, send `/newbot`, and follow the prompts. Copy the token it gives you. This is `TELEGRAM_BOT_TOKEN`.
2. Open your new bot and press **Start**.
3. Open `@userinfobot` and press **Start**. Copy the number it shows. This is `TELEGRAM_CHAT_ID`.

To post into a channel instead, add the bot to the channel as an admin and use the channel's `@username` as `TELEGRAM_CHAT_ID`.

### Step 3: Copy your Amazon session and brand ID

1. On a computer, open [amazon.in/tez/browse/home](https://www.amazon.in/tez/browse/home) while logged in, with your address set.
2. Press `F12`, open the **Network** tab, and reload. Click any request to `www.amazon.in`, find **Request Headers → cookie**, and copy the whole value. This is `AMAZON_COOKIE`.
3. In the Network tab, type `tez/browse` in the filter box and click a request. The URL contains `brandId=...`: that value is `AMAZON_BRAND_ID`. Hunter's sidebar also shows it under **Brand ID** when you open it on the Amazon Now page.

Cookies expire after a while. When the bot reports that Amazon refused the session, copy a fresh one.

### Step 4: Add the secrets

In your fork, open **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Required | What it is |
| :--- | :---: | :--- |
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Your chat ID from @userinfobot, or a channel `@username` |
| `AMAZON_COOKIE` | Yes | The Cookie header from a logged-in amazon.in tab on the Amazon Now page. |
| `AMAZON_BRAND_ID` | Yes | Your Amazon Now brand ID (see step 3). |

Then open the **Variables** tab and add `BOT_ENABLED` = `true`. Scheduled runs only start once this is set.

Optional variables:

| Variable | Default | What it does |
| :--- | :--- | :--- |
| `MIN_DISCOUNT` | per group | One threshold for every group, for example `65` |
| `THRESHOLDS` | see `bot/config.json` | Per-group thresholds, for example `staples=55,icecream=55` |
| `GROUPS` | all | Only scan these groups, for example `staples,icecream` |
| `PAGES` | `1` | Pages per aisle, 1 to 5 |
| `DIGEST_HOUR_IST` | `9` | Hour of the morning catalogue; `-1` turns it off |
| `RUNNER` | `ubuntu-latest` | Set to `self-hosted` to run on your own computer |

### Step 5: Enable and test

1. Open the **Actions** tab. GitHub pauses workflows in new forks: click **I understand my workflows, go ahead and enable them**.
2. Choose **Telegram deal alerts** → **Run workflow**, tick **Print the messages instead of sending them**, and run it. Open the run to see what would be sent.
3. Run it again without the tick. Your first alert arrives on Telegram within a minute or two.

From then on it runs every 30 minutes by itself. GitHub sometimes starts scheduled runs late, and it pauses schedules in repositories with no activity for 60 days; re-enable them from the Actions tab if that happens.

### Step 6 (if blocked): run it on your own computer

GitHub's servers share IP addresses that some shops block. A self-hosted runner runs the same workflow on your computer, from your home connection.

1. In your repository: **Settings → Actions → Runners → New self-hosted runner**, choose your OS, and run the commands it shows.
2. In **Settings → Secrets and variables → Actions → Variables**, add `RUNNER` = `self-hosted`.
3. Keep that computer on (and the runner running) during the hours you want alerts.

Node 18 or newer must be installed on that computer.

### Customising

Groups, aisles and default thresholds live in `bot/config.json`:

```json
{ "id": "staples", "name": "Grocery & Staples", "minDiscount": 60, "subs": [["204870009031", "Atta & Flours"]] }
```

Add or remove entries under `subs`, change `minDiscount`, commit, and the next run uses them.

### Run it on your computer

```bash
cp .env.example .env        # fill in the values from steps 2 and 3
node bot/run.js --dry-run   # prints the messages, sends nothing
node bot/run.js             # sends to Telegram and remembers this run in data/state.json
```

Node 18 or newer, no `npm install` needed.

### Keep your session safe

A session cookie works like your password for that site. Keep it only in GitHub **Secrets** or your local `.env` (already in `.gitignore`), never in a commit or an issue. GitHub hides secrets in run logs. If one ever leaks, log out of all devices on Amazon Now to cancel it.

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
bot/                 Telegram bot: run.js, core.js, platform.js, config.json
.github/workflows/   telegram-bot.yml (every 30 minutes)
.env.example         settings for local runs
build.js             builds dist/ and index.html
favicon.svg
```

Run `node build.js` after any change.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
