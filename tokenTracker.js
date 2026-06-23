// ============================================
// Token Tracking & Filtering
// ============================================

let trackedTokens = new Map();
let updateTimers = new Map();

// Store active filters for each panel
const panelFilters = {
    'new-launches': { minAge: 0, maxAge: 5, minMC: 0, maxMC: null },
    'active-tokens': { minAge: 0, maxAge: null, minMC: 0, maxMC: null },
    'graduated': { minAge: 0, maxAge: null, minMC: 69000, maxMC: null }
};

// Track which filter panels are open
const filterPanelState = {
    'new-launches': false,
    'active-tokens': false,
    'graduated': false
};

// ============================================
// Token Event Handlers
// ============================================

function handleNewToken(data) {
    let dev = followedDevs.find(d => d.address === data.creator);
    // If unknown (e.g. show-all mode), fall back to a label passed from the handler.
    const devName = dev ? dev.name : (data.devName || `${data.creator.slice(0, 4)}…${data.creator.slice(-4)}`);
    if (!dev && !data.devName) {
        debug(`Ignoring token from unknown dev: ${data.creator}`, 'info');
        return;
    }

    debug(`New token detected: ${data.name} (${data.symbol}) by ${devName}`, 'success');
    debug(`Market Cap: ${data.marketCapSol?.toFixed(4)} SOL ($${data.marketCapUsd?.toFixed(2)})`, 'info');
    
    const token = {
        mint: data.mint,
        name: data.name || 'Unknown',
        symbol: data.symbol || '???',
        creator: data.creator,
        devName: devName,
        launchTime: Date.now(),
        price: data.priceUsd || 0,
        marketCap: data.marketCapUsd || 0,
        athMarketCap: data.marketCapUsd || 0,
        marketCapSol: data.marketCapSol || 0,
        volume24h: 0,
        buyCount: 0,
        sellCount: 0,
        bondingProgress: data.bondingProgress || 0,
        graduated: false,
        vSolInBondingCurve: data.vSolInBondingCurve || 0,
        isPlaceholder: data.isPlaceholder || false,
        isPinnedSeed: data.isPinnedSeed || false
    };
    
    // Store token
    trackedTokens.set(token.mint, token);
    // Don't persist the devpick seed — it's regenerated from config on every load
    // so the card always reflects the current PINNED_LAUNCH.mint.
    if (!token.isPinnedSeed) {
        saveTokensToStorage();
    }
    
    // Subscribe to this token's trades
    subscribeToToken(token.mint);
    
    // Add to UI
    if (currentPage === 'dashboard') {
        // New Launches = the full firehose (every create while show-all is on),
        // EXCEPT the pinned seed which belongs only in the followed-devs panel.
        if (!data.isPinnedSeed) {
            addTokenCard(token, 'new-launches');
        }

        // "Launches by followed devs" = ONLY tokens from a followed dev,
        // plus the pinned devpick card. The firehose never enters here.
        const isFollowedDev = followedDevs.some(d => d.address === token.creator);
        if (isFollowedDev || data.isPinnedSeed) {
            addTokenCard(token, 'active-tokens');
        }

        renderFollowedDevsPanel();
        updateCounts();
        playNotificationSound();
    }
}

