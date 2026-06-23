// ============================================
// Configuration & Constants
// ============================================

// ─────────────────────────────────────────────────────────────
// PINNED LAUNCH — fill this in AT LAUNCH so the token tracks for
// everyone who loads the page, even if they weren't watching live.
//
//   1. Launch your token.
//   2. Paste the mint/CA into `mint` below.
//   3. (name/symbol are optional — they fill in from the feed,
//       but setting them makes the card readable before the first trade.)
//   4. Re-upload config.js.
//
// Leave `mint` empty ('') to disable. `devWallet` should be your
// own creator wallet (also add it as a followed dev so stats count it).
// ─────────────────────────────────────────────────────────────
const PINNED_LAUNCH = {
    mint: 'xxxpump',  // placeholder — paste your real CA here at launch
    devWallet: 'YOUR_DEV_WALLET_HERE',  // your creator wallet (August's card uses this)
    devName: 'August',   // label shown on the card
    name: 'devpick.fun', // token name
    symbol: 'DPICK'      // token symbol (no $)
};

const CONFIG = {
    PUMPPORTAL_WS: 'wss://pumpdev.io/ws', // PumpDev WebSocket endpoint
    POLL_INTERVAL: 5000,
    SYNC_RETRY_DELAY: 3000,
    DEBUG: true,
    COINGECKO_API: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    SOL_PRICE_REFRESH: 60000, // Refresh SOL price every minute
    CHART_PROVIDERS: {
        axiom: {
            name: 'Axiom',
            url: 'https://axiom.trade/t/'
        },
        photon: {
            name: 'Photon',
            url: 'https://photon-sol.tinyastro.io/en/lp/'
        }
    }
};

// Panel filter defaults
const PANEL_FILTERS = {
    'new-launches': { minAge: 0, maxAge: 5, minMC: 0, maxMC: null },
    'active-tokens': { minAge: 0, maxAge: null, minMC: 0, maxMC: null },
    'graduated': { minAge: 0, maxAge: null, minMC: 69000, maxMC: null }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, PANEL_FILTERS };
}