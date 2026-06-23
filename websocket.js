// ============================================
// WebSocket & API Connections
// ============================================

let wsClient = null;
let SOL_PRICE_USD = 69; // Hardcoded SOL price
let showAllLaunches = true; // Default ON — New Launches shows all launches

// ============================================
// SOL Price Management
// ============================================
async function fetchSolPrice() {
    // SOL price is hardcoded to 75 — skip the live fetch.
    debug(`Using hardcoded SOL price: $${SOL_PRICE_USD}`, 'info');
    return;
}

// ============================================
// WebSocket Connection
// ============================================
function connectWebSocket() {
    try {
        debug('Connecting to PumpDev WebSocket...', 'info');
        updateStatus('connecting');
        
        wsClient = new WebSocket(CONFIG.PUMPPORTAL_WS);
        
        wsClient.onopen = () => {
            debug('Connected to PumpDev WebSocket!', 'success');
            updateStatus('connected');

            // Subscribe to new token launches (firehose) — we filter creates by followed dev
            wsClient.send(JSON.stringify({ method: 'subscribeNewToken' }));
            debug('📡 Subscribed to new token launches', 'success');

            // Subscribe to all followed devs
            if (followedDevs.length > 0) {
                const accounts = followedDevs.map(dev => dev.address);
                const subscription = {
                    method: 'subscribeAccountTrade',
                    keys: accounts
                };
                console.log('📡 Subscribing to developer wallets:', subscription);
                wsClient.send(JSON.stringify(subscription));
                debug(`📡 Subscribed to ${accounts.length} developer wallets`, 'success');
            } else {
                console.log('⚠️ No devs to subscribe to yet');
            }
            
            // Subscribe to token trades (for already tracked tokens)
            const tokenMints = Array.from(trackedTokens.keys());
            if (tokenMints.length > 0) {
                const tokenSub = {
                    method: 'subscribeTokenTrade',
                    keys: tokenMints
                };
                console.log('📡 Subscribing to token trades:', tokenSub);
                console.log('Token mints:', tokenMints);
                wsClient.send(JSON.stringify(tokenSub));
                debug(`📡 Subscribed to ${tokenMints.length} token trades`, 'success');
            } else {
                console.log('⚠️ No tokens to subscribe to yet');
            }
            
            if (currentPage === 'manage') {
                // Update sync status for all devs
                followedDevs.forEach(dev => {
                    syncStatus.set(dev.address, 'synced');
                    updateSyncIndicator(dev.address, 'synced');
                });
            }

            // Seed + subscribe to the pinned launch (if configured)
            loadPinnedLaunch();
        };
        
        wsClient.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handlePumpPortalMessage(data);
            } catch (error) {
                debug(`Failed to parse message: ${error.message}`, 'error');
            }
        };
        
        wsClient.onerror = (error) => {
            debug(`WebSocket error occurred`, 'error');
            updateStatus('error');
        };
        
        wsClient.onclose = () => {
            debug('Disconnected from PumpDev', 'error');
            updateStatus('disconnected');
            wsClient = null;
            
            if (currentPage === 'manage') {
                updateAllSyncIndicators('error');
            }
            
            // Reconnect after delay
            setTimeout(connectWebSocket, CONFIG.SYNC_RETRY_DELAY);
        };
    } catch (error) {
        debug(`Failed to create WebSocket: ${error.message}`, 'error');
        updateStatus('error');
    }
}

// ============================================
// PumpDev Message Handler
// ============================================
const SOL_MINT = 'So11111111111111111111111111111111111111112';

