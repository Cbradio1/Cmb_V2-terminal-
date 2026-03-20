import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ReferenceLine
} from "recharts";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#080c10",
  panel: "#0d1117",
  border: "#1a2332",
  borderBright: "#1e3a5f",
  cyan: "#00d4ff",
  amber: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
  purple: "#a855f7",
  muted: "#4a5568",
  text: "#c9d1d9",
  dim: "#6e7681",
};

const mono = "'IBM Plex Mono', 'Fira Code', monospace";
const sans = "'DM Sans', 'Outfit', sans-serif";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const GAMES = [
  { id: 1, home: "LAL", away: "BOS", sport: "NBA", time: "7:30 PM ET", spread: -3.5, ou: 224.5 },
  { id: 2, home: "MIL", away: "PHX", sport: "NBA", time: "9:00 PM ET", spread: +1.5, ou: 228.0 },
  { id: 3, home: "KC",  away: "BUF", sport: "NFL", time: "8:20 PM ET", spread: -2.5, ou: 47.5 },
];

const ODDS_HISTORY = {
  1: [
    { t: "Mon 9A", ml: -165, spread: -3.5, ou: 222.5 },
    { t: "Mon 3P", ml: -170, spread: -3.5, ou: 223.0 },
    { t: "Tue 9A", ml: -162, spread: -3.0, ou: 223.5 },
    { t: "Tue 6P", ml: -175, spread: -4.0, ou: 224.0 },
    { t: "Wed 9A", ml: -180, spread: -4.5, ou: 224.5 },
    { t: "Wed 3P", ml: -175, spread: -4.5, ou: 225.0 },
    { t: "Thu 9A", ml: -168, spread: -3.5, ou: 224.5 },
    { t: "Now",    ml: -168, spread: -3.5, ou: 224.5 },
  ],
};

const POWER_RATINGS = [
  { team: "BOS", off: 92, def: 88, pace: 74, sos: 82, overall: 91.2, rank: 1, trend: "+0.8" },
  { team: "OKC", off: 89, def: 91, pace: 78, sos: 79, overall: 89.7, rank: 2, trend: "+1.2" },
  { team: "CLE", off: 84, def: 93, pace: 68, sos: 76, overall: 88.1, rank: 3, trend: "+0.3" },
  { team: "LAL", off: 87, def: 80, pace: 71, sos: 81, overall: 85.4, rank: 4, trend: "-0.5" },
  { team: "DEN", off: 88, def: 79, pace: 76, sos: 74, overall: 84.9, rank: 5, trend: "+0.1" },
  { team: "MIL", off: 85, def: 82, pace: 73, sos: 77, overall: 83.3, rank: 6, trend: "-1.1" },
  { team: "PHX", off: 82, def: 81, pace: 72, sos: 75, overall: 81.0, rank: 7, trend: "+0.4" },
  { team: "MIA", off: 79, def: 84, pace: 69, sos: 73, overall: 80.1, rank: 8, trend: "-0.2" },
];

const INJURIES = [
  { player: "Jaylen Brown",    team: "BOS", pos: "SG", status: "GTD",  impact: "HIGH",   detail: "Knee soreness, limited practice" },
  { player: "LeBron James",    team: "LAL", pos: "SF", status: "OUT",  impact: "SEVERE", detail: "Foot sprain, ruled out tonight" },
  { player: "Anthony Davis",   team: "LAL", pos: "C",  status: "PROB", impact: "MED",    detail: "Back stiffness, expected to play" },
  { player: "Damian Lillard",  team: "MIL", pos: "PG", status: "OUT",  impact: "SEVERE", detail: "Achilles, season-ending" },
  { player: "Kevin Durant",    team: "PHX", pos: "SF", status: "PROB", impact: "HIGH",   detail: "Hamstring, game-time decision" },
  { player: "Bradley Beal",    team: "PHX", pos: "SG", status: "OUT",  impact: "MED",    detail: "Personal reasons" },
  { player: "Giannis Adetokunmpo", team: "MIL", pos: "PF", status: "ACTIVE", impact: "LOW", detail: "Full practice Thursday" },
];

