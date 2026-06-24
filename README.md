
<img width="500" height="500" alt="logo" src="https://github.com/user-attachments/assets/79a6c2d7-6393-4702-88fb-d385aa14c2b8" />
devpick.fun

Pick your devs. Watch their launches the moment they hit the chain.

devpick.fun is a real-time dashboard for pump.fun on Solana. You choose the developer wallets you care about, and the moment one of them launches a token, it appears on your screen with live data streaming in — market cap, buys, sells, and migration status — straight from the chain.

No accounts. No backend. No database. It's a static site that talks directly to a live WebSocket feed, so you can host it anywhere and it just works.


What it does

You follow devs. Their launches surface for you in real time.

That's the whole idea. The crypto launchpad space is noisy — thousands of tokens launch every day and almost all of them are worthless. The signal isn't the token, it's the person behind it. A dev with a track record of building real things is worth watching. devpick.fun lets you keep a roster of those people and never miss when they ship.

The dashboard is split into three live panels:


New Launches — the full firehose of every new token hitting pump.fun, so you can see the whole market move.
Launches by followed devs — filtered down to only the wallets you follow. This is your signal.
Followed Devs — a per-dev scoreboard: how many tokens they've launched, how many migrated, and their best all-time-high market cap.


As trades come in, cards update live. When a token's bonding curve completes and it migrates to PumpSwap, the dashboard reflects it.


How it works

devpick.fun connects to the PumpDev WebSocket API (wss://pumpdev.io/ws) — a free, open, real-time feed of pump.fun and PumpSwap on-chain activity. There's no API key and no auth; it's a one-directional data stream coming to your browser.

The app uses three subscriptions:

SubscriptionPurposesubscribeNewTokenThe firehose of all new launches. Creates are filtered client-side by followed dev.subscribeAccountTradeTrading activity from the specific dev wallets you follow.subscribeTokenTradeLive market-cap / buy / sell updates for tokens already being tracked.

When a followed dev launches a token, it's caught via subscribeNewToken, added to your tracked list, and the app subscribes to its trades so the numbers tick live. When the bonding curve completes (txType: "complete"), the token is marked migrated.

Everything is stored in your browser via localStorage — your followed devs, your tracked tokens, your settings. Nothing leaves your machine.


Note on "live-only": because the feed is a real-time stream, the dashboard catches launches and trades from the moment the page is open. It does not back-fill a dev's full historical launches — for that you'd need an indexer or database. Past projects can be recorded manually per-dev (see below).




Features


Real-time launch detection — followed devs' tokens appear the instant they're created on-chain.
Live trade data — market cap, buy/sell counts, and volume update as trades happen.
Migration tracking — tokens are flagged when their bonding curve completes and they migrate to PumpSwap.
Per-dev scoreboard — launches, migrations, and best ATH for every dev you follow.
Dev management — add devs by wallet address, attach notes, and record their past projects (name, symbol, ATH, chart link).
Show-all toggle — flip between the full market firehose and your followed devs only.
Chart links — jump straight to Axiom or Photon for any token.
Import / export — back up and share your full setup (devs, tokens, filters) as JSON.
Filters — narrow each panel by token age and market cap.
No backend — pure static HTML / CSS / JS. Host it on GitHub Pages, Vercel, Netlify, or any static host.



Project structure

devpick.fun/
├── index.html          Dashboard — the three live panels
├── manage-devs.html    Add / edit / remove followed devs
├── logo.png            Header logo + favicon
├── css/
│   ├── base.css        Theme variables, fonts, global styles
│   ├── layout.css      Header, panels, grid, footer
│   ├── components.css   Cards, buttons, inputs, dev summaries
│   └── utilities.css    Helpers, debug console, responsive rules
└── js/
    ├── config.js       Configuration + the pinned launch slot
    ├── websocket.js     PumpDev connection + message handling
    ├── devManager.js    Adding, editing, storing followed devs
    ├── tokenTracker.js  Tracking tokens, filtering, persistence
    ├── ui.js           DOM rendering, cards, dev scoreboard
    └── utils.js        Formatters, clipboard, init


Running it

It's a static site, so there's nothing to build or install.

Locally: open index.html in a browser. (Some browsers restrict file:// WebSocket connections — if so, serve it with a one-liner:)

bashpython3 -m http.server 8000
# then visit http://localhost:8000

Hosting: drop the folder on any static host — GitHub Pages, Vercel, Netlify, Cloudflare Pages, or a plain web server.


Configuration

Most of the app is controlled from the UI, but a couple of things live in js/config.js.

The pinned launch

config.js has a PINNED_LAUNCH block. This is for when you launch your own token and want it to show on the dashboard for every visitor — even those who arrive after the launch and weren't watching live.

jsconst PINNED_LAUNCH = {
    mint: 'xxxxxxpump',      // paste your real CA here at launch
    devWallet: 'YOUR_WALLET', // your creator wallet
    devName: 'August',        // label shown on the card
    name: 'devpick.fun',      // token name
    symbol: 'DPICK'           // token symbol (no $)
};

The pinned card sits in the Launches by followed devs panel by default. Before launch it shows with placeholder data; the moment you paste your real contract address into mint and reload, that same card keys to the live mint and starts filling with market-cap, buy, and sell data as trades arrive.

SOL price

SOL price is currently hardcoded (used to convert market caps from SOL into USD). Adjust it in js/websocket.js if needed.


Adding devs

Open Manage Devs from the header. For each dev you can set:


Name — a label for the dev.
Wallet address — their Solana creator wallet (this is what gets subscribed to).
Notes — free-text context ("pays for Dex updates, migrates slowly", etc.).
Past projects — record their history: name, symbol, ATH, and a chart link or CA. These feed the dev's launch count and best-ATH stat even though they happened before you started watching.


Devs are saved to localStorage and can be exported / imported as JSON to back up or share a roster.


A note on safety

The WebSocket feed is read-only. devpick.fun never asks for a private key, seed phrase, or wallet connection, and it has no field to enter one. It cannot move funds or sign transactions — it only receives public on-chain data and displays it.

PumpDev is an independent third-party indexer, not pump.fun itself. Treat its data as informational. Don't wire this into anything that auto-buys, and always do your own research before trading.


Disclaimer

devpick.fun is a tool for monitoring public on-chain activity. It is not financial advice. Memecoins are extremely high-risk and most lose all their value. Nothing here is a recommendation to buy, sell, or hold anything. Trade responsibly and only with what you can afford to lose.


Links


Site: devpick.fun
X: @augustsolq
Data feed: PumpDev
