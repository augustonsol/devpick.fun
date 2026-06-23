// ============================================
// UI Updates & DOM Manipulation
// ============================================

let currentPage = null;
let currentChartProvider = 'axiom';

// ============================================
// Token Card Creation & Updates
// ============================================

function addTokenCard(token, panelId) {
    const panel = document.getElementById(`${panelId}-content`);
    if (!panel) {
        debug(`Panel ${panelId}-content not found`, 'error');
        return;
    }
    
    // Check if token passes filters for this panel
    if (!passesFilters(token, panelId)) {
        debug(`Token ${token.symbol} doesn't pass filters for ${panelId}`, 'info');
        return;
    }
    
    // Remove empty state if exists
    const emptyState = panel.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Check if card already exists IN THIS SPECIFIC PANEL
    if (document.getElementById(`${panelId}-token-${token.mint}`)) {
        debug(`Card for ${token.symbol} already exists in ${panelId}`, 'info');
        return;
    }
    
    // Create card with panel-specific ID
    const card = createTokenCard(token, panelId);
    
    // Insert card based on panel's sorting preference
    insertCardSorted(panel, card, token, panelId);
    
    debug(`✅ Added ${token.symbol} to ${panelId}`, 'success');
}

function createTokenCard(token, panelId = '') {
    const card = document.createElement('div');
    card.className = 'token-card';
    // Create unique ID if panel is specified
    card.id = panelId ? `${panelId}-token-${token.mint}` : `token-${token.mint}`;
    card.setAttribute('data-mint', token.mint);
    
    const timeElapsed = getTimeElapsed(token.launchTime);
    
    // Get dev for notes
    const dev = followedDevs.find(d => d.address === token.creator);
    const devNotes = dev && dev.notes ? dev.notes : '';
    
    card.innerHTML = `
        <div class="token-timer">${timeElapsed}</div>
        <button class="remove-btn" onclick="removeToken('${token.mint}')">×</button>
        
        <div class="token-header">
            <div class="token-info">
                <div class="token-main">
                    <div class="token-symbol">$${token.symbol}</div>
                    <div class="token-name">${token.name}</div>
                </div>
                <div class="token-dev-box" onclick="openDevProfile('${token.creator}', event)">
                    <div class="dev-box-header">
                        <span class="dev-label">Dev:</span> <span class="dev-name">${token.devName}</span>
                    </div>
                    ${devNotes ? `<div class="dev-box-notes">${devNotes.substring(0, 50)}${devNotes.length > 50 ? '...' : ''}</div>` : ''}
                </div>
            </div>
        </div>
        
        <div class="token-market-cap">
            <span class="mc-label">Market Cap</span>
            <span class="mc-value">${formatMarketCap(token.marketCap)}</span>
        </div>
        
        <div class="contract-address" onclick="copyAddress('${token.mint}', this)">
            <span class="address-text">${truncateAddress(token.mint)}</span>
            <span class="copy-icon">📋</span>
        </div>
        
        <div class="token-stats-grid">
            <div class="stat-item">
                <span class="stat-label">Volume</span>
                <span class="stat-value">${formatMarketCap(token.volume24h)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Buys</span>
                <span class="stat-value" style="color: #66ff66;">${token.buyCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Sells</span>
                <span class="stat-value" style="color: #ff6666;">${token.sellCount}</span>
            </div>
        </div>

        <div class="token-actions">
            <button class="chart-button" onclick="openChart('${token.mint}')">
                📊 VIEW CHART
            </button>
        </div>
    `;
    
    return card;
}

