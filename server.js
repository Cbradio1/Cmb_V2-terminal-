const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

const KEYS = {
    NHL: process.env.SPORTRADAR_NHL_KEY,
    NBA: process.env.BALLDONTLIE_NBA_KEY,
    ODDS: process.env.ODDS_API_KEY
};

app.use(express.static(path.join(__dirname)));

// --- MATH CORE ---
function generatePoisson(lambda) {
    const L = Math.exp(-lambda);
    let p = 1.0, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

function runSim(dogL, favL, spread = 0, injuryPenalty = 0) {
    let dogWins = 0;
    const adjFavL = favL * (1 - injuryPenalty); 
    for (let i = 0; i < 10000; i++) {
        if (generatePoisson(dogL) + Math.abs(spread) > generatePoisson(adjFavL)) dogWins++;
    }
    return (dogWins / 10000) * 100;
}

// --- ROSTER/INJURY SIGNAL ---
async function getInjuryData(sport, teamId) {
    try {
        if (sport === 'NHL') {
            const res = await axios.get(`https://api.sportradar.com/nhl/trial/v7/en/teams/${teamId}/profile.json?api_key=${KEYS.NHL}`);
            const out = res.data.players.filter(p => p.status === 'INJURED' || p.status === 'OUT');
            return { penalty: out.length > 2 ? 0.12 : 0, list: out.map(p => p.full_name).slice(0, 3) };
        }
        return { penalty: 0, list: [] };
    } catch { return { penalty: 0, list: [] }; }
}

app.get('/api/predict', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [nhlSch, nbaSch, nhlOdds, nbaOdds] = await Promise.all([
            axios.get(`https://api.sportradar.com/nhl/trial/v7/en/games/${today.replace(/-/g, '/')}/schedule.json?api_key=${KEYS.NHL}`).catch(() => ({data:{games:[]}})),
            axios.get(`https://api.balldontlie.io/v1/games?dates[]=${today}`, { headers: {'Authorization': KEYS.NBA} }).catch(() => ({data:{data:[]}})),
            axios.get(`https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds?apiKey=${KEYS.ODDS}&regions=us&markets=spreads,totals`).catch(() => ({data:[]})),
            axios.get(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${KEYS.ODDS}&regions=us&markets=spreads,totals`).catch(() => ({data:[]}))
        ]);

        const results = [];

        for (const g of nhlSch.data.games || []) {
            const mkt = nhlOdds.data.find(o => o.home_team.includes(g.home.name));
            const spread = mkt?.bookmakers[0]?.markets.find(m => m.key === 'spreads')?.outcomes.find(o => o.name === g.home.name)?.point || 0;
            const total = mkt?.bookmakers[0]?.markets.find(m => m.key === 'totals')?.outcomes[0]?.point || 6;
            
            const injuries = await getInjuryData('NHL', g.home.id);
            const prob = runSim(total/2, total/2, spread, injuries.penalty);

            results.push({
                matchup: `${g.away.name} @ ${g.home.name}`,
                sport: 'NHL',
                upsetChance: prob.toFixed(1),
                liveOdds: `${spread > 0 ? '+' : ''}${spread}`,
                rosterAlert: injuries.list.length ? `OUT: ${injuries.list.join(', ')}` : "ROSTER CLEAN",
                isVermeer: prob > 43.5
            });
        }
        res.json({ games: results });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Quantum V2 Online on ${PORT}`));

