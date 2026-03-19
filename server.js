app.get('/api/predict', async (req, res) => {
    try {
        const API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';
        const BASE_URL = 'https://api.sportsdata.io/v3/nhl/scores/json/GamesByDate/2026-MAR-19';

        // 1. Fetch Live Games & Odds
        const response = await axios.get(`${BASE_URL}?key=${API_KEY}`);
        const games = response.data;

        const livePredictions = games.map(game => {
            // 2. RAW STATS (Pace & Efficiency)
            let homeXG = game.HomeTeamAverageGoals || 3.0;
            let awayXG = game.AwayTeamAverageGoals || 2.8;

            // 3. INJURY & ROSTER CHECK (The Upset Logic)
            // If a star is out, we shave 0.5 off their expected goals
            if (game.HomeTeamInjuryCount > 2) homeXG -= 0.6;
            if (game.AwayTeamInjuryCount > 2) awayXG -= 0.6;

            // 4. THE GOALIE FACTOR (NHL Specific)
            // If the backup is in, the opponent's xG goes UP
            if (game.HomeTeamStartingGoalie === "Backup") awayXG += 0.75;
            if (game.AwayTeamStartingGoalie === "Backup") homeXG += 0.75;

            // 5. RUN THE SIMULATION (Proof of Work)
            const upsetChance = simulate(awayXG, homeXG).toFixed(1);
            const total = (homeXG + awayXG).toFixed(1);

            // 6. FIND THE VERMEER EDGE
            // (Your Prob vs Sportsbook Prob)
            const impliedProb = 100 / (game.AwayTeamMoneyLine + 100) * 100;
            const edge = (upsetChance - impliedProb).toFixed(1);

            return {
                matchup: `${game.AwayTeam} @ ${game.HomeTeam}`,
                xG_A: awayXG,
                xG_B: homeXG,
                upsetChance: upsetChance,
                total: total,
                isVermeer: edge > 7.5, // 7.5% edge is our "Gold" threshold
                edge: edge
            };
        });

        res.json(livePredictions);
    } catch (error) {
        console.error("API Sync Error:", error);
        res.status(500).json({ error: "Failed to fetch live roster data" });
    }
});