const H2H = [
  { date: "Jan 15 2025", home: "LAL", away: "BOS", score: "112-108", winner: "BOS", spread: "BOS -3", cover: "BOS", ou: 224.5, result: "O" },
  { date: "Nov 22 2024", home: "BOS", away: "LAL", score: "126-115", winner: "BOS", spread: "BOS -5", cover: "BOS", ou: 228.0, result: "O" },
  { date: "Mar 10 2024", home: "LAL", away: "BOS", score: "128-124", winner: "LAL", spread: "LAL -2", cover: "BOS", ou: 222.0, result: "O" },
  { date: "Jan 28 2024", home: "BOS", away: "LAL", score: "114-105", winner: "BOS", spread: "BOS -4", cover: "BOS", ou: 225.5, result: "U" },
  { date: "Dec 07 2023", home: "LAL", away: "BOS", score: "130-122", winner: "LAL", spread: "Even",   cover: "LAL", ou: 231.0, result: "O" },
];

const SCHEDULE = [
  { team: "LAL", games: [
    { opp: "@PHX", date: "Mar 17", rest: 1, b2b: true },
    { opp: "vs BOS", date: "Mar 20", rest: 2, b2b: false },
    { opp: "@DEN", date: "Mar 22", rest: 1, b2b: true },
  ]},
  { team: "BOS", games: [
    { opp: "vs CLE", date: "Mar 18", rest: 2, b2b: false },
    { opp: "@LAL", date: "Mar 20", rest: 1, b2b: false },
    { opp: "vs MIL", date: "Mar 23", rest: 2, b2b: false },
  ]},
];

const CONSENSUS = [
  { model: "Quantum Engine v2", pick: "BOS -3.5", conf: 78, ou: "OVER", edge: "+4.2%" },
  { model: "ELO + Regression",  pick: "BOS -3.5", conf: 71, ou: "OVER", edge: "+2.8%" },
  { model: "Injury-Adj Model",  pick: "LAL +3.5", conf: 63, ou: "OVER", edge: "+1.1%" },
  { model: "Market Pressure",   pick: "BOS -3.5", conf: 82, ou: "PUSH", edge: "+5.1%" },
  { model: "Neural Net v4",     pick: "BOS -4.0", conf: 69, ou: "OVER", edge: "+3.4%" },
  { model: "Public Fade",       pick: "LAL +3.5", conf: 58, ou: "UNDER", edge: "+0.7%" },
];

const ANOMALIES = [
  { flag: "LINE STEAM", game: "LAL vs BOS", detail: "Spread moved 1.5 pts in 4hr window. Sharp action detected.", severity: "HIGH", time: "2h ago" },
  { flag: "CLV ALERT",  game: "MIL vs PHX", detail: "Closing line value mismatch. Opened -1, books now -3.", severity: "MED",  time: "5h ago" },
  { flag: "REVERSE LINE", game: "KC vs BUF", detail: "85% public on KC but line moved to BUF. Sharp fade signal.", severity: "HIGH", time: "1h ago" },
  { flag: "INJURY DROP", game: "LAL vs BOS", detail: "LeBron OUT announced. Line moved only 1pt. May be underpriced.", severity: "MED",  time: "3h ago" },
  { flag: "LOW VOLUME",  game: "MIL vs PHX", detail: "Unusually thin market. Spread variance ±0.8 across books.", severity: "LOW",  time: "6h ago" },
];

const SENTIMENT = [
  { game: "LAL vs BOS", public_spread: 72, sharp_spread: 31, public_ml: 68, sharp_ml: 28, public_ou: 61, sharp_ou: 55 },
  { game: "MIL vs PHX", public_spread: 45, sharp_spread: 52, public_ml: 44, sharp_ml: 54, public_ou: 71, sharp_ou: 48 },
  { game: "KC vs BUF",  public_spread: 85, sharp_spread: 32, public_ml: 82, sharp_ml: 30, public_ou: 58, sharp_ou: 61 },
];