function createGraduatedTokenCard(token) {
    const card = document.createElement('div');
    card.className = 'token-card graduated-card';
    card.id = `graduated-token-${token.mint}`;
    card.setAttribute('data-mint', token.mint);
    
    const timeElapsed = getTimeElapsed(token.launchTime);
    
    // Get dev for notes
    const dev = followedDevs.find(d => d.address === token.creator);
    const devNotes = dev && dev.notes ? dev.notes : '';
    
    card.innerHTML = `
        <div class="token-timer">${timeElapsed}</div>
        <button class="remove-btn" onclick="removeToken('${token.mint}')">×</button>
        
        <div class="token-header">
            <div class="token-info">
                <div class="token-main">
                    <div class="token-symbol">$${token.symbol}</div>
                    <div class="token-name">${token.name}</div>
                </div>
                <div class="token-dev-box" onclick="openDevProfile('${token.creator}', event)">
                    <div class="dev-box-header">
                        <span class="dev-label">Dev:</span> <span class="dev-name">${token.devName}</span>
                    </div>
                    ${devNotes ? `<div class="dev-box-notes">${devNotes.substring(0, 50)}${devNotes.length > 50 ? '...' : ''}</div>` : ''}
                </div>
            </div>
        </div>
        
        <div class="token-graduated-status">
            <span class="graduated-label">🎓 GRADUATED 🎓</span>
        </div>
        
        <div class="contract-address" onclick="copyAddress('${token.mint}', this)">
            <span class="address-text">${truncateAddress(token.mint)}</span>
            <span class="copy-icon">📋</span>
        </div>
        
        <div class="token-stats-grid">
            <div class="stat-item">
                <span class="stat-label">Volume</span>
                <span class="stat-value">${formatMarketCap(token.volume24h)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Buys</span>
                <span class="stat-value" style="color: #66ff66;">${token.buyCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Sells</span>
                <span class="stat-value" style="color: #ff6666;">${token.sellCount}</span>
            </div>
        </div>

        <div class="token-actions">
            <button class="chart-button graduated-chart" onclick="openChart('${token.mint}')">
                🚀 VIEW ON RAYDIUM
            </button>
        </div>
    `;
    
    return card;
}

function addGraduatedTokenCard(token) {
    const panel = document.getElementById('graduated-content');
    if (!panel) return;
    
    // Remove empty state if exists
    const emptyState = panel.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Check if card already exists
    if (document.getElementById(`graduated-token-${token.mint}`)) {
        return;
    }
    
    // Create special graduated card
    const card = createGraduatedTokenCard(token);
    panel.insertBefore(card, panel.firstChild);
    
    debug(`Added ${token.symbol} to graduated panel`, 'success');
}

function insertCardSorted(panel, card, token, panelId) {
    const existingCards = Array.from(panel.querySelectorAll('.token-card'));
    
    if (panelId === 'new-launches') {
        // Sort by age (newest first)
        const insertBefore = existingCards.find(existing => {
            const existingMint = existing.getAttribute('data-mint');
            const existingToken = trackedTokens.get(existingMint);
            return existingToken && token.launchTime > existingToken.launchTime;
        });
        
        if (insertBefore) {
            panel.insertBefore(card, insertBefore);
        } else {
            panel.appendChild(card);
        }
    } else if (panelId === 'active-tokens') {
        // Sort by market cap (highest first)
        const insertBefore = existingCards.find(existing => {
            const existingMint = existing.getAttribute('data-mint');
            const existingToken = trackedTokens.get(existingMint);
            return existingToken && token.marketCap > existingToken.marketCap;
        });
        
        if (insertBefore) {
            panel.insertBefore(card, insertBefore);
        } else {
            panel.appendChild(card);
        }
    } else {
        // Default: append to end
        panel.appendChild(card);
    }
}

