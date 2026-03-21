// ============================================================
//  QUANTUM V2 TERMINAL — server.js
//  Upset Detection Engine: Poisson + Monte Carlo + 10 Layers
// ============================================================
const express = require('express');
const path    = require('path');
const axios   = require('axios');

const app  = express();
const PORT = process.env.PORT || 10000;

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_BASE    = 'https://api.the-odds-api.com/v4';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const SPORT_MAP = {
  nba:    'basketball_nba',
  nfl:    'americanfootball_nfl',
  mlb:    'baseball_mlb',
  nhl:    'icehockey_nhl',
  ncaab:  'basketball_ncaab',
  ncaaf:  'americanfootball_ncaaf',
};

// --- CORE MATH ---
function poisson(k, lambda) {
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial;
}

function generatePoisson(lambda) {
  const L = Math.exp(-lambda);
  let p = 1.0, k = 0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function runMonteCarlo(teamAvg, opponentAvg, spread = 0) {
  let upsetWins = 0, pushes = 0;
  const ITERATIONS = 10000;
  for (let i = 0; i < ITERATIONS; i++) {
    const scoreA = generatePoisson(teamAvg);
    const scoreB = generatePoisson(opponentAvg);
    const margin = scoreA - scoreB;
    if (margin + spread > 0)  upsetWins++;
    else if (margin + spread === 0) pushes++;
  }
  return {
    winRate: parseFloat(((upsetWins / ITERATIONS) * 100).toFixed(2)),
    pushRate: parseFloat(((pushes / ITERATIONS) * 100).toFixed(2)),
    lossRate: parseFloat((((ITERATIONS - upsetWins - pushes) / ITERATIONS) * 100).toFixed(2)),
    iterations: ITERATIONS,
  };
}

function buildScoreMatrix(lambdaA, lambdaB, cap = 15) {
  const matrix = [];
  let hWin = 0, aWin = 0, draw = 0;
  for (let a = 0; a <= cap; a++) {
    for (let b = 0; b <= cap; b++) {
      const prob = poisson(a, lambdaA) * poisson(b, lambdaB);
      matrix.push({ scoreA: a, scoreB: b, prob: parseFloat(prob.toFixed(6)) });
      if (a > b) hWin += prob;
      if (b > a) aWin += prob;
      if (a === b) draw += prob;
    }
  }
  return {
    matrix: matrix.sort((a, b) => b.prob - a.prob).slice(0, 20),
    homeWinProb: parseFloat((hWin * 100).toFixed(2)),
    awayWinProb: parseFloat((aWin * 100).toFixed(2)),
    drawProb: parseFloat((draw * 100).toFixed(2)),
  };
}

function deriveLambdas(total, spread) {
  const base = total / 2;
  const adjustment = spread / 2;
  return {
    home: Math.max(0.1, base - adjustment),
    away: Math.max(0.1, base + adjustment),
  };
}

function impliedProb(americanOdds) {
  if (!americanOdds) return 0.5;
  return americanOdds < 0
    ? Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
    : 100 / (americanOdds + 100);
}

function kelly(trueProbPct, americanOdds) {
  if (!americanOdds) return { full: 0, half: 0, edge: 0 };
  const decimal = americanOdds > 0 ? (americanOdds / 100) + 1 : (100 / Math.abs(americanOdds)) + 1;
  const b = decimal - 1, p = trueProbPct / 100, q = 1 - p;
  const k = ((b * p) - q) / b;
  const edge = ((p - (1 / decimal)) * 100);
  return {
    full: parseFloat((k * 100).toFixed(2)),
    half: parseFloat((Math.max(0, k / 2) * 100).toFixed(2)),
    edge: parseFloat(edge.toFixed(2)),
  };
}

// --- 10-LAYER TRIANGULATION ---
function runSignalLayers(game, mcResult, poissonData) {
  const signals = [];
  
  // Layer Logic (Movement, Poisson, PR, Volatility, etc.)
  const marketUnderdogProb = impliedProb(game.awayML) * 100;
  const divergence = mcResult.winRate - marketUnderdogProb;

  const config = [
    { name: 'ODDS MOVEMENT', weight: 9, sig: (game.spreadMove > 0.5) ? 1 : 0 },
    { name: 'POISSON DIV.', weight: 10, sig: (divergence > 5) ? 1 : 0 },
    { name: 'PR DELTA', weight: 8, sig: (game.lambdas.home - game.lambdas.away < -2) ? 1 : 0 },
    { name: 'VOLATILITY', weight: 7, sig: (Math.sqrt((game.lambdas.home + game.lambdas.away)/2) > 10) ? 1 : 0 },
    { name: 'INJURY/ROSTER', weight: 8, sig: game.injuryFlag || 0 },
    { name: 'FATIGUE', weight: 6, sig: game.fatigueFlag || 0 },
    { name: 'H2H HISTORY', weight: 5, sig: game.h2hFlag || 0 },
    { name: 'ANOMALY', weight: 9, sig: game.anomalyFlag || 0 },
    { name: 'SENTIMENT', weight: 7, sig: (game.publicPct >= 70) ? 1 : 0 },
    { name: 'MC CONFIDENCE', weight: 10, sig: (mcResult.winRate > 40) ? 1 : 0 }
  ];

  config.forEach(c => signals.push({ layer: c.name, signal: c.sig, weight: c.weight }));

  const max = signals.reduce((s, l) => s + l.weight, 0);
  const raw = signals.reduce((s, l) => s + (l.signal * l.weight), 0);
  const normalized = parseFloat((((raw + max) / (2 * max)) * 100).toFixed(1));

  return { signals, upsetScore: normalized, isUpset: normalized >= 62, divergence };
}

async function fetchAndAnalyze(sportKey) {
  const url = `${ODDS_BASE}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
  const res = await axios.get(url);
  return res.data.map(event => {
    const bm = event.bookmakers?.[0];
    const h2h = bm?.markets?.find(m => m.key === 'h2h');
    const spreads = bm?.markets?.find(m => m.key === 'spreads');
    const totals = bm?.markets?.find(m => m.key === 'totals');

    const homeML = h2h?.outcomes?.find(o => o.name === event.home_team)?.price ?? null;
    const awayML = h2h?.outcomes?.find(o => o.name !== event.home_team)?.price ?? null;
    const spread = spreads?.outcomes?.find(o => o.name === event.home_team)?.point ?? 0;
    const total = totals?.outcomes?.[0]?.point ?? 0;

    const dogIsHome = homeML > awayML;
    const dogML = dogIsHome ? homeML : awayML;
    const lambdas = deriveLambdas(total, spread);
    const mc = runMonteCarlo(dogIsHome ? lambdas.home : lambdas.away, dogIsHome ? lambdas.away : lambdas.home, Math.abs(spread));
    const poissonData = buildScoreMatrix(lambdas.home, lambdas.away, 15);
    
    const gameData = { ...event, homeML, awayML, spread, total, lambdas, publicPct: 70, spreadMove: 0.6 };
    const analysis = runSignalLayers(gameData, mc, poissonData);

    return {
      matchup: `${event.away_team} @ ${event.home_team}`,
      sport: sportKey,
      dogML,
      monteCarlo: mc,
      poisson: poissonData,
      upsetScore: analysis.upsetScore,
      isUpset: analysis.isUpset,
      kelly: kelly(mc.winRate, dogML),
      impliedDogProb: impliedProb(dogML) * 100
    };
  });
}

app.get('/api/predict', async (req, res) => {
  try {
    const leagues = ['nba', 'nhl', 'mlb'].map(l => SPORT_MAP[l]);
    const results = await Promise.all(leagues.map(fetchAndAnalyze));
    const games = results.flat().sort((a, b) => b.upsetScore - a.upsetScore);
    res.json({ games });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Quantum V2 Master Engine Online on Port ${PORT}`));
                                                     
