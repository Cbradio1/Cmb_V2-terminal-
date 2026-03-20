async function loadData() {
    try {
        const res = await fetch('/api/predict');
        const data = await res.json();
        const hub = document.getElementById('vermeer-alerts');
        
        if (data.length === 0) {
            hub.innerHTML = '<div class="loading">NO LIVE GAMES FOUND FOR TODAY</div>';
            return;
        }

        hub.innerHTML = data.map(game => `
            <div class="card ${game.isVermeer ? 'gold-border' : ''}">
                <div style="display:flex; justify-content:space-between;">
                    <small style="color:#888;">${game.sport} | ${game.source}</small>
                    ${game.isVermeer ? '<span class="badge-gold">VERMEER PICK</span>' : ''}
                </div>
                <h3 style="margin: 10px 0;">${game.matchup}</h3>
                <p style="margin: 0;">Upset Probability: <span class="text-green">${game.upsetChance}%</span></p>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('connection-status').innerText = "SYNC ERROR";
    }
}

function switchTab(tab) {
    const items = document.querySelectorAll('.nav-item');
    items.forEach(i => i.classList.remove('active'));
    event.target.classList.add('active');
    // More tab logic can be added here as we expand the Roster/Poisson sections
}

loadData();
setInterval(loadData, 60000);