function updateTokenCard(token) {
    // Find ALL cards with this mint address using data-mint attribute
    const allCards = document.querySelectorAll(`[data-mint="${token.mint}"]`);
    
    if (allCards.length === 0) {
        debug(`No cards found for token ${token.symbol}`, 'warning');
        return;
    }
    
    allCards.forEach(card => {
        // Update market cap
        const mcEl = card.querySelector('.mc-value');
        if (mcEl) mcEl.textContent = formatMarketCap(token.marketCap);
        
        // Update stats - volume, buys, and sells
        const statValues = card.querySelectorAll('.stat-value');
        if (statValues[0]) statValues[0].textContent = formatMarketCap(token.volume24h);
        if (statValues[1]) {
            statValues[1].textContent = token.buyCount;
            statValues[1].style.color = '#66ff66';
        }
        if (statValues[2]) {
            statValues[2].textContent = token.sellCount;
            statValues[2].style.color = '#ff6666';
        }
        
        // Update timer
        const timerEl = card.querySelector('.token-timer');
        if (timerEl) timerEl.textContent = getTimeElapsed(token.launchTime);
    });
    
    debug(`Updated ${allCards.length} card(s) for ${token.symbol}`, 'info');
    
    // If in active tokens, might need to re-sort by market cap
    const activePanel = document.getElementById('active-tokens-content');
    if (activePanel) {
        const activeCard = activePanel.querySelector(`[data-mint="${token.mint}"]`);
        if (activeCard) {
            // Get all cards and sort them
            const allCards = Array.from(activePanel.querySelectorAll('.token-card'));
            allCards.sort((a, b) => {
                const mintA = a.getAttribute('data-mint');
                const mintB = b.getAttribute('data-mint');
                const tokenA = trackedTokens.get(mintA);
                const tokenB = trackedTokens.get(mintB);
                if (!tokenA || !tokenB) return 0;
                return tokenB.marketCap - tokenA.marketCap; // Highest first
            });
            
            // Re-append in sorted order
            allCards.forEach(card => activePanel.appendChild(card));
        }
    }
}

// ============================================
// Status Updates
// ============================================

