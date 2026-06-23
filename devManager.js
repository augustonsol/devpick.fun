// ============================================
// Developer Management
// ============================================

let followedDevs = [];
let syncStatus = new Map();
let projectRowCount = 1;

// ============================================
// Load & Save Devs
// ============================================
function loadDevs() {
    const saved = localStorage.getItem('followedDevs');
    if (saved) {
        try {
            followedDevs = JSON.parse(saved);
            debug(`Loaded ${followedDevs.length} devs from storage`, 'info');
            
            // Initialize sync status for all devs
            followedDevs.forEach(dev => {
                syncStatus.set(dev.address, 'unknown');
            });
            
            if (currentPage === 'manage') {
                renderDevs();
            }
        } catch (error) {
            debug('Failed to load devs: ' + error.message, 'error');
            followedDevs = [];
        }
    }
}

function saveDevs() {
    try {
        localStorage.setItem('followedDevs', JSON.stringify(followedDevs));
        debug(`Saved ${followedDevs.length} devs to storage`, 'info');
    } catch (error) {
        debug('Failed to save devs: ' + error.message, 'error');
    }
}

// ============================================
// Manage Page Setup
// ============================================
function setupManagePageEvents() {
    // Add enter key support for inputs
    const inputs = document.querySelectorAll('.input-field');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addDev();
            }
        });
    });
}

// ============================================
// Add/Edit Dev Functions
// ============================================
function addProjectRow() {
    const container = document.getElementById('pastProjectsContainer');
    if (!container) return;
    
    projectRowCount++;
    const newRow = document.createElement('div');
    newRow.className = 'project-input-row';
    newRow.innerHTML = `
        <input type="text" class="project-field" placeholder="Name" data-field="name">
        <input type="text" class="project-field" placeholder="Symbol" data-field="symbol">
        <input type="text" class="project-field" placeholder="ATH (e.g., 500K)" data-field="ath">
        <input type="text" class="project-field" placeholder="Chart URL or CA" data-field="chart">
        <button class="remove-project-btn" onclick="removeProjectRow(this)">×</button>
    `;
    
    container.appendChild(newRow);
}

function removeProjectRow(button) {
    button.parentElement.remove();
    projectRowCount--;
}

function addDev() {
    const name = document.getElementById('devName').value.trim();
    const address = document.getElementById('devAddress').value.trim();
    const notes = document.getElementById('devNotes').value.trim();

    if (!name || !address) {
        showStatus('Name and wallet address are required', 'error');
        return;
    }

    // Check for duplicate address
    if (followedDevs.some(d => d.address.toLowerCase() === address.toLowerCase())) {
        showStatus('This wallet address is already added', 'error');
        return;
    }
    
    // Collect past projects from input fields
    const pastProjects = [];
    const projectRows = document.querySelectorAll('.project-input-row');
    projectRows.forEach(row => {
        const nameField = row.querySelector('[data-field="name"]');
        const symbolField = row.querySelector('[data-field="symbol"]');
        const athField = row.querySelector('[data-field="ath"]');
        const chartField = row.querySelector('[data-field="chart"]');
        
        if (nameField && nameField.value.trim()) {
            pastProjects.push({
                name: nameField.value.trim(),
                symbol: symbolField ? symbolField.value.trim() : '',
                ath: athField ? athField.value.trim() : '',
                chart: chartField ? chartField.value.trim() : '',
                mint: chartField ? chartField.value.trim() : '' // Use chart field as mint/CA
            });
        }
    });

    debug(`Adding dev: ${name} (${address}) with ${pastProjects.length} past projects`, 'info');

    const newDev = {
        id: Date.now(),
        name: name,
        address: address,
        notes: notes || '',
        pastProjects: pastProjects,
        launches: 0,
        totalVolume: '0',
        following: true,
        addedAt: new Date().toISOString()
    };

    followedDevs.push(newDev);
    saveDevs();
    renderDevs();

    // Subscribe to this dev on PumpPortal
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        // Re-subscribe with all dev addresses including the new one
        const allAddresses = followedDevs.map(dev => dev.address);
        wsClient.send(JSON.stringify({
            method: 'subscribeAccountTrade',
            keys: allAddresses
        }));
        debug(`Added and subscribed to ${newDev.name}`, 'success');
    }

    // Clear inputs
    document.getElementById('devName').value = '';
    document.getElementById('devAddress').value = '';
    document.getElementById('devNotes').value = '';
    
    // Clear project inputs
    const container = document.getElementById('pastProjectsContainer');
    if (container) {
        container.innerHTML = `
            <div class="project-input-row">
                <input type="text" class="project-field" placeholder="Name" data-field="name">
                <input type="text" class="project-field" placeholder="Symbol" data-field="symbol">
                <input type="text" class="project-field" placeholder="ATH (e.g., 500K)" data-field="ath">
                <input type="text" class="project-field" placeholder="Chart URL or CA" data-field="chart">
            </div>
        `;
        projectRowCount = 1;
    }
    
    showStatus('Dev added successfully!', 'success');
}