function handlePumpPortalMessage(data) {
    // Confirmation messages from PumpDev (connection + subscription acks)
    if (data.type === 'connected') {
        debug('PumpDev connection confirmed', 'success');
        return;
    }
    if (data.type === 'subscribed') {
        debug(`Subscribed: ${data.method}`, 'info');
        return;
    }

    debug(`Received message type: ${data.txType || data.type || 'unknown'}`, 'info');

    // SOL pairs only — ignore non-SOL (e.g. USDC) markets.
    // create/complete events that omit quoteMint default to SOL.
    if (data.quoteMint && data.quoteMint !== SOL_MINT) {
        return;
    }

    // ---- Token creation (firehose) — only surface followed devs' launches ----
    if (data.txType === 'create' && data.mint && data.traderPublicKey) {
        let dev = followedDevs.find(d => d.address === data.traderPublicKey);
        if (!dev) {
            // Not a followed dev. If "show all" is on, surface it anyway (for feed testing).
            if (!showAllLaunches) {
                return;
            }
            // Synthesize a lightweight dev label so the card renders.
            dev = { address: data.traderPublicKey, name: `${data.traderPublicKey.slice(0, 4)}…${data.traderPublicKey.slice(-4)}` };
        }

        const marketCapSol = data.marketCapSol ?? data.marketCapQuote ?? 0;
        const marketCapInUSD = marketCapSol * SOL_PRICE_USD;
        const totalSupply = 1000000000;
        const pricePerToken = marketCapInUSD / totalSupply;

        const tokenData = {
            type: 'new_token',
            mint: data.mint,
            name: data.name,
            symbol: data.symbol,
            creator: data.traderPublicKey,
            devName: dev.name,
            uri: data.uri,
            marketCapUsd: marketCapInUSD,
            marketCapSol: marketCapSol,
            bondingProgress: ((1000000000 - data.vTokensInBondingCurve) / 1000000000 * 100) || 0,
            priceUsd: pricePerToken,
            signature: data.signature,
            vSolInBondingCurve: data.vSolInBondingCurve
        };

        debug(`🆕 ${dev.name} launched ${data.name} ($${data.symbol}) — MC ${marketCapSol.toFixed(2)} SOL`, 'success');
        handleNewToken(tokenData);
    }
    // ---- Migration: bonding curve complete → graduate ----
    else if (data.txType === 'complete' && data.mint) {
        debug(`Migration (complete) for token: ${data.mint}`, 'success');
        handleTokenGraduated({ mint: data.mint, signature: data.signature });
    }
    // ---- Pool creation: token already graduated on 'complete'; ignore ----
    else if (data.txType === 'create_pool') {
        debug(`Pool created for ${data.mint} (already graduated)`, 'info');
        return;
    }
    // ---- Trades on subscribed tokens (buy/sell) ----
    else if ((data.txType === 'buy' || data.txType === 'sell') && data.mint) {
        const token = trackedTokens.get(data.mint);
        if (!token) {
            // Trade for a token we're not tracking — ignore
            return;
        }

        const marketCapSol = data.marketCapSol ?? data.marketCapQuote ?? token.marketCapSol ?? 0;
        const quoteAmount = data.solAmount ?? data.quoteAmount ?? 0;
        const marketCapInUSD = marketCapSol * SOL_PRICE_USD;
        const totalSupply = 1000000000;
        const pricePerToken = marketCapInUSD / totalSupply;

        const tradeData = {
            type: 'token_trade',
            mint: data.mint,
            priceUsd: pricePerToken,
            marketCapUsd: marketCapInUSD,
            marketCapSol: marketCapSol,
            volumeUsd: quoteAmount * SOL_PRICE_USD,
            isBuy: data.txType === 'buy',
            bondingProgress: ((1000000000 - data.vTokensInBondingCurve) / 1000000000 * 100) || token.bondingProgress || 0,
            vSolInBondingCurve: data.vSolInBondingCurve,
            trader: data.traderPublicKey
        };

        const dev = followedDevs.find(d => d.address === data.traderPublicKey);
        if (dev) {
            debug(`🔵 ${dev.name} ${data.txType} ${token.symbol}`, 'info');
        }

        handleTokenUpdate(tradeData);
    }
    else {
        debug(`Unhandled message: ${JSON.stringify(data).substring(0, 80)}`, 'info');
    }
}

// ============================================
// Pinned Launch
// ============================================

