const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// --- API KEYS (Pulled from Render Environment Variables) ---
const KEYS = {
    NHL_RADAR: process.env.SPORTRADAR_NHL_KEY,
    NBA_BDL: process.env.BALLDONTLIE_NBA_KEY
};

// --- SIGNAL LOGIC: POWER RATINGS (PR) ---
// 1.0 is league average. Used to shift the Poisson Lambda.
const NHL_RATINGS = {
    "Rangers": 1.14, "Bruins": 1.10, "Panthers": 1.12, "Hurricanes": 1.11,
    "Avalanche": 1.13, "Stars": 1.10, "Canucks": 1.08, "Jets": 1.07,
    "Islanders": 0.98, "Senators": 0.96, "Blue Jackets": 0.85, "Blackhawks": 0.82,
    "Ducks": 0.84, "Sharks": 0.79, "Canadiens": 0.91, "Flyers": 0.94
};

function getRating(name) {
    for (let key in NHL_RATINGS) {
        if (name.includes(key)) return NHL_RATINGS[key];
    }
    return 1.0; 
}

// --- MATH CORE: POISSON & MONTE CARLO ---
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

        const [nhl] = await Promise.all([
            axios.get(`https://api.sportradar.com/nhl/trial/v7/en/games/${radarDate}/schedule.json?api_key=${KEYS.NHL_RADAR}`).catch(() => ({data:{games:[]}}))
        ]);

        const picks = (nhl.data.games || []).map(g => {
            const aRating = getRating(g.away.name);
            const hRating = getRating(g.home.name);
            
            // Baseline: Away 2.9, Home 3.2. Weighted by Power Ratings.
            const prob = runSim(2.9 * aRating, 3.2 * hRating);

            return {
                matchup: `${g.away.name} @ ${g.home.name}`,
                sport: "NHL",
                source: "TRIANGULATION",
                upsetChance: prob.toFixed(1),
                isVermeer: prob > 44.0 
            };
        });

        res.json(picks);
    } catch (err) {
        res.status(500).json({ error: "Sync Failure" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Master Engine Online on Port ${PORT}`));

