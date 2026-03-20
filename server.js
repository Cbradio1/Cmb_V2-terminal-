const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const KEYS = {
    NHL_RADAR: process.env.SPORTRADAR_NHL_KEY,
    NBA_BDL: process.env.BALLDONTLIE_NBA_KEY
};

// --- PROOF OF WORK: POWER RATINGS ---
// 1.0 is league average. This is the 'Signal' the model uses.
const NHL_RATINGS = {
    "Rangers": 1.15, "Bruins": 1.10, "Panthers": 1.12, "Hurricanes": 1.11,
    "Blue Jackets": 0.82, "Blackhawks": 0.80, "Ducks": 0.84, "Sharks": 0.78,
    "Islanders": 0.98, "Senators": 1.02, "Jets": 1.08, "Red Wings": 1.01
};

function getNHLRating(name) {
    for (let key in NHL_RATINGS) {
        if (name.includes(key)) return NHL_RATINGS[key];
    }
    return 1.0; 
}

// --- THE MATH: MONTE CARLO SIMULATION ---
function generatePoisson(lambda) {
    let L = Math.exp(-lambda), p = 1.0, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

function runSim(awayLambda, homeLambda) {
    let awayWins = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
        if (generatePoisson(awayLambda) > generatePoisson(homeLambda)) awayWins++;
    }
    return (awayWins / iterations) * 100;
}

app.use(express.static(path.join(__dirname)));

app.get('/api/predict', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const radarDate = today.replace(/-/g, '/');

        const [nhlResponse] = await Promise.all([
            axios.get(`https://api.sportradar.com/nhl/trial/v7/en/games/${radarDate}/schedule.json?api_key=${KEYS.NHL_RADAR}`).catch(() => ({data:{games:[]}}))
        ]);

        const games = nhlResponse.data.games || [];
        const results = games.map(g => {
            const aRating = getNHLRating(g.away.name);
            const hRating = getNHLRating(g.home.name);
            
            // Baseline: Away teams avg 2.9 goals, Home 3.2
            const prob = runSim(2.9 * aRating, 3.2 * hRating);

            return {
                matchup: `${g.away.name} @ ${g.home.name}`,
                sport: "NHL",
                source: "TRIANGULATION",
                upsetChance: prob.toFixed(1),
                isVermeer: prob > 43.5 // Only flags if the math shows a real edge
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "API Sync Failure" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Master Engine Online on Port ${PORT}`));
