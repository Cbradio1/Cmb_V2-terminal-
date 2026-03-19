const express = require('express');
const axios = require('axios');
const app = express();

// --- 1. YOUR SECURE KEYS ---
const KEYS = {
    NHL_RADAR: "ukJQ0R5KKhbDHKvNy1hj3iAeIaPdNmaD2TqxjeLH",
    NBA_BDL: "7f3d9f97-3ed7-4383-912a-becaf2e6b185",
    ODDS_API: "316f4e7f81b5a5003b3038895f55716d"
};

app.use(express.static('public'));

// --- 2. MATH CORE (Monte Carlo & Poisson) ---
function runSim(a, b) {
    let wins = 0;
    for(let i=0; i<10000; i++) { if (genP(a) > genP(b)) wins++; }
    return (wins/10000)*100;
}
function genP(l) { 
    let L = Math.exp(-l), p = 1.0, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

// --- 3. THE PREDICTION ENDPOINT ---
app.get('/api/predict', async (req, res) => {
    try {
        // A. GET MARKET ODDS (The Odds API)
        const oddsRes = await axios.get(`https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=${KEYS.ODDS_API}&regions=us&markets=h2h`);
        
        // B. GET NHL INJURIES (Sportradar)
        // Note: In a real deploy, we'd map game IDs between APIs
        const radarRes = await axios.get(`https://api.sportradar.com/nhl/trial/v7/en/league/injuries.json?api_key=${KEYS.NHL_RADAR}`);

        const results = oddsRes.data.map(game => {
            let homeXG = 3.1; // League Baseline
            let awayXG = 2.9;

            // C. APPLY THE "VERMEER" LOGIC
            // Here we would loop through radarRes.data to find injuries for these teams
            // For now, we apply a placeholder penalty if the API finds a match
            const homeInjuries = 2; // This would be dynamic from Sportradar
            if (homeInjuries > 1) homeXG -= 0.45; 

            const upsetChance = runSim(awayXG, homeXG);
            
            // D. CALCULATE THE EDGE
            const bookieOdds = game.bookmakers[0]?.markets[0].outcomes[1].price || 2.0;
            const impliedProb = (1 / bookieOdds) * 100;
            const edge = upsetChance - impliedProb;

            return {
                matchup: `${game.away_team} @ ${game.home_team}`,
                upsetChance: upsetChance.toFixed(1),
                total: (homeXG + awayXG).toFixed(1),
                isVermeer: edge > 8.5,
                edge: edge.toFixed(1),
                xG_A: awayXG,
                xG_B: homeXG
            };
        });

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send("Engine Sync Error");
    }
});

app.listen(process.env.PORT || 3000);