function editDev(id) {
    const dev = followedDevs.find(d => d.id === id);
    if (!dev) return;
    
    // Populate the form with existing data
    document.getElementById('devName').value = dev.name;
    document.getElementById('devAddress').value = dev.address;
    document.getElementById('devNotes').value = dev.notes || '';
    
    // Populate past projects
    const container = document.getElementById('pastProjectsContainer');
    if (container && dev.pastProjects && dev.pastProjects.length > 0) {
        container.innerHTML = '';
        dev.pastProjects.forEach((project, index) => {
            const row = document.createElement('div');
            row.className = 'project-input-row';
            row.innerHTML = `
                <input type="text" class="project-field" placeholder="Name" data-field="name" value="${project.name || ''}">
                <input type="text" class="project-field" placeholder="Symbol" data-field="symbol" value="${project.symbol || ''}">
                <input type="text" class="project-field" placeholder="ATH (e.g., 500K)" data-field="ath" value="${project.ath || ''}">
                <input type="text" class="project-field" placeholder="Chart URL or CA" data-field="chart" value="${project.chart || project.mint || ''}">
                ${index > 0 ? '<button class="remove-project-btn" onclick="removeProjectRow(this)">×</button>' : ''}
            `;
            container.appendChild(row);
        });
        projectRowCount = dev.pastProjects.length;
    }
    
    // Remove the dev so it can be re-added with changes
    followedDevs = followedDevs.filter(d => d.id !== id);
    saveDevs();
    renderDevs();
    
    // Focus on name field
    document.getElementById('devName').focus();
    
    showStatus('Edit the details and click Add Dev to save changes', 'info');
}

function removeDev(id) {
    if (confirm('Are you sure you want to remove this dev?')) {
        const dev = followedDevs.find(d => d.id === id);
        if (!dev) return;
        
        debug(`Removing dev: ${dev.name}`, 'info');
        
        // Remove from array
        followedDevs = followedDevs.filter(d => d.id !== id);
        syncStatus.delete(dev.address);
        saveDevs();
        renderDevs();
        
        // Re-subscribe without this dev
        if (wsClient && wsClient.readyState === WebSocket.OPEN && followedDevs.length > 0) {
            const remainingAddresses = followedDevs.map(d => d.address);
            wsClient.send(JSON.stringify({
                method: 'subscribeAccountTrade',
                keys: remainingAddresses
            }));
        }
        
        showStatus('Dev removed', 'success');
    }
}

// ============================================
// Sync Functions
// ============================================
function syncAllDevs() {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        debug('Cannot sync - WebSocket not connected', 'error');
        showStatus('Not connected to PumpPortal', 'error');
        return;
    }

    debug('Syncing all devs to PumpPortal...', 'info');
    
    // Subscribe to all dev addresses
    if (followedDevs.length > 0) {
        const addresses = followedDevs.map(dev => dev.address);
        wsClient.send(JSON.stringify({
            method: 'subscribeAccountTrade',
            keys: addresses
        }));
        
        followedDevs.forEach(dev => {
            syncStatus.set(dev.address, 'synced');
            updateSyncIndicator(dev.address, 'synced');
        });
    }
    
    showStatus(`Synced ${followedDevs.length} devs`, 'success');
}

function syncDev(id) {
    const dev = followedDevs.find(d => d.id === id);
    if (dev) {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            // Subscribe to this specific dev
            wsClient.send(JSON.stringify({
                method: 'subscribeAccountTrade',
                keys: [dev.address]
            }));
            syncStatus.set(dev.address, 'synced');
            updateSyncIndicator(dev.address, 'synced');
            debug(`Synced ${dev.name}`, 'success');
        } else {
            debug(`Cannot sync ${dev.name} - not connected`, 'error');
            syncStatus.set(dev.address, 'error');
            updateSyncIndicator(dev.address, 'error');
        }
    }
}

function toggleFollow(id) {
    const dev = followedDevs.find(d => d.id === id);
    if (dev) {
        dev.following = !dev.following;
        saveDevs();
        renderDevs();
        
        debug(`Toggled follow for ${dev.name}: ${dev.following}`, 'info');
    }
}

// ============================================
// Render Functions
// ============================================
function renderDevs() {
    const grid = document.getElementById('devsGrid');
    if (!grid) return;
    
    const emptyState = document.getElementById('emptyState');
    
    if (followedDevs.length === 0) {
        grid.innerHTML = '';
        if (emptyState) {
            grid.appendChild(emptyState);
            emptyState.style.display = 'block';
        }
    } else {
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        grid.innerHTML = followedDevs.map(dev => createDevCard(dev)).join('');
    }

    // Update counts
    const devCount = document.getElementById('devCount');
    const totalDevs = document.getElementById('totalDevs');
    const syncedDevs = document.getElementById('syncedDevs');
    
    if (devCount) devCount.textContent = followedDevs.length;
    if (totalDevs) totalDevs.textContent = followedDevs.length;
    
    if (syncedDevs) {
        const syncedCount = Array.from(syncStatus.values()).filter(s => s === 'synced').length;
        syncedDevs.textContent = syncedCount;
    }

    debug(`Rendered ${followedDevs.length} devs`, 'info');
}

