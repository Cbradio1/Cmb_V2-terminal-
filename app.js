qasync function loadData() {
    try {
        const res = await fetch('/api/predict');
        const data = await res.json();
        const hub = document.getElementById('vermeer-alerts');
        
        if (data.length === 0) {
            hub.innerHTML = '<div class="loading">NO LIVE DATA FOUND</div>';
            return;
        }

        hub.innerHTML = data.map(game => `
            <div class="card ${game.isVermeer ? 'gold-border' : ''}">
                <div class="card-header">
                    <small>${game.sport} | ${game.source}</small>
                    ${game.isVermeer ? '<span class="badge">VERMEER</span>' : ''}
                </div>
                <h3>${game.matchup}</h3>
                <p>Upset Probability: <span class="text-green">${game.upsetChance}%</span></p>
            </div>
        `).join('');
    } catch (e) {
        console.error("Sync Error", e);
    }
}

function switchTab(tab) {
    // UI Feedback for Tabs
    const buttons = document.querySelectorAll('.nav-item');
    buttons.forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    const hub = document.getElementById('vermeer-alerts');
    
    if(tab === 'hub') {
        hub.style.display = 'block';
        loadData();
    } else {
        // Placeholder for Poisson/Roster until we build those engines
        hub.innerHTML = `<div class="loading">WIRING ${tab.toUpperCase()} ENGINE...</div>`;
    }
}

loadData();
setInterval(loadData, 60000);