function handleTokenUpdate(data) {
    console.log('🔄 handleTokenUpdate called with:', {
        mint: data.mint,
        isBuy: data.isBuy,
        marketCapUsd: data.marketCapUsd,
        volumeUsd: data.volumeUsd
    });
    
    const token = trackedTokens.get(data.mint);
    if (!token) {
        debug(`Update for unknown token: ${data.mint}`, 'info');
        console.log('❌ Token not found in trackedTokens');
        return;
    }
    
    // Log the trade details
    const tradeType = data.isBuy ? 'BUY' : 'SELL';
    debug(`📊 ${tradeType}: $${token.symbol} - MC: ${data.marketCapSol?.toFixed(4)} SOL ($${data.marketCapUsd?.toFixed(2)})`, data.isBuy ? 'success' : 'warning');
    
    // Store old values for comparison
    const oldMC = token.marketCap;
    const oldBuys = token.buyCount;
    const oldSells = token.sellCount;
    
    // Update token data
    token.price = data.priceUsd || token.price;
    token.marketCap = data.marketCapUsd || token.marketCap;
    token.athMarketCap = Math.max(token.athMarketCap || 0, token.marketCap);
    token.marketCapSol = data.marketCapSol || token.marketCapSol;
    token.volume24h = (token.volume24h || 0) + (data.volumeUsd || 0);
    
    if (data.isBuy) {
        token.buyCount = (token.buyCount || 0) + 1;
        console.log(`✅ BUY: Incrementing buy count from ${oldBuys} to ${token.buyCount}`);
    } else {
        token.sellCount = (token.sellCount || 0) + 1;
        console.log(`❌ SELL: Incrementing sell count from ${oldSells} to ${token.sellCount}`);
    }
    
    token.bondingProgress = data.bondingProgress || token.bondingProgress;
    token.vSolInBondingCurve = data.vSolInBondingCurve || token.vSolInBondingCurve;
    
    // Log what changed
    console.log('📈 Token Updated:', {
        symbol: token.symbol,
        marketCap: `${oldMC?.toFixed(2)} → ${token.marketCap?.toFixed(2)}`,
        buys: `${oldBuys} → ${token.buyCount}`,
        sells: `${oldSells} → ${token.sellCount}`,
        volume: token.volume24h.toFixed(2)
    });
    
    debug(`Updated ${token.symbol}: MC ${oldMC?.toFixed(2)} → ${token.marketCap?.toFixed(2)}, Buys: ${oldBuys} → ${token.buyCount}, Sells: ${oldSells} → ${token.sellCount}`, 'info');
    
    // Update UI
    if (currentPage === 'dashboard') {
        updateTokenCard(token);
        checkTokenStatus(token);
    }
    
    saveTokensToStorage();
}

function handleTokenGraduated(data) {
    const token = trackedTokens.get(data.mint);
    if (!token) {
        debug(`Graduation received for unknown token: ${data.mint}`, 'warning');
        return;
    }
    
    debug(`🎓 Token GRADUATED: $${token.symbol} - ${token.name}`, 'success');
    
    // Mark as graduated
    token.graduated = true;
    token.graduatedAt = Date.now();
    
    if (currentPage === 'dashboard') {
        // Keep graduated tokens visible in active list, but mark them migrated.
        // Update the card so its migrated state can show, and refresh dev stats.
        updateTokenCard(token);
        renderFollowedDevsPanel();
        updateCounts();
        playNotificationSound();
    }
    
    saveTokensToStorage();
}

// ============================================
// Token Status Management
// ============================================

function checkTokenStatus(token) {
    const ageInMinutes = (Date.now() - token.launchTime) / 60000;
    
    // Check if token should move panels
    if (!token.graduated) {
        // Check if it should move from new launches to active
        if (ageInMinutes > 5) {
            // Remove from new launches if it's there
            const newLaunchElement = document.querySelector(`#new-launches-content #token-${token.mint}`);
            if (newLaunchElement) {
                newLaunchElement.remove();
                debug(`Moved ${token.symbol} from new launches (age: ${ageInMinutes.toFixed(1)}m)`, 'info');
            }
        }
        
        // Check if bonding curve is complete (graduated)
        if (token.bondingProgress >= 100 || token.vSolInBondingCurve <= 0) {
            handleTokenGraduated({ mint: token.mint });
        }
    }
    
    updateCounts();
}

function removeToken(mint) {
    const token = trackedTokens.get(mint);
    if (!token) return;
    
    trackedTokens.delete(mint);
    saveTokensToStorage();
    
    // Remove from all panels
    const cards = document.querySelectorAll(`[data-mint="${mint}"]`);
    cards.forEach(card => card.remove());
    
    // Clear update timer if exists
    if (updateTimers.has(mint)) {
        clearInterval(updateTimers.get(mint));
        updateTimers.delete(mint);
    }
    
    updateCounts();
    debug(`Removed token ${token.symbol}`, 'info');
}

