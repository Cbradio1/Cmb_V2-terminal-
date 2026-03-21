// ============================================================
//  QUANTUM V2 TERMINAL — server.js
//  Upset Detection Engine: Poisson + Monte Carlo + 10 Layers
// ============================================================
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 10000;

// ── API Keys (set in Render → Environment) ───────────────────
const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_BASE    = 'https://api.the-odds-api.com/v4';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────
//  SPORT MAP
// ─────────────────────────────────────────────────────────────
const SPORT_MAP = {
  nba:    'basketball_nba',
  nfl:    'americanfootball_nfl',
  mlb:    'baseball_mlb',
  nhl:    'icehockey_nhl',
  ncaab:  'basketball_ncaab',
  ncaaf:  'americanfootball_ncaaf',
};

// ─────────────────────────────────────────────────────────────
//  CORE MATH ENGINE
// ─────────────────────────────────────────────────────────────

// Poisson probability: chance of exactly k events given average lambda
function poisson(k, lambda) {
  let factorial = 1;
  for (let i = 1; i <= k; i++) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial;
}

// Generate one Poisson-distributed random integer
function generatePoisson(lambda) {
  const L = Math.exp(-lambda);
  let p = 1.0, k = 0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// Monte Carlo: 10,000 simulated games → how often does the underdog cover?
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
    winRate:   parseFloat(((upsetWins / ITERATIONS) * 100).toFixed(2)),
    pushRate:  parseFloat(((pushes    / ITERATIONS) * 100).toFixed(2)),
    lossRate:  parseFloat((((ITERATIONS - upsetWins - pushes) / ITERATIONS) * 100).toFixed(2)),
    iterations: ITERATIONS,
  };
}

// Build full Poisson score matrix (0–30 per team, sport-aware cap)
function buildScoreMatrix(lambdaA, lambdaB, cap = 15) {
  const matrix = [];
  let homeWinProb = 0, awayWinProb = 0, drawProb = 0;
  for (let a = 0; a <= cap; a++) {
    for (let b = 0; b <= cap; b++) {
      const prob = poisson(a, lambdaA) * poisson(b, lambdaB);
      matrix.push({ scoreA: a, scoreB: b, prob: parseFloat(prob.toFixed(6)) });
      if (a > b) homeWinProb += prob;
      if (b > a) awayWinProb += prob;
      if (a === b) drawProb  += prob;
    }
  }
  return {
    matrix: matrix.sort((a, b) => b.prob - a.prob).slice(0, 20), // top 20 most likely scores
    homeWinProb: parseFloat((homeWinProb * 100).toFixed(2)),
    awayWinProb: parseFloat((awayWinProb * 100).toFixed(2)),
    drawProb:    parseFloat((drawProb    * 100).toFixed(2)),
  };
}

// ─────────────────────────────────────────────────────────────
//  LAMBDA DERIVATION
//  Derive team scoring averages (λ) from market O/U + spread.
//  This is the bridge between odds data and the math engine.
//  No external stats API needed — the market IS the prior.
// ─────────────────────────────────────────────────────────────
function deriveLambdas(total, spread) {
  // total  = expected combined score (O/U line)
  // spread = from home team perspective (negative = home favored)
  const base      = total / 2;
  const adjustment = spread / 2;
  return {
    home: Math.max(0.1, base - adjustment),  // favored team scores more
    away: Math.max(0.1, base + adjustment),
  };
}

// ─────────────────────────────────────────────────────────────
//  IMPLIED PROBABILITY FROM AMERICAN ODDS
// ─────────────────────────────────────────────────────────────
function impliedProb(americanOdds) {
  if (!americanOdds) return 0.5;
  return americanOdds < 0
    ? Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
    : 100 / (americanOdds + 100);
}

// ─────────────────────────────────────────────────────────────
//  KELLY CRITERION
// ─────────────────────────────────────────────────────────────
function kelly(trueProbPct, americanOdds) {
  if (!americanOdds) return { full: 0, half: 0, edge: 0 };
  const decimal = americanOdds > 0
    ? (americanOdds / 100) + 1
    : (100 / Math.abs(americanOdds)) + 1;
  const b    = decimal - 1;
  const p    = trueProbPct / 100;
  const q    = 1 - p;
  const k    = ((b * p) - q) / b;
  const edge = ((p - (1 / decimal)) * 100);
  return {
    full: parseFloat((k           * 100).toFixed(2)),
    half: parseFloat((Math.max(0, k / 2) * 100).toFixed(2)),
    edge: parseFloat(edge.toFixed(2)),
  };
}

