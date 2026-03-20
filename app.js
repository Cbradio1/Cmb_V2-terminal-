qasync function loadData() {
    const hub = document.getElementById('vermeer-alerts');
    try {
        const res = await fetch('/api/predict');
        if (!res.ok) throw new Error('Network response was not ok');
        
        const data = await res.json();
        
        if (!data || data.length === 0) {
            hub.innerHTML = '<div class="loading">NO LIVE GAMES FOUND IN DATA STREAM</div>';
            return;
        }

        hub.innerHTML = data.map(game => `
            <div class="card ${game.isVermeer ? 'gold-border' : ''}">
                <div style="display:flex; justify-content:space-between; font-size: 0.7rem; color: #888;">
                    <span>${game.sport} | ${game.source}</span>
                    ${game.isVermeer ? '<span style="color:#ffcc00; font-weight:bold;">VERMEER PICK</span>' : ''}
                </div>
                <h3 style="margin: 10px 0; font-size: 1.1rem;">${game.matchup}</h3>
                <p style="margin: 0; font-size: 0.9rem;">Upset Prob: <span class="text-green">${game.upsetChance}%</span></p>
            </div>
        `).join('');
    } catch (e) {
        hub.innerHTML = `<div class="loading" style="color: #ff4444;">SYNC ERROR: CHECK RENDER LOGS</div>`;
        console.error("Master Engine Sync Error:", e);
    }
}

// Ensure the Hub tab is active by default
function switchTab(tabName) {
    const buttons = document.querySelectorAll('.nav-item');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const hub = document.getElementById('vermeer-alerts');
    if (tabName === 'hub') {
        hub.innerHTML = '<div class="loading">RE-SYNCING...</div>';
        loadData();
    } else {
        hub.innerHTML = `<div class="loading" style="color: #666;">${tabName.toUpperCase()} MODULE OFFLINE</div>`;
    }
}

// Kickstart on load
loadData();