// Seed the pinned token into the dashboard immediately (no socket needed),
// so every visitor sees it on load even before/without a live connection.
function seedPinnedLaunch() {
    if (typeof PINNED_LAUNCH === 'undefined') return;

    // Register the pinned dev first — show it in the Followed Devs panel
    // by default, even before the token CA is pasted in (pre-launch).
    const pinnedWallet = (PINNED_LAUNCH.devWallet || '').trim();
    if (pinnedWallet) {
        const pinnedFields = {
            address: pinnedWallet,
            name: PINNED_LAUNCH.devName || 'Dev',
            x: 'augustsolq',
            notes: 'Migrated RANLANDS a few days ago. @augustsolq on X',
            pastProjects: [
                { name: 'RANLANDS', symbol: 'RAN', ath: '58K', chart: '', mint: '', migrated: true }
            ],
            following: true
        };

        const existing = followedDevs.find(d => d.address === pinnedWallet);
        if (existing) {
            // Overwrite stale fields from old localStorage with current config.
            Object.assign(existing, pinnedFields);
        } else {
            followedDevs.push(Object.assign({
                id: Date.now(),
                launches: 0,
                totalVolume: '0',
                addedAt: new Date().toISOString()
            }, pinnedFields));
        }
        if (typeof saveDevs === 'function') saveDevs();
        if (typeof renderFollowedDevsPanel === 'function') renderFollowedDevsPanel();
        debug(`📌 Pinned dev synced: ${PINNED_LAUNCH.devName} (${pinnedWallet})`, 'info');
    }

    // The devpick.fun / $DPICK card. It is ALWAYS shown in the launches panel.
    // - No CA yet  → card sits there with empty data (waiting for launch).
    // - CA pasted  → the SAME card is keyed to the real mint, so live trades fill it.
    const hasMint = !!(PINNED_LAUNCH.mint && PINNED_LAUNCH.mint.trim());
    const mint = hasMint ? PINNED_LAUNCH.mint.trim() : '__DPICK_PLACEHOLDER__';

    // If the CA was just pasted, drop any leftover empty placeholder card/token
    // so we don't end up with two devpick cards.
    if (hasMint && trackedTokens.has('__DPICK_PLACEHOLDER__')) {
        if (typeof removeToken === 'function') {
            removeToken('__DPICK_PLACEHOLDER__');
        } else {
            trackedTokens.delete('__DPICK_PLACEHOLDER__');
        }
    }

    // Already present (seeded earlier, restored from storage, or caught live)?
    // Make sure it's subscribed and stop — don't create a duplicate.
    if (trackedTokens.get(mint)) {
        subscribeToToken(mint);
        return;
    }

    const dev = followedDevs.find(d => d.address === PINNED_LAUNCH.devWallet);
    const seed = {
        type: 'new_token',
        mint: mint,
        name: PINNED_LAUNCH.name || 'devpick.fun',
        symbol: PINNED_LAUNCH.symbol || 'DPICK',
        creator: PINNED_LAUNCH.devWallet || (dev && dev.address) || mint,
        devName: (dev && dev.name) || PINNED_LAUNCH.devName || 'August',
        uri: '',
        marketCapUsd: 0,
        marketCapSol: 0,
        bondingProgress: 0,
        priceUsd: 0,
        signature: '',
        vSolInBondingCurve: 0,
        isPlaceholder: !hasMint,
        isPinnedSeed: true
    };

    debug(`📌 devpick card seeded ${hasMint ? '(LIVE: ' + mint + ')' : '(waiting for CA)'}`, 'success');
    handleNewToken(seed);

    // If the CA is set, subscribe right away so trades start filling this card.
    if (hasMint) subscribeToToken(mint);
}

// Subscribe to the pinned token's trades once the socket is open.
function loadPinnedLaunch() {
    if (typeof PINNED_LAUNCH === 'undefined' || !PINNED_LAUNCH.mint) return;
    const mint = PINNED_LAUNCH.mint.trim();
    if (!mint) return;

    // Make sure it's seeded (covers the case where the socket connected
    // before init seeded it), then subscribe for live trade data.
    seedPinnedLaunch();
    subscribeToToken(mint);
    debug(`📌 Subscribed to pinned launch trades: ${mint}`, 'info');
}

// ============================================
// Resubscribe to WebSocket
// ============================================
function resubscribeToWebSocket() {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        debug('WebSocket not connected, cannot resubscribe', 'warning');
        return;
    }
    
    // Resubscribe to all followed devs
    if (followedDevs.length > 0) {
        const accounts = followedDevs.map(dev => dev.address);
        const subscription = {
            method: 'subscribeAccountTrade',
            keys: accounts
        };
        wsClient.send(JSON.stringify(subscription));
        debug(`📡 Resubscribed to ${accounts.length} developer wallets`, 'success');
    }
    
    // Resubscribe to token trades
    const tokenMints = Array.from(trackedTokens.keys());
    if (tokenMints.length > 0) {
        const tokenSub = {
            method: 'subscribeTokenTrade',
            keys: tokenMints
        };
        wsClient.send(JSON.stringify(tokenSub));
        debug(`📡 Resubscribed to ${tokenMints.length} token trades`, 'success');
    }
}

// ============================================
// Subscribe to new token
// ============================================
function subscribeToToken(mint) {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        debug('WebSocket not connected, cannot subscribe to token', 'warning');
        return;
    }
    
    const subscription = {
        method: 'subscribeTokenTrade',
        keys: [mint]
    };
    
    console.log('📡 Subscribing to new token:', mint);
    wsClient.send(JSON.stringify(subscription));
    debug(`📡 Subscribed to token ${mint}`, 'success');
}