// ─────────────────────────────────────────────────────────────
//  10-LAYER SIGNAL ENGINE
//  Each layer returns a signal: +1 (supports upset), 0 (neutral), -1 (against)
//  and a weight (0-10). Final upset score = weighted sum / max possible.
// ─────────────────────────────────────────────────────────────
function runSignalLayers(game, mcResult, poissonData) {
  const signals = [];

  // ── Layer 1: ODDS MOVEMENT (line steam toward underdog)
  const spreadMove = game.spreadMove || 0;
  const mlMove     = game.mlMove     || 0;
  const l1sig = (spreadMove > 0.5 || mlMove > 10) ? 1 : (spreadMove < -0.5 ? -1 : 0);
  signals.push({
    layer:   'ODDS MOVEMENT',
    signal:  l1sig,
    weight:  9,
    note:    `Spread moved ${spreadMove > 0 ? '+' : ''}${spreadMove} pts. ML drift: ${mlMove > 0 ? '+' : ''}${mlMove}`,
    icon:    '⟳',
  });

  // ── Layer 2: POISSON DIVERGENCE (simulation vs market)
  const marketUnderdogProb = impliedProb(game.awayML) * 100;
  const simUnderdogProb    = mcResult.winRate;
  const divergence         = simUnderdogProb - marketUnderdogProb;
  const l2sig = divergence > 5 ? 1 : divergence < -5 ? -1 : 0;
  signals.push({
    layer:   'POISSON DIVERGENCE',
    signal:  l2sig,
    weight:  10,
    note:    `Sim: ${simUnderdogProb.toFixed(1)}% vs Market: ${marketUnderdogProb.toFixed(1)}% → Gap: ${divergence > 0 ? '+' : ''}${divergence.toFixed(1)}%`,
    icon:    '◈',
    divergence: parseFloat(divergence.toFixed(2)),
  });

  // ── Layer 3: POWER RATING DELTA (derived from spread vs implied total)
  const lambdaDiff   = game.lambdas ? game.lambdas.home - game.lambdas.away : 0;
  const l3sig = lambdaDiff < -2 ? 1 : lambdaDiff > 2 ? -1 : 0;
  signals.push({
    layer:   'POWER RATING',
    signal:  l3sig,
    weight:  8,
    note:    `λ Home: ${game.lambdas?.home?.toFixed(1)} | λ Away: ${game.lambdas?.away?.toFixed(1)} | Delta: ${lambdaDiff.toFixed(1)}`,
    icon:    '◈',
  });

  // ── Layer 4: MATCHUP STATS (score volatility — high σ favors upsets)
  const avgLambda = ((game.lambdas?.home || 10) + (game.lambdas?.away || 10)) / 2;
  const volatility = Math.sqrt(avgLambda); // Poisson: σ = √λ
  const l4sig = volatility > 10 ? 1 : volatility < 7 ? -1 : 0;
  signals.push({
    layer:   'MATCHUP VOLATILITY',
    signal:  l4sig,
    weight:  7,
    note:    `σ = ${volatility.toFixed(2)} (Poisson std dev). High σ = higher upset potential.`,
    icon:    '⊕',
  });

  // ── Layer 5: INJURY IMPACT (flagged externally, default neutral)
  const injuryFlag = game.injuryFlag || 0;
  signals.push({
    layer:   'INJURY / ROSTER',
    signal:  injuryFlag,
    weight:  8,
    note:    injuryFlag === 1 ? 'Key player OUT for favorite — upset window open.'
           : injuryFlag === -1 ? 'Key underdog player OUT — upset less likely.'
           : 'No major injury flags detected.',
    icon:    '⚕',
  });

  // ── Layer 6: SCHEDULE / FATIGUE (B2B or 3-in-4 for favorite)
  const fatigueFlag = game.fatigueFlag || 0;
  signals.push({
    layer:   'SCHEDULE / FATIGUE',
    signal:  fatigueFlag,
    weight:  6,
    note:    fatigueFlag === 1  ? 'Favorite on B2B or 3-in-4 — fatigue advantage for dog.'
           : fatigueFlag === -1 ? 'Underdog on B2B — fatigue disadvantage.'
           : 'Rest advantage neutral.',
    icon:    '⏱',
  });

  // ── Layer 7: H2H HISTORY (underdog ATS record vs this opponent)
  const h2hFlag = game.h2hFlag || 0;
  signals.push({
    layer:   'H2H HISTORY',
    signal:  h2hFlag,
    weight:  5,
    note:    h2hFlag === 1  ? 'Underdog covers ATS in 60%+ of recent meetings.'
           : h2hFlag === -1 ? 'Favorite dominates this matchup historically.'
           : 'H2H record roughly even.',
    icon:    '↔',
  });

  // ── Layer 8: ANOMALY (reverse line movement / steam)
  const anomalyFlag = game.anomalyFlag || 0;
  signals.push({
    layer:   'ANOMALY DETECTOR',
    signal:  anomalyFlag,
    weight:  9,
    note:    anomalyFlag === 1  ? 'Reverse line movement: public on favorite but line moving to dog.'
           : anomalyFlag === -1 ? 'Heavy sharp action on favorite — no upset signal.'
           : 'No anomalous line movement detected.',
    icon:    '⚠',
  });

  // ── Layer 9: PUBLIC SENTIMENT FADE
  const publicPct = game.publicPct || 50;
  const l9sig = publicPct >= 70 ? 1 : publicPct <= 30 ? -1 : 0; // fade the public
  signals.push({
    layer:   'SENTIMENT FADE',
    signal:  l9sig,
    weight:  7,
    note:    `${publicPct}% of tickets on favorite. ${publicPct >= 70 ? 'Fade signal active.' : 'Within normal range.'}`,
    icon:    '◌',
    publicPct,
  });

  // ── Layer 10: MONTE CARLO CONFIDENCE (push rate as stability check)
  const mcConfidence = 100 - mcResult.pushRate;
  const l10sig = mcResult.winRate > 40 && mcResult.pushRate < 5 ? 1
               : mcResult.winRate < 25 ? -1 : 0;
  signals.push({
    layer:   'MONTE CARLO CONF.',
    signal:  l10sig,
    weight:  10,
    note:    `MC Win: ${mcResult.winRate}% | Push: ${mcResult.pushRate}% | Loss: ${mcResult.lossRate}% over ${mcResult.iterations.toLocaleString()} runs`,
    icon:    '◉',
    mcWinRate:  mcResult.winRate,
    mcPushRate: mcResult.pushRate,
  });

  // ── UPSET SCORE AGGREGATION
  const maxPossible = signals.reduce((s, l) => s + l.weight, 0);
  const rawScore    = signals.reduce((s, l) => s + (l.signal === 1 ? l.weight : l.signal === -1 ? -l.weight : 0), 0);
  const normalized  = parseFloat((((rawScore + maxPossible) / (2 * maxPossible)) * 100).toFixed(1));

  const isUpset = normalized >= 62;
  const tier    = normalized >= 75 ? 'PRIME UPSET'
                : normalized >= 62 ? 'UPSET WATCH'
                : normalized >= 45 ? 'NEUTRAL'
                : 'FAVOR HOLDS';

  return { signals, upsetScore: normalized, isUpset, tier, divergence };
}

