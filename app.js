async function loadData() {
    try {
        const res = await fetch('/api/predict');
        const data = await res.json();
        const hub = document.getElementById('vermeer-alerts');
        hub.innerHTML = data.map(game => `
            <div class="card">
                <small>${game.sport} | ${game.source}</small>
                <h3>${game.matchup}</h3>
                <p>Upset Prob: <span class="text-green">${game.upsetChance}%</span></p>
            </div>
        `).join('');
        document.getElementById('status').innerText = "ONLINE";
    } catch (e) { document.getElementById('status').innerText = "OFFLINE"; }
}
loadData();