function createDevCard(dev) {
    const syncState = syncStatus.get(dev.address) || 'unknown';
    const projectCount = dev.pastProjects ? dev.pastProjects.length : 0;
    
    return `
        <div class="dev-card" id="dev-${dev.id}">
            <div class="sync-indicator ${syncState}" title="Sync status: ${syncState}"></div>
            <div class="dev-header">
                <div class="dev-info">
                    <div class="dev-name">${dev.name}</div>
                    <div class="dev-address" onclick="copyAddress('${dev.address}', this)">
                        ${dev.address.substring(0, 6)}...${dev.address.substring(dev.address.length - 4)}
                    </div>
                    ${dev.notes ? `<div class="dev-notes">${dev.notes}</div>` : ''}
                    ${projectCount > 0 ? `<div class="dev-project-count">📁 ${projectCount} past project${projectCount > 1 ? 's' : ''}</div>` : ''}
                </div>
            </div>
            
            <div class="dev-stats">
                <div class="stat">
                    <span class="stat-label">Launches</span>
                    <span class="stat-value">${dev.launches}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total Volume</span>
                    <span class="stat-value">$${dev.totalVolume}</span>
                </div>
            </div>
            
            <div class="dev-actions">
                <button class="action-btn ${dev.following ? 'active' : ''}" onclick="toggleFollow(${dev.id})">
                    ${dev.following ? '✓ Following' : 'Follow'}
                </button>
                <button class="action-btn" onclick="syncDev(${dev.id})">
                    Sync
                </button>
                <button class="action-btn" onclick="editDev(${dev.id})">
                    Edit
                </button>
                <button class="action-btn remove" onclick="removeDev(${dev.id})">
                    Remove
                </button>
            </div>
        </div>
    `;
}

function updateSyncIndicator(address, status) {
    const dev = followedDevs.find(d => d.address === address);
    if (!dev) return;
    
    const card = document.getElementById(`dev-${dev.id}`);
    if (!card) return;
    
    const indicator = card.querySelector('.sync-indicator');
    if (indicator) {
        indicator.className = `sync-indicator ${status}`;
        indicator.title = `Sync status: ${status}`;
    }
}

function updateAllSyncIndicators(status) {
    followedDevs.forEach(dev => {
        syncStatus.set(dev.address, status);
        updateSyncIndicator(dev.address, status);
    });
}

// ============================================
// Export/Import Functions
// ============================================
function exportDevs() {
    const dataStr = JSON.stringify(followedDevs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `devs_export_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    debug(`Exported ${followedDevs.length} devs`, 'success');
    showStatus('Devs exported successfully', 'success');
}

function importDevs(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            
            if (!Array.isArray(imported)) {
                throw new Error('Invalid format: expected array');
            }
            
            // Merge with existing devs (avoid duplicates)
            let addedCount = 0;
            imported.forEach(importedDev => {
                if (!followedDevs.some(d => d.address.toLowerCase() === importedDev.address.toLowerCase())) {
                    // Ensure required fields
                    if (!importedDev.id) importedDev.id = Date.now() + Math.random();
                    if (!importedDev.launches) importedDev.launches = 0;
                    if (!importedDev.totalVolume) importedDev.totalVolume = '0';
                    if (!importedDev.following) importedDev.following = true;
                    if (!importedDev.addedAt) importedDev.addedAt = new Date().toISOString();
                    
                    followedDevs.push(importedDev);
                    addedCount++;
                }
            });
            
            saveDevs();
            renderDevs();
            
            if (addedCount > 0) {
                // Re-subscribe with new devs
                if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                    const allAddresses = followedDevs.map(d => d.address);
                    wsClient.send(JSON.stringify({
                        method: 'subscribeAccountTrade',
                        keys: allAddresses
                    }));
                }
                
                showStatus(`Imported ${addedCount} devs successfully`, 'success');
            } else {
                showStatus('No new devs to import (all already exist)', 'warning');
            }
        } catch (error) {
            debug('Failed to import devs: ' + error.message, 'error');
            showStatus('Failed to import file', 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Clear input
}

function clearAllDevs() {
    if (confirm('Are you sure you want to remove ALL devs? This cannot be undone!')) {
        followedDevs = [];
        syncStatus.clear();
        saveDevs();
        renderDevs();
        showStatus('All devs cleared', 'success');
    }
}

// ============================================
// Open Dev Profile
// ============================================
function openDevProfile(address, event) {
    if (event) event.stopPropagation();
    
    const dev = followedDevs.find(d => d.address === address);
    if (!dev) return;
    
    alert(`Dev: ${dev.name}\nAddress: ${dev.address}\nNotes: ${dev.notes || 'None'}\nPast Projects: ${dev.pastProjects?.length || 0}`);
}