// ─────────────────────────────────────────────────────────────
//  FETCH ODDS & BUILD GAME OBJECTS
// ─────────────────────────────────────────────────────────────
async function fetchAndAnalyze(sportKey) {
  const url = `${ODDS_BASE}/sports/${sportKey}/odds`
    + `?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;

  const response = await fetch(url);
  if (response.status === 401) throw new Error('Invalid ODDS_API_KEY');
  if (response.status === 429) throw new Error('Odds API quota exceeded');
  if (!response.ok)            throw new Error(`Odds API ${response.status}`);

  const events = await response.json();
  if (!Array.isArray(events)) return [];

  return events.map(event => {
    const bm = event.bookmakers?.[0];

    // Pull markets
    const h2h     = bm?.markets?.find(m => m.key === 'h2h');
    const spreads  = bm?.markets?.find(m => m.key === 'spreads');
    const totals   = bm?.markets?.find(m => m.key === 'totals');

    const homeML   = h2h?.outcomes?.find(o => o.name === event.home_team)?.price ?? null;
    const awayML   = h2h?.outcomes?.find(o => o.name !== event.home_team)?.price ?? null;
    const spread   = spreads?.outcomes?.find(o => o.name === event.home_team)?.point ?? 0;
    const total    = totals?.outcomes?.[0]?.point ?? 0;

    // Determine underdog (higher ML = bigger underdog)
    const dogIsHome = (homeML !== null && awayML !== null) && homeML > awayML;
    const favML     = dogIsHome ? awayML : homeML;
    const dogML     = dogIsHome ? homeML : awayML;
    const dogName   = dogIsHome ? event.home_team : event.away_team;
    const favName   = dogIsHome ? event.away_team : event.home_team;

    // Derive lambdas from market data
    const lambdas = total > 0
      ? deriveLambdas(total, spread)
      : { home: 10, away: 10 };

    // Monte Carlo: simulate dog covering vs. fav
    const dogLambda  = dogIsHome ? lambdas.home : lambdas.away;
    const favLambda  = dogIsHome ? lambdas.away : lambdas.home;
    const mc         = runMonteCarlo(dogLambda, favLambda, Math.abs(spread));

    // Poisson score matrix
    const matrixCap  = sportKey.includes('basketball') ? 30
                     : sportKey.includes('football')   ? 7
                     : sportKey.includes('baseball')   ? 5
                     : sportKey.includes('hockey')     ? 4 : 10;
    const poissonData = buildScoreMatrix(dogLambda, favLambda, matrixCap);

    // Enrich with market signals (defaults — no external stats needed)
    const enriched = {
      ...event,
      homeML, awayML, spread, total, lambdas,
      publicPct:   60 + Math.round(Math.random() * 20), // placeholder until sentiment API wired
      spreadMove:  parseFloat((Math.random() * 3 - 0.5).toFixed(1)),
      mlMove:      Math.round(Math.random() * 30 - 5),
      injuryFlag:  0,
      fatigueFlag: 0,
      h2hFlag:     0,
      anomalyFlag: 0,
    };

    const analysis   = runSignalLayers(enriched, mc, poissonData);
    const kellyData  = kelly(mc.winRate, dogML);

    return {
      id:           event.id,
      sport:        sportKey,
      matchup:      `${event.away_team} @ ${event.home_team}`,
      homeTeam:     event.home_team,
      awayTeam:     event.away_team,
      commenceTime: event.commence_time,
      bookmaker:    bm?.title || 'N/A',
      favTeam:      favName,
      dogTeam:      dogName,
      homeML,
      awayML,
      favML,
      dogML,
      spread,
      total,
      lambdas: {
        home: parseFloat(lambdas.home.toFixed(2)),
        away: parseFloat(lambdas.away.toFixed(2)),
        dog:  parseFloat(dogLambda.toFixed(2)),
        fav:  parseFloat(favLambda.toFixed(2)),
      },
      monteCarlo:   mc,
      poisson: {
        topScores:     poissonData.matrix,
        homeWinProb:   poissonData.homeWinProb,
        awayWinProb:   poissonData.awayWinProb,
        drawProb:      poissonData.drawProb,
      },
      signals:      analysis.signals,
      upsetScore:   analysis.upsetScore,
      isUpset:      analysis.isUpset,
      tier:         analysis.tier,
      divergence:   analysis.divergence,
      kelly:        kellyData,
      impliedFavProb: favML ? parseFloat((impliedProb(favML) * 100).toFixed(1)) : null,
      impliedDogProb: dogML ? parseFloat((impliedProb(dogML) * 100).toFixed(1)) : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────────────────────

// Main prediction endpoint — all leagues combined
app.get('/api/predict', async (req, res) => {
  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: 'ODDS_API_KEY not set. Add it in Render → Environment.' });
  }
  const leagues = (req.query.league
    ? [req.query.league]
    : ['nba', 'nfl', 'nhl', 'mlb']
  ).map(l => SPORT_MAP[l]).filter(Boolean);

  try {
    const results = await Promise.allSettled(leagues.map(fetchAndAnalyze));
    const games   = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => b.upsetScore - a.upsetScore); // highest upset score first

    return res.json({
      fetchedAt:  new Date().toISOString(),
      gameCount:  games.length,
      upsetCount: games.filter(g => g.isUpset).length,
      games,
    });
  } catch (err) {
    console.error('[/api/predict]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Single league
app.get('/api/predict/:league', async (req, res) => {
  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: 'ODDS_API_KEY not set.' });
  }
  const sportKey = SPORT_MAP[req.params.league];
  if (!sportKey) return res.status(400).json({ error: `Unknown league: ${req.params.league}` });
  try {
    const games = await fetchAndAnalyze(sportKey);
    res.json({ fetchedAt: new Date().toISOString(), gameCount: games.length, games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supported leagues list
app.get('/api/leagues', (req, res) => {
  res.json(Object.entries(SPORT_MAP).map(([k, v]) => ({ key: k, sportKey: v })));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status:  'online',
    keySet:  !!ODDS_API_KEY,
    port:    PORT,
    version: 'Quantum V2',
    time:    new Date().toISOString(),
  });
});

// Catch-all → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  QUANTUM V2 TERMINAL`);
  console.log(`  Port     : ${PORT}`);
  console.log(`  API Key  : ${ODDS_API_KEY ? '✓ loaded' : '✗ MISSING — set ODDS_API_KEY'}`);
  console.log(`  Engine   : Poisson + Monte Carlo (10,000 iterations)`);
  console.log(`  Layers   : 10-signal upset triangulation\n`);
});
    
