// ============================================
// Utility Functions - Formatters, Debug, Clipboard, etc.
// ============================================

// ============================================
// Debug Console
// ============================================

function debug(message, type = 'info') {
    if (!CONFIG.DEBUG) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
    
    // Also output to debug console if visible
    const debugOutput = document.getElementById('debugOutput');
    if (debugOutput) {
        const entry = document.createElement('div');
        entry.className = `debug-entry ${type}`;
        entry.innerHTML = `<span class="debug-time">[${timestamp}]</span> <span class="debug-message">${message}</span>`;
        debugOutput.appendChild(entry);
        debugOutput.scrollTop = debugOutput.scrollHeight;
    }
}

function toggleDebug() {
    const debugConsole = document.getElementById('debugConsole') || document.getElementById('debugPanel');
    if (debugConsole) {
        debugConsole.style.display = debugConsole.style.display === 'none' || !debugConsole.style.display ? 'block' : 'none';
    }
}

function clearDebug() {
    const debugOutput = document.getElementById('debugOutput');
    if (debugOutput) {
        debugOutput.innerHTML = '';
    }
}

function clearDebugConsole() {
    clearDebug();
}

// ============================================
// Formatting Functions
// ============================================

function formatPrice(price) {
    if (!price || price === 0) return '0.00';
    
    // For very small prices (typical for memecoins with 1B supply)
    if (price < 0.00001) {
        // Show in scientific notation for very tiny prices
        return price.toExponential(4);
    } else if (price < 0.001) {
        // Show 6 decimal places for small prices
        return price.toFixed(6);
    } else if (price < 0.01) {
        // Show 5 decimal places
        return price.toFixed(5);
    } else if (price < 1) {
        // Show 4 decimal places
        return price.toFixed(4);
    } else {
        // Show 2 decimal places for prices above $1
        return price.toFixed(2);
    }
}

function formatMarketCap(value) {
    if (!value) return '$0';
    
    // Value is already in USD
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
}

function truncateAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTimeElapsed(launchTime) {
    const elapsed = Date.now() - launchTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getDevName(address) {
    const dev = followedDevs.find(d => d.address === address);
    return dev ? dev.name : 'Unknown';
}

// ============================================
// Clipboard Functions
// ============================================

async function copyAddress(address, element) {
    try {
        await navigator.clipboard.writeText(address);
        
        // Visual feedback
        if (element) {
            element.classList.add('copied');
            const originalText = element.textContent;
            element.textContent = 'Copied!';
            element.style.color = '#66b3ff';
            
            setTimeout(() => {
                element.textContent = originalText;
                element.classList.remove('copied');
                element.style.color = '';
            }, 2000);
        }
        
        debug(`Copied address: ${address}`, 'info');
    } catch (error) {
        debug(`Failed to copy address: ${error.message}`, 'error');
    }
}

async function copyToClipboard(text, element) {
    try {
        await navigator.clipboard.writeText(text);
        
        if (element) {
            const originalText = element.textContent;
            element.textContent = 'Copied!';
            setTimeout(() => {
                element.textContent = originalText;
            }, 2000);
        }
    } catch (error) {
        debug(`Failed to copy: ${error.message}`, 'error');
    }
}

// ============================================
// Dev Profile Window
// ============================================

let activeDevProfile = null;
let profileClickHandler = null;

function openDevProfile(address, event) {
    if (event) event.stopPropagation();
    
    const dev = followedDevs.find(d => d.address === address);
    if (!dev) {
        debug(`Dev not found: ${address}`, 'error');
        return;
    }
    
    // Close existing profile if open
    if (activeDevProfile) {
        closeDevProfile();
    }
    
    // Create profile window
    const profileWindow = document.createElement('div');
    profileWindow.className = 'dev-profile-window';
    profileWindow.id = `dev-profile-${dev.id}`;
    
    // Get the token card position
    const card = event ? event.target.closest('.token-card') : null;
    if (card) {
        const rect = card.getBoundingClientRect();
        // Position to the right of the card
        profileWindow.style.left = `${rect.right + 10}px`;
        profileWindow.style.top = `${rect.top}px`;
        
        // Check if it goes off screen and adjust
        setTimeout(() => {
            const profileRect = profileWindow.getBoundingClientRect();
            if (profileRect.right > window.innerWidth - 20) {
                // If it would go off screen, position to the left of the card instead
                profileWindow.style.left = `${rect.left - 410}px`;
            }
            if (profileRect.bottom > window.innerHeight - 50) {
                // Adjust vertical position if needed
                profileWindow.style.top = `${window.innerHeight - profileRect.height - 60}px`;
            }
        }, 0);
    }
    
    // Build past projects HTML
    let projectsHtml = '';
    if (dev.pastProjects && dev.pastProjects.length > 0) {
        projectsHtml = dev.pastProjects.map(project => {
            // Determine if chart is a URL or CA
            const isUrl = project.chart && (project.chart.startsWith('http') || project.chart.includes('.'));
            const chartLink = isUrl ? project.chart : `${CONFIG.CHART_PROVIDERS[currentChartProvider].url}${project.chart}`;
            
            return `
            <div class="project-item">
                <div class="project-header">
                    <span class="project-name">${project.symbol ? `$${project.symbol}` : project.name}</span>
                    <span class="project-ath">ATH: ${project.ath || 'N/A'}</span>
                </div>
                <div class="project-details">
                    ${project.name && project.symbol ? `<div class="project-fullname">${project.name}</div>` : ''}
                    ${project.chart ? `<div class="project-ca">${isUrl ? 'Chart Link' : truncateAddress(project.chart)}</div>` : ''}
                </div>
                <div class="project-actions">
                    ${project.chart ? `
                        <button class="project-chart-btn" onclick="window.open('${chartLink}', '_blank')">
                            📊 Chart
                        </button>
                    ` : ''}
                    ${!isUrl && project.chart ? `
                        <button class="project-copy-btn" onclick="copyAddress('${project.chart}', this)">
                            📋 Copy CA
                        </button>
                    ` : ''}
                </div>
            </div>
        `}).join('');
    } else {
        projectsHtml = '<div class="no-projects">No past projects recorded</div>';
    }
    
    profileWindow.innerHTML = `
        <div class="profile-header">
            <div class="profile-title">
                <span class="profile-name">${dev.name}</span>
            </div>
            <button class="profile-close" onclick="closeDevProfile()">×</button>
        </div>
        
        <div class="profile-content">
            <div class="profile-section">
                <h4>Wallet Address</h4>
                <div class="profile-address" onclick="copyAddress('${dev.address}', this)">
                    ${dev.address}
                </div>
            </div>
            
            <div class="profile-section">
                <h4>Statistics</h4>
                <div class="profile-stats">
                    <div class="profile-stat">
                        <span>Total Launches:</span>
                        <span>${dev.launches}</span>
                    </div>
                    <div class="profile-stat">
                        <span>Total Volume:</span>
                        <span>$${dev.totalVolume}</span>
                    </div>
                    <div class="profile-stat">
                        <span>Added:</span>
                        <span>${new Date(dev.addedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="profile-section">
                <h4>Notes</h4>
                <div class="profile-notes">
                    ${dev.notes || 'No notes'}
                </div>
            </div>
            
            <div class="profile-section">
                <h4>Past Projects</h4>
                <div class="profile-projects">
                    ${projectsHtml}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(profileWindow);
    activeDevProfile = profileWindow;
    
    // Stop propagation on the profile window itself
    profileWindow.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Add click outside handler
    setTimeout(() => {
        profileClickHandler = (e) => {
            if (!profileWindow.contains(e.target)) {
                closeDevProfile();
            }
        };
        document.addEventListener('click', profileClickHandler);
    }, 100);
}

function closeDevProfile() {
    if (activeDevProfile) {
        activeDevProfile.remove();
        activeDevProfile = null;
    }
    if (profileClickHandler) {
        document.removeEventListener('click', profileClickHandler);
        profileClickHandler = null;
    }
}

// ============================================
// CA Display — fill every "CA:" chip from PINNED_LAUNCH.mint
// (single source of truth: change the CA in config.js only)
// ============================================
function populateCADisplays() {
    if (typeof PINNED_LAUNCH === 'undefined') return;
    const ca = (PINNED_LAUNCH.mint || '').trim();
    if (!ca) return; // leave the existing placeholder if no CA set

    document.querySelectorAll('.ca-value').forEach(el => {
        el.textContent = ca;
    });
    debug(`CA displays set to: ${ca}`, 'info');
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Detect current page
    currentPage = window.location.pathname.includes('manage') ? 'manage' : 'dashboard';
    
    debug(`Initializing ${currentPage === 'manage' ? 'Manage Devs' : 'Dashboard'} page...`, 'info');

    // Fill every "CA:" display chip from the single source of truth (config).
    populateCADisplays();
    
    // Load saved chart provider preference
    loadChartProvider();
    
    // Fetch SOL price first
    fetchSolPrice();
    
    // Load saved devs
    loadDevs();
    
    // Connect to PumpPortal WebSocket
    connectWebSocket();
    
    if (currentPage === 'dashboard') {
        // Dashboard specific initialization
        startUpdateTimers();
        loadSavedTokens();
        seedPinnedLaunch();
        renderFollowedDevsPanel();
        
        // Refresh SOL price periodically
        setInterval(fetchSolPrice, CONFIG.SOL_PRICE_REFRESH);
    } else {
        // Manage page specific initialization
        setupManagePageEvents();
    }
    
    debug('Initialization complete', 'success');
});