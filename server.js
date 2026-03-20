const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const KEYS = {
    NHL_RADAR: process.env.SPORTRADAR_NHL_KEY,
    NBA_BDL: process.env.BALLDONTLIE_NBA_KEY   // Scaffolded — restore Promise.all when NBA is re-enabled
};

// --- POWER RATINGS ---
// 1.0 = league average. Used as Poisson lambda multipliers.
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

// --- MONTE CARLO / POISSON ENGINE ---
// generatePoisson: returns a random integer drawn from Poisson(lambda)
// Uses the Knuth algorithm — exact for lambda < ~700
function generatePoisson(lambda) {
    let L = Math.exp(-lambda), p = 1.0, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

// runSim: returns P(away wins in regulation) as a percentage
// Baseline: away avg 2.9 goals/game, home 3.2 (home-ice advantage)
// Note: OT/SO (~24% of NHL games) acts as a near-coin-flip and isn't modeled separately.
//       These probabilities reflect regulation-period edge only.
function runSim(awayLambda, homeLambda, iterations = 10000) {
    let awayWins = 0;
    for (let i = 0; i < iterations; i++) {
        if (generatePoisson(awayLambda) > generatePoisson(homeLambda)) awayWins++;
    }
    return (awayWins / iterations) * 100;
}

// --- STATIC SERVING ---
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- PREDICTION ENDPOINT ---
// Returns enriched game objects including lambda values for POISSON tab rendering
app.get('/api/predict', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const radarDate = today.replace(/-/g, '/');

        const nhlResponse = await axios
            .get(`https://api.sportradar.com/nhl/trial/v7/en/games/${radarDate}/schedule.json?api_key=${KEYS.NHL_RADAR}`)
            .catch(() => ({ data: { games: [] } }));

        const games = nhlResponse.data.games || [];

        const results = games.map(g => {
            const aRating = getNHLRating(g.away.name);
            const hRating = getNHLRating(g.home.name);
            const awayLambda = parseFloat((2.9 * aRating).toFixed(3));
            const homeLambda = parseFloat((3.2 * hRating).toFixed(3));
            const prob = runSim(awayLambda, homeLambda);
            const ratingEdge = parseFloat((aRating - hRating).toFixed(3));

            // isVermeer: away team is genuinely favored despite home-ice disadvantage.
            // Requires both a meaningful rating edge (>0.08) AND the sim to agree (>50%).
            // This filters out noise — a "Vermeer" is a real, model-confirmed upset pick.
            const isVermeer = ratingEdge > 0.08 && prob > 50.0;

            return {
                matchup: `${g.away.name} @ ${g.home.name}`,
                away: g.away.name,
                home: g.home.name,
                sport: "NHL",
                source: "TRIANGULATION",
                awayLambda,
                homeLambda,
                awayRating: aRating,
                homeRating: hRating,
                ratingEdge,
                upsetChance: prob.toFixed(1),
                isVermeer
            };
        });

        res.json(results);
    } catch (err) {
        console.error('Prediction engine failure:', err.message);
        res.status(500).json({ error: "API Sync Failure" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Quantum V2 Master Engine Online — Port ${PORT}`));
                