function updateStatus(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (statusDot && statusText) {
        statusDot.className = 'status-dot ' + status;
        
        switch(status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
            case 'error':
                statusText.textContent = 'Error';
                break;
            default:
                statusText.textContent = 'Unknown';
        }
    }
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// ============================================
// Count Updates
// ============================================

function updateCounts() {
    if (currentPage !== 'dashboard') return;
    
    updatePanelCount('new-launches');
    updatePanelCount('active-tokens');
    
    const tokensCount = document.getElementById('tokensCount');
    const devsCount = document.getElementById('devsCount');
    
    if (tokensCount) tokensCount.textContent = trackedTokens.size;
    if (devsCount) devsCount.textContent = followedDevs.length;
}

// ============================================
// Followed Devs Panel (per-dev summary)
// ============================================

// Parse a human ATH string like "500K", "$1.2M", "69000" into a USD number.
function parseAth(str) {
    if (!str) return 0;
    const s = String(str).trim().replace(/[$,\s]/g, '').toUpperCase();
    const m = s.match(/^([\d.]+)([KMB]?)$/);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    if (m[2] === 'K') n *= 1e3;
    else if (m[2] === 'M') n *= 1e6;
    else if (m[2] === 'B') n *= 1e9;
    return n;
}

// Compute per-dev stats from live-tracked tokens + manual past projects.
function computeDevStats(dev) {
    const liveTokens = Array.from(trackedTokens.values())
        .filter(t => t.creator === dev.address && !t.isPlaceholder);
    const pastProjects = dev.pastProjects || [];

    const launches = liveTokens.length + pastProjects.length;
    const migrated = pastProjects.filter(p => p.migrated).length;

    let bestAth = 0;
    liveTokens.forEach(t => { bestAth = Math.max(bestAth, t.athMarketCap || t.marketCap || 0); });
    pastProjects.forEach(p => { bestAth = Math.max(bestAth, parseAth(p.ath)); });

    return { launches, migrated, bestAth };
}

function renderFollowedDevsPanel() {
    const panel = document.getElementById('followed-devs-content');
    if (!panel) return;

    const countEl = document.getElementById('followedDevsCount');
    if (countEl) countEl.textContent = followedDevs.length;

    if (followedDevs.length === 0) {
        panel.innerHTML = `
            <div class="empty-state">
                <h3>No devs followed</h3>
                <p>Add devs on the Manage page to see their stats here</p>
            </div>`;
        return;
    }

    const rows = followedDevs
        .map(dev => ({ dev, stats: computeDevStats(dev) }))
        .sort((a, b) => b.stats.bestAth - a.stats.bestAth);

    panel.innerHTML = rows.map(({ dev, stats }) => {
        const short = `${dev.address.slice(0, 4)}…${dev.address.slice(-4)}`;
        const ath = stats.bestAth > 0 ? formatMarketCap(stats.bestAth) : '—';
        return `
        <div class="dev-summary-card">
            <div class="dev-summary-head">
                <span class="dev-summary-name">${dev.name}</span>
                <div class="dev-summary-head-right">
                    ${dev.x ? `<a class="dev-summary-x" href="https://x.com/${dev.x}" target="_blank" rel="noopener" title="@${dev.x} on X" onclick="event.stopPropagation()">𝕏</a>` : ''}
                    <span class="dev-summary-wallet" onclick="copyAddress('${dev.address}', this)" title="${dev.address}">${short}</span>
                </div>
            </div>
            <div class="dev-summary-stats">
                <div class="dss">
                    <span class="dss-label">Launches</span>
                    <span class="dss-value">${stats.launches}</span>
                </div>
                <div class="dss">
                    <span class="dss-label">Migrated</span>
                    <span class="dss-value dss-green">${stats.migrated}</span>
                </div>
                <div class="dss">
                    <span class="dss-label">Best ATH</span>
                    <span class="dss-value dss-accent">${ath}</span>
                </div>
            </div>
            ${dev.notes ? `<div class="dev-summary-notes">${dev.notes.substring(0, 80)}${dev.notes.length > 80 ? '…' : ''}</div>` : ''}
        </div>`;
    }).join('');
}

function updatePanelCount(panelId) {
    const panel = document.getElementById(`${panelId}-content`);
    if (!panel) return;
    
    const count = panel.querySelectorAll('.token-card').length;
    
    const countElement = document.getElementById(
        panelId === 'new-launches' ? 'newLaunchesCount' :
        panelId === 'active-tokens' ? 'activeTokensCount' :
        null
    );
    
    if (countElement) {
        countElement.textContent = count;
    }
    
    debug(`Updated ${panelId} count: ${count}`, 'info');
}

// ============================================
// Chart Provider
// ============================================

function loadChartProvider() {
    const saved = localStorage.getItem('chartProvider');
    if (saved && CONFIG.CHART_PROVIDERS[saved]) {
        currentChartProvider = saved;
    }
    updateChartProviderDisplay();
}

function toggleChartProvider() {
    // Toggle between axiom and photon
    currentChartProvider = currentChartProvider === 'axiom' ? 'photon' : 'axiom';
    localStorage.setItem('chartProvider', currentChartProvider);
    updateChartProviderDisplay();
    
    debug(`Chart provider changed to ${CONFIG.CHART_PROVIDERS[currentChartProvider].name}`, 'info');
}

function updateChartProviderDisplay() {
    const nameElement = document.getElementById('chartProviderName');
    if (nameElement) {
        nameElement.textContent = CONFIG.CHART_PROVIDERS[currentChartProvider].name;
    }
}

function toggleShowAll() {
    showAllLaunches = !showAllLaunches;

    const btn = document.getElementById('showAllBtn');
    if (btn) {
        btn.textContent = showAllLaunches ? '🌐 Showing All Launches' : '👥 Followed Devs Only';
        btn.classList.toggle('active', showAllLaunches);
    }

    debug(`Show all launches: ${showAllLaunches ? 'ON' : 'OFF'}`, 'info');

    // When switching to followed-only, drop any tracked tokens whose creator isn't a followed dev.
    if (!showAllLaunches) {
        const followedAddrs = new Set(followedDevs.map(d => d.address));
        Array.from(trackedTokens.values()).forEach(token => {
            if (!followedAddrs.has(token.creator)) {
                removeToken(token.mint);
            }
        });
    }
    renderFollowedDevsPanel();
}

function openChart(mint) {
    const provider = CONFIG.CHART_PROVIDERS[currentChartProvider];
    const url = provider.url + mint;
    window.open(url, '_blank');
    debug(`Opened ${provider.name} chart for ${mint}`, 'info');
}

// ============================================
// Notification Sound
// ============================================

function playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        debug('Could not play notification sound: ' + error.message, 'warning');
    }
}