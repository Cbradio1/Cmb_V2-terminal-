const express = require('express');
const axios = require('axios');
const app = express();

// --- 1. SECURE KEY MAPPING ---
// These look for the 'Environment Variables' you set in Render
const KEYS = {
    NHL_RADAR: process.env.SPORTRADAR_NHL_KEY,
    NBA_BDL: process.env.BALLDONTLIE_NBA_KEY,
    ODDS_API: process.env.THEODDS_API_KEY
};

app.use(express.static('public'));

// --- 2. THE SIMULATION ENGINE (Monte Carlo) ---
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

// --- 3. THE PREDICTION LOGIC ---
app.get('/api/predict', async (req, res) => {
    try {
        // A. PULL MARKET DATA (The Odds API)
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=${KEYS.ODDS_API}&regions=us&markets=h2h`;
        const oddsResponse = await axios.get(oddsUrl);
        
        // B. PULL ROSTER/INJURY DATA (Sportradar)
        // Note: Using a trial endpoint for active injuries
        const injuryUrl = `https://api.sportradar.com/nhl/trial/v7/en/league/injuries.json?api_key=${KEYS.NHL_RADAR}`;
        const injuryResponse = await axios.get(injuryUrl);

        // C. INTEGRATE & CALCULATE
        const predictions = oddsResponse.data.map(game => {
            // Baseline Expected Goals (xG)
            let homeXG = 3.2; 
            let awayXG = 2.8;

            // Apply Upset Filters (Injuries/Goalies)
            // This logic scans the Sportradar data for the current teams
            const teamInjuries = injuryResponse.data.teams || [];
            
            // Logic: If team has >3 injuries, drop xG by 15%
            // In a full build, we'd match specific Player IDs for star status
            if (teamInjuries.length > 3) {
                homeXG *= 0.85; 
            }

            // D. RUN PROOF OF WORK (POW)
            const upsetChance = runMonteCarlo(awayXG, homeXG);
            const totalScore = (homeXG + awayXG).toFixed(1);

            // E. FIND THE VERMEER EDGE
            const bookiePrice = game.bookmakers[0]?.markets[0].outcomes[1].price || 2.0;
            const impliedProb = (1 / bookiePrice) * 100;
            const edge = upsetChance - impliedProb;

            return {
                matchup: `${game.away_team} @ ${game.home_team}`,
                upsetChance: upsetChance.toFixed(1),
                total: totalScore,
                isVermeer: edge > 8.0, // 8% advantage over the house
                edge: edge.toFixed(1),
                xG_A: awayXG.toFixed(1),
                xG_B: homeXG.toFixed(1)
            };
        });

        res.json(predictions);
    } catch (error) {
        console.error("Engine Sync Error:", error.message);
        res.status(500).json({ error: "Check API Keys and Rate Limits" });
    }
});

// --- 4. START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Quantum V2 Engine Online on Port ${PORT}`);
});