function clearAllTokens() {
    if (!confirm('Clear all tracked tokens?')) return;
    
    trackedTokens.clear();
    saveTokensToStorage();
    
    // Clear all panels
    ['new-launches', 'active-tokens', 'graduated'].forEach(panelId => {
        const panel = document.getElementById(`${panelId}-content`);
        if (panel) {
            panel.innerHTML = `
                <div class="empty-state">
                    <h3>No ${panelId.replace('-', ' ')} yet</h3>
                    <p>Tokens will appear here</p>
                </div>
            `;
        }
    });
    
    // Clear all timers
    updateTimers.forEach(timer => clearInterval(timer));
    updateTimers.clear();
    
    updateCounts();
    debug('Cleared all tokens', 'success');
}

// ============================================
// Filtering Functions
// ============================================

function toggleFilters(panelId) {
    const filterPanel = document.getElementById(`${panelId}-filters`);
    const toggleBtn = filterPanel.parentElement.querySelector('.filter-toggle-btn');
    
    if (!filterPanel) return;
    
    // Toggle visibility
    if (filterPanelState[panelId]) {
        filterPanel.style.display = 'none';
        toggleBtn.classList.remove('active');
        filterPanelState[panelId] = false;
    } else {
        filterPanel.style.display = 'block';
        toggleBtn.classList.add('active');
        filterPanelState[panelId] = true;
    }
    
    debug(`Toggled filters for ${panelId}: ${filterPanelState[panelId] ? 'shown' : 'hidden'}`, 'info');
}

function applyFilters(panelId) {
    const filters = {};
    
    // Get filter values
    const minAgeInput = document.getElementById(`${panelId}-minAge`);
    const maxAgeInput = document.getElementById(`${panelId}-maxAge`);
    const minMCInput = document.getElementById(`${panelId}-minMC`);
    const maxMCInput = document.getElementById(`${panelId}-maxMC`);
    
    filters.minAge = minAgeInput ? parseFloat(minAgeInput.value) || 0 : 0;
    filters.maxAge = maxAgeInput && maxAgeInput.value ? parseFloat(maxAgeInput.value) : null;
    filters.minMC = minMCInput ? parseFloat(minMCInput.value) * 1000 || 0 : 0;
    filters.maxMC = maxMCInput && maxMCInput.value ? parseFloat(maxMCInput.value) * 1000 : null;
    
    // Store filters
    panelFilters[panelId] = filters;
    
    debug(`Applied filters for ${panelId}: Age ${filters.minAge}-${filters.maxAge || '∞'} min, MC $${filters.minMC}-${filters.maxMC || '∞'}`, 'info');
    
    // Refilter all tokens
    refreshPanel(panelId);
}

function clearFilters(panelId) {
    // Reset to defaults
    const defaults = {
        'new-launches': { minAge: 0, maxAge: 5, minMC: 0, maxMC: null },
        'active-tokens': { minAge: 0, maxAge: null, minMC: 0, maxMC: null },
        'graduated': { minAge: 0, maxAge: null, minMC: 69000, maxMC: null }
    };
    
    panelFilters[panelId] = defaults[panelId];
    
    // Clear input fields
    const inputs = document.querySelectorAll(`#${panelId}-filters input`);
    inputs.forEach(input => input.value = '');
    
    debug(`Cleared filters for ${panelId}`, 'info');
    
    // Refresh panel
    refreshPanel(panelId);
}

function passesFilters(token, panelId) {
    const filters = panelFilters[panelId];
    const ageInMinutes = (Date.now() - token.launchTime) / 60000;
    
    // Age filters
    if (filters.minAge !== null && ageInMinutes < filters.minAge) return false;
    if (filters.maxAge !== null && ageInMinutes > filters.maxAge) return false;
    
    // Market cap filters
    if (filters.minMC !== null && token.marketCap < filters.minMC) return false;
    if (filters.maxMC !== null && token.marketCap > filters.maxMC) return false;
    
    return true;
}

function refreshPanel(panelId) {
    const panel = document.getElementById(`${panelId}-content`);
    if (!panel) return;
    
    // Clear panel
    panel.innerHTML = '';
    
    let hasTokens = false;
    
    // Re-add filtered tokens
    trackedTokens.forEach(token => {
        // Skip graduated tokens for non-graduated panels
        if (panelId !== 'graduated' && token.graduated) return;
        // Only show graduated tokens in graduated panel
        if (panelId === 'graduated' && !token.graduated) return;
        
        if (passesFilters(token, panelId)) {
            addTokenCard(token, panelId);
            hasTokens = true;
        }
    });
    
    // Show empty state if no tokens
    if (!hasTokens) {
        panel.innerHTML = `
            <div class="empty-state">
                <h3>No ${panelId.replace('-', ' ')} match filters</h3>
                <p>Adjust filters or wait for new tokens</p>
            </div>
        `;
    }
    
    updateCounts();
}

