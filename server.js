const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.static('public'));

// --- MATH ENGINE ---
function simulate(a, b) {
    let wins = 0;
    for(let i=0; i<10000; i++) {
        if (genP(a) > genP(b)) wins++;
    }
    return (wins/10000)*100;
}
function genP(l) { 
    let L = Math.exp(-l), p = 1.0, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

app.get('/api/predict', async (req, res) => {
    // 1. Fetch Roster/Injury Data from your Paid API
    // 2. Apply "Missing Player" Penalties (xG - 0.5 per star)
    // 3. Apply "Back-to-Back" Fatigue (xG * 0.95)
    
    const mockData = [{
        matchup: "NHL Underdog vs Favorite",
        xG_A: 2.8, xG_B: 2.4, // Calculated from Roster + Fatigue
        upsetChance: 0, total: 5.2, isVermeer: true, edge: 12.5
    }];

    mockData[0].upsetChance = simulate(mockData[0].xG_A, mockData[0].xG_B).toFixed(1);
    res.json(mockData);
});

app.listen(process.env.PORT || 3000);
