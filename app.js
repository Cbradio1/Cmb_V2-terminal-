function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

async function loadData() {
    try {
        const res = await fetch('/api/predict');
        const data = await res.json();
        renderUI(data);
    } catch (e) { document.getElementById('connection-status').innerText = "OFFLINE"; }
}

function renderUI(data) {
    const hub = document.getElementById('vermeer-alerts');
    hub.innerHTML = data.map(game => `
        <div class="card ${game.isVermeer ? 'gold-border' : ''}">
            <h3>${game.matchup}</h3>
            <p>Upset: <span class="text-green">${game.upsetChance}%</span> | Total: ${game.total}</p>
            ${game.isVermeer ? '<span style="color:var(--gold)">★ VERMEER PICK</span>' : ''}
        </div>
    `).join('');
    
    // Auto-generate Poisson Grid for first game as POW
    if(data[0]) renderPoisson(data[0].xG_A, data[0].xG_B);
}

function renderPoisson(a, b) {
    const grid = document.getElementById('poisson-grid');
    for(let i=0; i<4; i++) {
        for(let j=0; j<4; j++) {
            const prob = ((Math.exp(-a)*Math.pow(a,i)/fact(i)) * (Math.exp(-b)*Math.pow(b,j)/fact(j)) * 100).toFixed(1);
            grid.innerHTML += `<div class="score-cell">${i}-${j}<br>${prob}%</div>`;
        }
    }
}
function fact(n) { return n<=1 ? 1 : n*fact(n-1); }
window.onload = loadData;