function refreshData() {
    debug('Refreshing all data...', 'info');
    
    // Refresh all panels
    ['new-launches', 'active-tokens', 'graduated'].forEach(panelId => {
        refreshPanel(panelId);
    });
    
    // Check token statuses
    trackedTokens.forEach(token => {
        checkTokenStatus(token);
    });
    
    debug('Data refresh complete', 'success');
}

// ============================================
// Storage Functions
// ============================================

function saveTokensToStorage() {
    try {
        const tokensArray = Array.from(trackedTokens.values());
        localStorage.setItem('trackedTokens', JSON.stringify(tokensArray));
        debug(`Saved ${tokensArray.length} tokens to storage`, 'info');
    } catch (error) {
        debug('Failed to save tokens: ' + error.message, 'error');
    }
}

function loadSavedTokens() {
    const saved = localStorage.getItem('trackedTokens');
    if (saved) {
        try {
            const tokensArray = JSON.parse(saved);
            tokensArray.forEach(token => {
                // The devpick seed is owned by config, not storage — skip it here.
                if (token.isPinnedSeed) return;

                trackedTokens.set(token.mint, token);
                
                // Re-subscribe to token trades
                subscribeToToken(token.mint);
                
                const ageInMinutes = (Date.now() - token.launchTime) / 60000;
                const isFollowedDev = followedDevs.some(d => d.address === token.creator);

                // New Launches: any recent token (the firehose view)
                if (!token.isPlaceholder && ageInMinutes <= 5) {
                    addTokenCard(token, 'new-launches');
                }
                // Launches by followed devs: ONLY followed devs (or pinned placeholder)
                if (isFollowedDev || token.isPlaceholder) {
                    addTokenCard(token, 'active-tokens');
                }
            });
            
            updateCounts();
            debug(`Loaded ${tokensArray.length} tokens from storage`, 'info');
        } catch (error) {
            debug('Failed to load tokens: ' + error.message, 'error');
            trackedTokens.clear();
        }
    }
}

// ============================================
// Update Timers
// ============================================

function startUpdateTimers() {
    // Update token ages every 30 seconds
    setInterval(() => {
        trackedTokens.forEach(token => {
            updateTokenTimer(token);
            checkTokenStatus(token);
        });
    }, 30000);
}

function updateTokenTimer(token) {
    const elements = document.querySelectorAll(`[data-mint="${token.mint}"] .token-timer`);
    elements.forEach(el => {
        el.textContent = getTimeElapsed(token.launchTime);
    });
}

// ============================================
// Export/Import Settings
// ============================================

function exportSettings() {
    const settings = {
        followedDevs: followedDevs,
        trackedTokens: Array.from(trackedTokens.values()),
        panelFilters: panelFilters,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `devpick_setup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    debug('Exported complete setup', 'success');
}

function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const settings = JSON.parse(e.target.result);
            
            // Import devs
            if (settings.followedDevs) {
                followedDevs = settings.followedDevs;
                saveDevs();
                if (currentPage === 'manage') {
                    renderDevs();
                }
            }
            
            // Import tokens
            if (settings.trackedTokens) {
                trackedTokens.clear();
                settings.trackedTokens.forEach(token => {
                    trackedTokens.set(token.mint, token);
                });
                saveTokensToStorage();
            }
            
            // Import filters
            if (settings.panelFilters) {
                Object.assign(panelFilters, settings.panelFilters);
            }
            
            // Refresh UI
            if (currentPage === 'dashboard') {
                ['new-launches', 'active-tokens', 'graduated'].forEach(panelId => {
                    refreshPanel(panelId);
                });
            }
            
            // Resubscribe to WebSocket
            resubscribeToWebSocket();
            
            debug('Imported setup successfully', 'success');
            showStatus('Settings imported successfully', 'success');
        } catch (error) {
            debug('Failed to import settings: ' + error.message, 'error');
            showStatus('Failed to import settings', 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Clear input
}