const RISK_ITEMS = [
  { cat: "Line Value",      check: "Edge > 2%",              status: true,  weight: 20 },
  { cat: "Sharp Action",    check: "Steam detected",         status: true,  weight: 15 },
  { cat: "Injury Impact",   check: "No SEVERE outs on pick", status: false, weight: 20 },
  { cat: "Model Consensus", check: ">60% models agree",     status: true,  weight: 15 },
  { cat: "H2H Trend",       check: "ATS trend aligned",     status: true,  weight: 10 },
  { cat: "Rest/Fatigue",    check: "No B2B disadvantage",   status: false, weight: 10 },
  { cat: "Anomaly Clear",   check: "No HIGH flags vs pick",  status: false, weight: 15 },
  { cat: "Sentiment Fade",  check: "Not chasing public",    status: true,  weight: 5  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const statusColor = (s) =>
  s === "OUT" ? C.red : s === "GTD" || s === "PROB" ? C.amber : C.green;

const impactBg = (i) =>
  i === "SEVERE" ? "#2d1515" : i === "HIGH" ? "#2d2010" : i === "MED" ? "#1a1f2d" : "#0f1a10";

const sevColor = (s) =>
  s === "HIGH" ? C.red : s === "MED" ? C.amber : C.muted;

const Tag = ({ children, color = C.cyan }) => (
  <span style={{
    fontFamily: mono, fontSize: 10, letterSpacing: 1,
    padding: "2px 7px", borderRadius: 3,
    background: color + "22", color, border: `1px solid ${color}44`,
  }}>{children}</span>
);

const Panel = ({ children, style }) => (
  <div style={{
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "16px 20px", ...style,
  }}>{children}</div>
);

const SectionTitle = ({ children, accent = C.cyan }) => (
  <div style={{
    fontFamily: mono, fontSize: 11, letterSpacing: 3,
    color: accent, textTransform: "uppercase",
    borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 16,
    display: "flex", alignItems: "center", gap: 8,
  }}>
    <span style={{ width: 3, height: 12, background: accent, borderRadius: 2, display: "inline-block" }} />
    {children}
  </div>
);

const Pill = ({ v, lo, hi, color }) => {
  const pct = Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 4, background: "#1a2332", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: mono, fontSize: 11, color }}>{v}</span>
    </div>
  );
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "odds",      label: "ODDS MVT",   icon: "⟳" },
  { id: "power",     label: "POWER RTG",  icon: "◈" },
  { id: "matchup",   label: "MATCHUP",    icon: "⊕" },
  { id: "injury",    label: "INJURIES",   icon: "⚕" },
  { id: "h2h",       label: "H2H",        icon: "↔" },
  { id: "schedule",  label: "FATIGUE",    icon: "⏱" },
  { id: "consensus", label: "CONSENSUS",  icon: "◉" },
  { id: "anomaly",   label: "ANOMALY",    icon: "⚠" },
  { id: "sentiment", label: "SENTIMENT",  icon: "◌" },
  { id: "checklist", label: "RISK SCORE", icon: "✓" },
];

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function OddsMovement({ selectedGame }) {
  const data = ODDS_HISTORY[selectedGame?.id] || ODDS_HISTORY[1];
  const open = data[0].spread;
  const close = data[data.length - 1].spread;
  const moved = Math.abs(close - open).toFixed(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "OPEN SPREAD", val: open > 0 ? `+${open}` : open, color: C.text },
          { label: "CURRENT",     val: close > 0 ? `+${close}` : close, color: C.cyan },
          { label: "MOVEMENT",    val: `${moved} pts`, color: moved > 1 ? C.amber : C.green },
        ].map(({ label, val, color }) => (
          <Panel key={label}>
            <div style={{ fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: 2 }}>{label}</div>
            <div style={{ fontFamily: mono, fontSize: 24, color, marginTop: 4 }}>{val}</div>
          </Panel>
        ))}
      </div>
      <Panel>
        <SectionTitle>SPREAD LINE MOVEMENT</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={{ fontFamily: mono, fontSize: 9, fill: C.dim }} />
            <YAxis tick={{ fontFamily: mono, fontSize: 9, fill: C.dim }} domain={["auto","auto"]} />
            <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.borderBright}`, fontFamily: mono, fontSize: 11 }} />
            <ReferenceLine y={open} stroke={C.muted} strokeDasharray="4 4" label={{ value: "OPEN", fill: C.muted, fontSize: 9, fontFamily: mono }} />
            <Line type="monotone" dataKey="spread" stroke={C.cyan} strokeWidth={2} dot={{ fill: C.cyan, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel>
          <SectionTitle accent={C.amber}>O/U MOVEMENT</SectionTitle>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ouGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontFamily: mono, fontSize: 8, fill: C.dim }} />
              <YAxis tick={{ fontFamily: mono, fontSize: 8, fill: C.dim }} domain={["auto","auto"]} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.borderBright}`, fontFamily: mono, fontSize: 10 }} />
              <Area type="monotone" dataKey="ou" stroke={C.amber} fill="url(#ouGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <SectionTitle accent={C.purple}>MONEYLINE DRIFT</SectionTitle>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontFamily: mono, fontSize: 8, fill: C.dim }} />
              <YAxis tick={{ fontFamily: mono, fontSize: 8, fill: C.dim }} domain={["auto","auto"]} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.borderBright}`, fontFamily: mono, fontSize: 10 }} />
              <Line type="monotone" dataKey="ml" stroke={C.purple} strokeWidth={2} dot={{ fill: C.purple, r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function PowerRatings() {
  const radarData = [
    { metric: "OFF", LAL: 87, BOS: 92 },
    { metric: "DEF", LAL: 80, BOS: 88 },
    { metric: "PACE", LAL: 71, BOS: 74 },
    { metric: "SOS", LAL: 81, BOS: 82 },
    { metric: "PROJ", LAL: 85, BOS: 91 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel>
          <SectionTitle>TEAM POWER RANKINGS</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {POWER_RATINGS.map((r) => (
              <div key={r.team} style={{
                display: "grid", gridTemplateColumns: "24px 48px 1fr 60px 50px",
                alignItems: "center", gap: 10, padding: "6px 0",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>#{r.rank}</span>
                <span style={{ fontFamily: mono, fontSize: 13, color: C.cyan, fontWeight: 600 }}>{r.team}</span>
                <Pill v={r.overall} lo={75} hi={95} color={C.cyan} />
                <span style={{ fontFamily: mono, fontSize: 11, color: r.overall > 87 ? C.cyan : C.text }}>{r.overall}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: r.trend.startsWith("+") ? C.green : C.red }}>{r.trend}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionTitle accent={C.amber}>MATCHUP RADAR — LAL vs BOS</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="metric" tick={{ fontFamily: mono, fontSize: 10, fill: C.dim }} />
              <Radar name="LAL" dataKey="LAL" stroke={C.amber} fill={C.amber} fillOpacity={0.15} strokeWidth={2} />
              <Radar name="BOS" dataKey="BOS" stroke={C.cyan} fill={C.cyan} fillOpacity={0.15} strokeWidth={2} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.borderBright}`, fontFamily: mono, fontSize: 10 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 12, height: 2, background: C.amber }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: C.amber }}>LAL</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 12, height: 2, background: C.cyan }} />
              <span style={{ fontFamily: mono, fontSize: 10, color: C.cyan }}>BOS</span>
            </div>
          </div>
        </Panel>
      </div>
      <Panel>
        <SectionTitle>COMPONENT BREAKDOWN</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {["OFF", "DEF", "PACE", "SOS"].map((cat) => {
            const vals = POWER_RATINGS.slice(0, 5);
            return (
              <div key={cat}>
                <div style={{ fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 8 }}>{cat} RATING</div>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={vals} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="team" tick={{ fontFamily: mono, fontSize: 8, fill: C.dim }} />
                    <YAxis domain={[60, 100]} hide />
                    <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.borderBright}`, fontFamily: mono, fontSize: 9 }} />
                    <Bar dataKey={cat.toLowerCase()} fill={C.cyan} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function MatchupStats() {
  const stats = [
    { label: "PPG", lal: 118.4, bos: 122.1 },
    { label: "OPP PPG", lal: 114.2, bos: 108.7 },
    { label: "NET RTG", lal: "+4.2", bos: "+13.4" },
    { label: "eFG%", lal: ".534", bos: ".561" },
    { label: "TOV%", lal: "12.1", bos: "10.8" },
    { label: "ORB%", lal: "25.4", bos: "22.1" },
    { label: "FT Rate", lal: ".231", bos: ".198" },
    { label: "3PA/G", lal: "38.2", bos: "44.7" },
    { label: "3P%", lal: ".358", bos: ".382" },
    { label: "PACE", lal: "99.1", bos: "100.4" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { team: "LAL", record: "46-28", ats: "38-36", ou: "41-33-O", streak: "W3", color: C.amber },
          { team: "BOS", record: "56-18", ats: "45-29", ou: "39-35-O", streak: "W7", color: C.cyan },
        ].map(({ team, record, ats, ou, streak, color }) => (
          <Panel key={team} style={{ borderColor: color + "33" }}>
            <div style={{ fontFamily: mono, fontSize: 28, color, fontWeight: 700 }}>{team}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              {[["RECORD", record], ["ATS", ats], ["O/U", ou], ["STREAK", streak]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 2 }}>{l}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, color }}>{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <Panel>
        <SectionTitle>HEAD-TO-HEAD STAT COMPARISON</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {stats.map(({ label, lal, bos }) => {
            const lalN = parseFloat(lal);
            const bosN = parseFloat(bos);
            const lalBetter = !isNaN(lalN) && !isNaN(bosN) && lalN > bosN;
            return (
              <div key={label} style={{
                display: "grid", gridTemplateColumns: "80px 1fr 80px 80px 1fr 80px",
                alignItems: "center", gap: 8, padding: "8px 0",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: lalBetter ? C.amber : C.text, textAlign: "right" }}>{lal}</span>
   
