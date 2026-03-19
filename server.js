const express = require('express');
const axios = require('axios');
const path = require('path'); // Adds the ability to find your files
const app = express();

// --- 1. SECURE KEY MAPPING ---
const KEYS = {
    NHL_RADAR: process.env.SPORTRADAR_NHL_KEY,
    NBA_BDL: process.env.BALLDONTLIE_NBA_KEY,
    ODDS_API: process.env.THEODDS_API_KEY
};

// --- 2. FILE SERVING LOGIC (THE "FRONT DOOR") ---
// This tells the engine to serve your HTML, CSS, and JS files
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 3. THE SIMULATION ENGINE ---
function runMonteCarlo(awayXG, homeXG, iterations = 10000) {
    let awayWins = 0;
    for (let i = 0; i < iterations; i++) {
        if (generatePoisson(awayXG) > generatePoisson(homeXG)) awayWins++;
    }
    return (awayWins / iterations) * 100;
}

function generatePoisson(lambda) {
    let L = Math.exp(-lambda), p = 1.0, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

// --- 4. THE PREDICTION ENDPOINT ---
app.get('/api/predict', async (req, res) => {
    try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=${KEYS.ODDS_API}&regions=us&markets=h2h`;
        const oddsResponse = await axios.get(oddsUrl);
        
        const predictions = oddsResponse.data.map(game => {
            let homeXG = 3.2; 
            let awayXG = 2.8;

            const upsetChance = runMonteCarlo(awayXG, homeXG);
            const bookiePrice = game.bookmakers[0]?.markets[0].outcomes[1].price || 2.0;
            const impliedProb = (1 / bookiePrice) * 100;
            const edge = upsetChance - impliedProb;

            return {
                matchup: `${game.away_team} @ ${game.home_team}`,
                upsetChance: upsetChance.toFixed(1),
                total: (homeXG + awayXG).toFixed(1),
                isVermeer: edge > 8.0,
                edge: edge.toFixed(1),
                xG_A: awayXG.toFixed(1),
                xG_B: homeXG.toFixed(1)
            };
        });

        res.json(predictions);
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: "API limit or key issue" });
    }
});

// --- 5. START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Quantum V2 Online on Port ${PORT}`);
});
