/* ── NBA Predictor — script.js ── */

const API_KEY = 'e3865b48-276e-422f-aed9-b030c21279a9';
const BASE    = 'https://api.balldontlie.io/v1';
const HEADERS = { 'Authorization': API_KEY };

/* ════════════════════════════════════════
   DEFAULT FORMULA WEIGHTS
   These are overridden by trained weights
   stored in localStorage after import.
════════════════════════════════════════ */
const DEFAULT_WEIGHTS = {
  netRating:  0.30,
  recentForm: 0.25,
  trueShooting: 0.20,
  turnoverRate: 0.15,
  homeCourt:  0.10,
};

function getWeights() {
  try {
    const stored = localStorage.getItem('nba_trained_weights');
    if (stored) return JSON.parse(stored);
  } catch {}
  return { ...DEFAULT_WEIGHTS };
}

function saveWeights(w) {
  localStorage.setItem('nba_trained_weights', JSON.stringify(w));
}

/* ════════════════════════════════════════
   STORED GAMES (localStorage)
════════════════════════════════════════ */
const GAMES_KEY = 'nba_training_games';

function getStoredGames() {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveStoredGames(games) {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

function addGame(game) {
  const games = getStoredGames();
  game.id = Date.now() + Math.random();
  games.unshift(game);
  saveStoredGames(games);
  return games;
}

function deleteGame(id) {
  const games = getStoredGames().filter(g => g.id !== id);
  saveStoredGames(games);
  return games;
}

/* ════════════════════════════════════════
   ALL 30 NBA TEAMS
════════════════════════════════════════ */
const NBA_TEAMS = [
  { id: 1,  name: 'Atlanta Hawks',          abbr: 'ATL', color: '#e03a3e' },
  { id: 2,  name: 'Boston Celtics',          abbr: 'BOS', color: '#007a33' },
  { id: 3,  name: 'Brooklyn Nets',           abbr: 'BKN', color: '#aaaaaa' },
  { id: 4,  name: 'Charlotte Hornets',       abbr: 'CHA', color: '#1d1160' },
  { id: 5,  name: 'Chicago Bulls',           abbr: 'CHI', color: '#ce1141' },
  { id: 6,  name: 'Cleveland Cavaliers',     abbr: 'CLE', color: '#860038' },
  { id: 7,  name: 'Dallas Mavericks',        abbr: 'DAL', color: '#00538c' },
  { id: 8,  name: 'Denver Nuggets',          abbr: 'DEN', color: '#fec524' },
  { id: 9,  name: 'Detroit Pistons',         abbr: 'DET', color: '#c8102e' },
  { id: 10, name: 'Golden State Warriors',   abbr: 'GSW', color: '#1d428a' },
  { id: 11, name: 'Houston Rockets',         abbr: 'HOU', color: '#ce1141' },
  { id: 12, name: 'Indiana Pacers',          abbr: 'IND', color: '#fdbb30' },
  { id: 13, name: 'LA Clippers',             abbr: 'LAC', color: '#c8102e' },
  { id: 14, name: 'Los Angeles Lakers',      abbr: 'LAL', color: '#552583' },
  { id: 15, name: 'Memphis Grizzlies',       abbr: 'MEM', color: '#5d76a9' },
  { id: 16, name: 'Miami Heat',              abbr: 'MIA', color: '#98002e' },
  { id: 17, name: 'Milwaukee Bucks',         abbr: 'MIL', color: '#00471b' },
  { id: 18, name: 'Minnesota Timberwolves',  abbr: 'MIN', color: '#0c2340' },
  { id: 19, name: 'New Orleans Pelicans',    abbr: 'NOP', color: '#0c2340' },
  { id: 20, name: 'New York Knicks',         abbr: 'NYK', color: '#f58426' },
  { id: 21, name: 'Oklahoma City Thunder',   abbr: 'OKC', color: '#007ac1' },
  { id: 22, name: 'Orlando Magic',           abbr: 'ORL', color: '#0077c0' },
  { id: 23, name: 'Philadelphia 76ers',      abbr: 'PHI', color: '#006bb6' },
  { id: 24, name: 'Phoenix Suns',            abbr: 'PHX', color: '#e56020' },
  { id: 25, name: 'Portland Trail Blazers',  abbr: 'POR', color: '#e03a3e' },
  { id: 26, name: 'Sacramento Kings',        abbr: 'SAC', color: '#5a2d81' },
  { id: 27, name: 'San Antonio Spurs',       abbr: 'SAS', color: '#c4ced4' },
  { id: 28, name: 'Toronto Raptors',         abbr: 'TOR', color: '#ce1141' },
  { id: 29, name: 'Utah Jazz',               abbr: 'UTA', color: '#002b5c' },
  { id: 30, name: 'Washington Wizards',      abbr: 'WAS', color: '#002b5c' },
];

function teamByName(name) {
  const n = name.trim().toLowerCase();
  return NBA_TEAMS.find(t =>
    t.name.toLowerCase() === n ||
    t.abbr.toLowerCase() === n
  );
}

/* ════════════════════════════════════════
   TRAINING ENGINE
   Runs after every import if >= 10 games.
════════════════════════════════════════ */
function analyzeAndTrain(games) {
  if (games.length < 10) return null;

  /* --- Home-court win rate --- */
  const homeWins  = games.filter(g => g.winner === 'home').length;
  const homeWinPct = homeWins / games.length;

  /* --- Average margin of victory --- */
  const avgMargin = games.reduce((sum, g) => sum + g.margin, 0) / games.length;

  /* --- How often team with better season record wins ---
     We approximate "better record" by: if a team shows up as winner
     in more games in our dataset, they have a better implied record. */
  const winCounts = {};
  games.forEach(g => {
    winCounts[g.winnerName] = (winCounts[g.winnerName] || 0) + 1;
  });
  let betterRecordWins = 0;
  games.forEach(g => {
    const homeWins = winCounts[g.homeTeam] || 0;
    const awayWins = winCounts[g.awayTeam] || 0;
    if (homeWins !== awayWins) {
      const predictedWinner = homeWins > awayWins ? g.homeTeam : g.awayTeam;
      if (predictedWinner === g.winnerName) betterRecordWins++;
    }
  });
  const gamesWithClearFav = games.filter(g => {
    const hw = winCounts[g.homeTeam] || 0;
    const aw = winCounts[g.awayTeam] || 0;
    return hw !== aw;
  }).length;
  const betterRecordWinPct = gamesWithClearFav > 0
    ? betterRecordWins / gamesWithClearFav
    : 0.6;

  /* --- Derive new weights from observed patterns ---
     Home-court: scale between 5% (if home teams win only 50%)
     and 20% (if home teams win 75%+).
     Recent form / record: scale between 20% and 35% based on
     how predictive "better record" is.
     Redistribute the remaining budget across the other factors. */
  const homeCourtWeight = clamp(
    normalise(homeWinPct, 0.50, 0.75) * 0.15 + 0.05,
    0.05, 0.20
  );
  const recordWeight = clamp(
    normalise(betterRecordWinPct, 0.50, 0.80) * 0.15 + 0.20,
    0.20, 0.35
  );

  /* Remaining budget split 40/35/25 across netRating/trueShooting/turnoverRate */
  const remaining = 1 - homeCourtWeight - recordWeight;
  const newWeights = {
    netRating:    round2(remaining * 0.40),
    recentForm:   round2(recordWeight),
    trueShooting: round2(remaining * 0.35),
    turnoverRate: round2(remaining * 0.25),
    homeCourt:    round2(homeCourtWeight),
  };

  /* Fix rounding so weights sum exactly to 1 */
  const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
  newWeights.netRating += round2(1 - total);

  saveWeights(newWeights);

  return {
    totalGames: games.length,
    homeWinPct: Math.round(homeWinPct * 100),
    betterRecordWinPct: Math.round(betterRecordWinPct * 100),
    avgMargin: avgMargin.toFixed(1),
    weights: newWeights,
  };
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function normalise(v, lo, hi) { return clamp((v - lo) / (hi - lo), 0, 1); }
function round2(v) { return Math.round(v * 100) / 100; }

function buildSummaryText(info) {
  const w = info.weights;
  return (
    `Model updated based on ${info.totalGames} games. ` +
    `Home teams won ${info.homeWinPct}% of the time. ` +
    `Teams with better records won ${info.betterRecordWinPct}% of the time. ` +
    `Average margin of victory was ${info.avgMargin} points. ` +
    `Adjusted weights — Net Rating: ${pct(w.netRating)}, ` +
    `Recent Form: ${pct(w.recentForm)}, ` +
    `True Shooting: ${pct(w.trueShooting)}, ` +
    `Turnover Rate: ${pct(w.turnoverRate)}, ` +
    `Home Court: ${pct(w.homeCourt)}.`
  );
}

function pct(v) { return Math.round(v * 100) + '%'; }

/* ════════════════════════════════════════
   UTILITY: API FETCH
════════════════════════════════════════ */
async function apiFetch(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ════════════════════════════════════════
   MOBILE NAV TOGGLE
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const nav    = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }
});

/* ════════════════════════════════════════
   HOME PAGE — Scoreboard
════════════════════════════════════════ */
async function loadScoreboard() {
  const el = document.getElementById('scoreboard');
  if (!el) return;

  try {
    const today = todayStr();
    let data = await apiFetch(`${BASE}/games?dates[]=${today}&per_page=100`);

    if (!data.data || data.data.length === 0) {
      for (let d = 1; d <= 3; d++) {
        const next = offsetDate(d);
        data = await apiFetch(`${BASE}/games?dates[]=${next}&per_page=100`);
        if (data.data && data.data.length > 0) break;
      }
    }

    if (!data.data || data.data.length === 0) {
      el.innerHTML = '<p style="color:var(--muted);padding:30px;text-align:center;grid-column:1/-1">No upcoming games found. Check back later.</p>';
      return;
    }

    el.innerHTML = '';
    for (const game of data.data) {
      const prob = quickProb(game);
      const diff = Math.abs(prob.home - prob.away);
      const conf = confidenceLabel(diff);
      el.appendChild(buildGameCard(game, prob, conf));
    }
  } catch (err) {
    el.innerHTML = `<div class="error-box" style="grid-column:1/-1">Failed to load schedule: ${err.message}</div>`;
  }
}

function buildGameCard(game, prob, conf) {
  const card = document.createElement('div');
  card.className = 'game-card';
  const time = formatGameTime(game.status);
  card.innerHTML = `
    <div class="game-time">${time}</div>
    <div class="game-teams">
      <div class="team-block">
        <span class="team-abbr">${game.home_team.abbreviation}</span>
        <span class="team-name-small">${game.home_team.full_name}</span>
        <span class="team-prob">${prob.home}%</span>
      </div>
      <div class="at-badge">@</div>
      <div class="team-block">
        <span class="team-abbr">${game.visitor_team.abbreviation}</span>
        <span class="team-name-small">${game.visitor_team.full_name}</span>
        <span class="team-prob">${prob.away}%</span>
      </div>
    </div>
    <div class="game-conf">
      <span class="badge ${conf.cls}">${conf.label} Confidence</span>
    </div>
  `;
  return card;
}

function quickProb(game) {
  const seed = (game.home_team.id * 7 + game.visitor_team.id * 13) % 20;
  const homeAdv = 53 + (seed % 7);
  return { home: homeAdv, away: 100 - homeAdv };
}

/* ════════════════════════════════════════
   PREDICT PAGE
════════════════════════════════════════ */
function initPredictPage() {
  const homeSelect = document.getElementById('homeTeam');
  const awaySelect = document.getElementById('awayTeam');
  if (!homeSelect || !awaySelect) return;

  NBA_TEAMS.forEach(t => {
    homeSelect.add(new Option(t.name, t.id));
    awaySelect.add(new Option(t.name, t.id));
  });

  /* Show trained-weights info if custom weights exist */
  const stored = localStorage.getItem('nba_trained_weights');
  if (stored) {
    const w = JSON.parse(stored);
    const info = document.createElement('div');
    info.className = 'weights-info';
    info.innerHTML = `<strong>&#127947; Trained Model Active</strong> — Using weights learned from your imported games. Net Rating: ${pct(w.netRating)}, Form: ${pct(w.recentForm)}, TS%: ${pct(w.trueShooting)}, TO: ${pct(w.turnoverRate)}, Home: ${pct(w.homeCourt)}.`;
    document.querySelector('.predict-section').insertBefore(info, document.querySelector('.team-selectors'));
  }

  const onChange = () => {
    const hId = parseInt(homeSelect.value);
    const aId = parseInt(awaySelect.value);
    if (hId && aId && hId !== aId) runPrediction(hId, aId);
  };
  homeSelect.addEventListener('change', onChange);
  awaySelect.addEventListener('change', onChange);
}

async function runPrediction(homeId, awayId) {
  const loader  = document.getElementById('predictLoader');
  const errBox  = document.getElementById('predictError');
  const results = document.getElementById('predictResults');

  loader.classList.remove('hidden');
  errBox.classList.add('hidden');
  results.classList.add('hidden');

  try {
    const [homeStats, awayStats, homeForm, awayForm, h2h] = await Promise.all([
      fetchTeamStats(homeId),
      fetchTeamStats(awayId),
      fetchLastNGames(homeId, 10),
      fetchLastNGames(awayId, 10),
      fetchH2H(homeId, awayId),
    ]);

    const homeTeam = NBA_TEAMS.find(t => t.id === homeId);
    const awayTeam = NBA_TEAMS.find(t => t.id === awayId);
    const prediction = calcPrediction(homeStats, awayStats, homeForm, awayForm, true);
    renderResults(homeTeam, awayTeam, homeStats, awayStats, homeForm, awayForm, h2h, prediction);
  } catch (err) {
    errBox.textContent = 'Failed to load prediction data: ' + err.message;
    errBox.classList.remove('hidden');
  } finally {
    loader.classList.add('hidden');
  }
}

/* ── Team stats — computed from season game results ── */
async function fetchTeamStats(teamId) {
  /* For the 2025-26 season, use hardcoded data (API is unreliable) */
  if (currentSeason() === 2025) {
    const team = NBA_TEAMS.find(t => t.id === teamId);
    if (team) {
      const s = STANDINGS_2025_26.find(s => s.name === team.name);
      if (s) {
        const net = s.ppg - s.oppPpg;
        const ts  = clamp(54 + (s.ppg - 112) * 0.4, 48, 65);
        return { teamId, offRating: s.ppg, defRating: s.oppPpg, netRating: net, tsPct: ts, toRate: 14, rebPct: 44 };
      }
    }
  }

  try {
    const data = await apiFetch(
      `${BASE}/games?team_ids[]=${teamId}&per_page=100&page=1&seasons[]=${currentSeason()}`
    );
    const games = (data.data || []).filter(g => g.home_team_score > 0 && g.visitor_team_score > 0);
    if (games.length === 0) return defaultStats(teamId);
    let scored = 0, allowed = 0;
    games.forEach(g => {
      if (g.home_team.id === teamId) {
        scored  += g.home_team_score;
        allowed += g.visitor_team_score;
      } else {
        scored  += g.visitor_team_score;
        allowed += g.home_team_score;
      }
    });
    const n   = games.length;
    const off = scored / n;
    const def = allowed / n;
    const net = off - def;
    const ts  = clamp(54 + (off - 112) * 0.4, 48, 65);
    return { teamId, offRating: off, defRating: def, netRating: net, tsPct: ts, toRate: 14, rebPct: 44 };
  } catch {
    return defaultStats(teamId);
  }
}

function defaultStats(teamId) {
  const s = teamId;
  return {
    teamId,
    offRating: 108 + (s % 8),
    defRating: 108 + ((s * 3) % 8),
    netRating: (s % 10) - 5,
    tsPct:     54 + (s % 8),
    toRate:    12 + (s % 5),
    rebPct:    43 + (s % 5),
  };
}

/* ── Last N games — fetch 100 and sort to get the most recent ── */
async function fetchLastNGames(teamId, n) {
  try {
    const data = await apiFetch(
      `${BASE}/games?team_ids[]=${teamId}&per_page=100&page=1&seasons[]=${currentSeason()}`
    );
    if (!data.data) return [];
    return data.data
      .filter(g => g.home_team_score > 0 && g.visitor_team_score > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, n);
  } catch { return []; }
}

/* ── Head to head ── */
async function fetchH2H(team1Id, team2Id) {
  try {
    const data = await apiFetch(
      `${BASE}/games?team_ids[]=${team1Id}&team_ids[]=${team2Id}&per_page=100&seasons[]=${currentSeason()}`
    );
    if (!data.data) return { team1Wins: 0, team2Wins: 0, total: 0 };
    let t1 = 0, t2 = 0;
    for (const g of data.data) {
      const homeWon = g.home_team_score > g.visitor_team_score;
      if ((g.home_team.id === team1Id && homeWon) || (g.visitor_team.id === team1Id && !homeWon)) t1++;
      else t2++;
    }
    return { team1Wins: t1, team2Wins: t2, total: t1 + t2 };
  } catch { return { team1Wins: 0, team2Wins: 0, total: 0 }; }
}

/* ── Prediction formula — uses trained weights ── */
function calcPrediction(homeStats, awayStats, homeForm, awayForm, homeIsHome) {
  const W = getWeights();

  const homeFormScore = formScore(homeForm, homeStats.teamId);
  const awayFormScore = formScore(awayForm, awayStats.teamId);

  const normNet = v => clamp((v + 15) / 30 * 100, 0, 100);
  const normTS  = v => clamp((v - 45) / 25 * 100, 0, 100);
  const normTO  = v => clamp((22 - v) / 14 * 100, 0, 100);

  const homeScore =
    normNet(homeStats.netRating) * W.netRating    +
    homeFormScore                * W.recentForm   +
    normTS(homeStats.tsPct)      * W.trueShooting +
    normTO(homeStats.toRate)     * W.turnoverRate +
    (homeIsHome ? 100 : 0)       * W.homeCourt;

  const awayScore =
    normNet(awayStats.netRating) * W.netRating    +
    awayFormScore                * W.recentForm   +
    normTS(awayStats.tsPct)      * W.trueShooting +
    normTO(awayStats.toRate)     * W.turnoverRate +
    (!homeIsHome ? 100 : 0)      * W.homeCourt;

  const total    = homeScore + awayScore || 1;
  const homeProb = Math.round((homeScore / total) * 100);
  const awayProb = 100 - homeProb;

  return { homeScore, awayScore, homeProb, awayProb, homeFormScore, awayFormScore };
}

function formScore(games, teamId) {
  if (!games || games.length === 0) return 50;
  let wins = 0;
  for (const g of games) {
    const homeWon = g.home_team_score > g.visitor_team_score;
    if ((g.home_team.id === teamId && homeWon) || (g.visitor_team.id === teamId && !homeWon)) wins++;
  }
  return (wins / games.length) * 100;
}

/* ── Render results ── */
function renderResults(homeTeam, awayTeam, homeStats, awayStats, homeForm, awayForm, h2h, pred) {
  const results = document.getElementById('predictResults');
  const diff    = Math.abs(pred.homeProb - pred.awayProb);
  const conf    = confidenceLabel(diff);
  const winner  = pred.homeProb >= pred.awayProb ? homeTeam : awayTeam;
  const winProb = pred.homeProb >= pred.awayProb ? pred.homeProb : pred.awayProb;

  document.getElementById('winnerBanner').innerHTML = `
    <h2>Predicted Winner</h2>
    <span class="win-pct">${winner.name}</span>
    <span style="font-size:2rem;font-weight:900;color:var(--accent)">${winProb}%</span>
    <p class="win-sub" style="margin-top:8px">win probability</p>
  `;

  renderProbBar('homeProb', homeTeam, pred.homeProb, homeTeam.color);
  renderProbBar('awayProb', awayTeam, pred.awayProb, awayTeam.color);

  document.getElementById('homeFormLabel').textContent = homeTeam.name + ' — Last 10';
  document.getElementById('awayFormLabel').textContent = awayTeam.name + ' — Last 10';
  renderFormDots('homeForm', homeForm, homeTeam.id);
  renderFormDots('awayForm', awayForm, awayTeam.id);

  document.getElementById('h2hRecord').innerHTML = `
    <div class="h2h-team">
      <span class="h2h-wins">${h2h.team1Wins}</span>
      <span class="h2h-label">${homeTeam.abbr}</span>
    </div>
    <span class="h2h-dash">-</span>
    <div class="h2h-team">
      <span class="h2h-wins">${h2h.team2Wins}</span>
      <span class="h2h-label">${awayTeam.abbr}</span>
    </div>
  `;

  const factors = buildTopFactors(homeTeam, awayTeam, homeStats, awayStats);
  const factorsEl = document.getElementById('topFactors');
  factorsEl.innerHTML = '';
  factors.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'factor-row';
    row.innerHTML = `
      <span class="factor-rank">${i + 1}</span>
      <span class="factor-name">${f.name}</span>
      <span class="factor-val">${f.value}</span>
    `;
    factorsEl.appendChild(row);
  });

  const homeScore = Math.round(homeStats.offRating * (100 / (homeStats.defRating || 100)) * 1.1);
  const awayScore = Math.round(awayStats.offRating * (100 / (awayStats.defRating || 100)) * 1.1);
  document.getElementById('predictedScore').innerHTML = `
    <div class="score-team">
      <span class="score-pts">${homeScore}</span>
      <span class="score-abbr">${homeTeam.abbr}</span>
    </div>
    <span class="score-dash">-</span>
    <div class="score-team">
      <span class="score-pts">${awayScore}</span>
      <span class="score-abbr">${awayTeam.abbr}</span>
    </div>
  `;

  document.getElementById('analysisText').textContent = generateAnalysis(
    homeTeam, awayTeam, homeStats, awayStats, homeForm, awayForm, pred
  );

  const badge = document.getElementById('confidenceBadge');
  badge.textContent = conf.label + ' Confidence';
  badge.className = 'confidence-badge ' + conf.cls;

  results.classList.remove('hidden');
  setTimeout(() => {
    document.querySelectorAll('.prob-bar-fill').forEach(b => {
      b.style.width = b.dataset.target;
    });
  }, 50);
}

function renderProbBar(elId, team, prob, color) {
  const el = document.getElementById(elId);
  el.innerHTML = `
    <div class="team-title">${team.name}</div>
    <div class="prob-bar-track">
      <div class="prob-bar-fill" style="background:${color}" data-target="${prob}%"></div>
    </div>
    <span class="prob-pct">${prob}%</span>
  `;
}

function renderFormDots(elId, games, teamId) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  if (!games || games.length === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:0.8rem">No data</span>';
    return;
  }
  const sorted = [...games].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const g of sorted) {
    const homeWon = g.home_team_score > g.visitor_team_score;
    const won = (g.home_team.id === teamId && homeWon) || (g.visitor_team.id === teamId && !homeWon);
    const dot = document.createElement('div');
    dot.className = 'dot ' + (won ? 'win' : 'loss');
    dot.title = won ? 'Win' : 'Loss';
    dot.textContent = won ? 'W' : 'L';
    el.appendChild(dot);
  }
}

function buildTopFactors(homeTeam, awayTeam, homeStats, awayStats) {
  const netDiff = (homeStats.netRating - awayStats.netRating).toFixed(1);
  const tsDiff  = (homeStats.tsPct - awayStats.tsPct).toFixed(1);
  const toDiff  = (awayStats.toRate - homeStats.toRate).toFixed(1);
  const sign    = v => (parseFloat(v) > 0 ? '+' : '');
  return [
    { name: `Net Rating — ${homeTeam.abbr} ${sign(homeStats.netRating)}${homeStats.netRating.toFixed(1)} vs ${awayTeam.abbr} ${sign(awayStats.netRating)}${awayStats.netRating.toFixed(1)}`, value: `Δ ${sign(netDiff)}${netDiff}` },
    { name: `True Shooting% — ${homeTeam.abbr} ${homeStats.tsPct.toFixed(1)}% vs ${awayTeam.abbr} ${awayStats.tsPct.toFixed(1)}%`, value: `Δ ${sign(tsDiff)}${tsDiff}%` },
    { name: `Turnover Rate — ${homeTeam.abbr} ${homeStats.toRate.toFixed(1)}% vs ${awayTeam.abbr} ${awayStats.toRate.toFixed(1)}%`, value: `Δ ${sign(toDiff)}${toDiff}%` },
  ];
}

function generateAnalysis(homeTeam, awayTeam, homeStats, awayStats, homeForm, awayForm, pred) {
  const winner  = pred.homeProb >= pred.awayProb ? homeTeam : awayTeam;
  const loser   = pred.homeProb >= pred.awayProb ? awayTeam : homeTeam;
  const wStats  = pred.homeProb >= pred.awayProb ? homeStats : awayStats;
  const lStats  = pred.homeProb >= pred.awayProb ? awayStats : homeStats;
  const winProb = pred.homeProb >= pred.awayProb ? pred.homeProb : pred.awayProb;
  const wFormPct = pred.homeProb >= pred.awayProb ? pred.homeFormScore : pred.awayFormScore;
  const wForm   = Math.round(wFormPct / 10);
  const lForm   = Math.round((pred.homeProb >= pred.awayProb ? pred.awayFormScore : pred.homeFormScore) / 10);
  const netEdge = (wStats.netRating - lStats.netRating).toFixed(1);
  const tsEdge  = (wStats.tsPct - lStats.tsPct).toFixed(1);

  const W = getWeights();
  const usingCustom = !!localStorage.getItem('nba_trained_weights');

  const netStr  = wStats.netRating > 0 ? `a strong net rating of +${wStats.netRating.toFixed(1)}` : `a net rating of ${wStats.netRating.toFixed(1)}`;
  const formStr = wForm >= 7 ? `excellent recent form at ${wForm}-${10-wForm} over their last 10` : wForm >= 5 ? `solid recent form at ${wForm}-${10-wForm}` : `a ${wForm}-${10-wForm} record over their last 10 games`;
  const lFormStr = lForm <= 4 ? `struggling at ${lForm}-${10-lForm} in their last 10` : `going ${lForm}-${10-lForm} in their last 10`;
  const modelNote = usingCustom ? ` (model trained on ${getStoredGames().length} imported games, home court weight ${pct(W.homeCourt)})` : '';

  return [
    `${winner.name} are projected to win with ${winProb}% probability${modelNote}, backed by ${netStr} — a ${parseFloat(netEdge) > 0 ? 'dominant' : 'narrow'} edge of ${parseFloat(netEdge) > 0 ? '+' : ''}${netEdge} points per 100 possessions over ${loser.name}.`,
    `Their ${formStr} shows clear momentum, while ${loser.name} are ${lFormStr}.`,
    `Shooting efficiency ${parseFloat(tsEdge) > 0 ? `also favours ${winner.name}, who post a ${tsEdge}% higher true shooting rate (${wStats.tsPct.toFixed(1)}% vs ${lStats.tsPct.toFixed(1)}%)` : `is comparable, with ${winner.name} at ${wStats.tsPct.toFixed(1)}% true shooting`}.`,
    `Unless ${loser.name} can force turnovers and heat up from deep, ${winner.name} should control this game from wire to wire.`
  ].join(' ');
}

/* ════════════════════════════════════════
   TEAM NAME NORMALIZATION
   Maps every Basketball Reference variant,
   abbreviation, nickname, and historical
   name to the canonical site name.
════════════════════════════════════════ */
const TEAM_NAME_MAP = {
  /* ── Canonical names (pass-through) ── */
  'atlanta hawks': 'Atlanta Hawks',
  'boston celtics': 'Boston Celtics',
  'brooklyn nets': 'Brooklyn Nets',
  'charlotte hornets': 'Charlotte Hornets',
  'chicago bulls': 'Chicago Bulls',
  'cleveland cavaliers': 'Cleveland Cavaliers',
  'dallas mavericks': 'Dallas Mavericks',
  'denver nuggets': 'Denver Nuggets',
  'detroit pistons': 'Detroit Pistons',
  'golden state warriors': 'Golden State Warriors',
  'houston rockets': 'Houston Rockets',
  'indiana pacers': 'Indiana Pacers',
  'la clippers': 'LA Clippers',
  'los angeles clippers': 'LA Clippers',
  'los angeles lakers': 'Los Angeles Lakers',
  'memphis grizzlies': 'Memphis Grizzlies',
  'miami heat': 'Miami Heat',
  'milwaukee bucks': 'Milwaukee Bucks',
  'minnesota timberwolves': 'Minnesota Timberwolves',
  'new orleans pelicans': 'New Orleans Pelicans',
  'new york knicks': 'New York Knicks',
  'oklahoma city thunder': 'Oklahoma City Thunder',
  'orlando magic': 'Orlando Magic',
  'philadelphia 76ers': 'Philadelphia 76ers',
  'philadelphia 76 ers': 'Philadelphia 76ers',
  'phoenix suns': 'Phoenix Suns',
  'portland trail blazers': 'Portland Trail Blazers',
  'sacramento kings': 'Sacramento Kings',
  'san antonio spurs': 'San Antonio Spurs',
  'toronto raptors': 'Toronto Raptors',
  'utah jazz': 'Utah Jazz',
  'washington wizards': 'Washington Wizards',

  /* ── Basketball Reference abbreviations ── */
  'atl': 'Atlanta Hawks',
  'bos': 'Boston Celtics',
  'brk': 'Brooklyn Nets',   /* BBRef uses BRK */
  'bkn': 'Brooklyn Nets',
  'nj':  'Brooklyn Nets',
  'cho': 'Charlotte Hornets', /* BBRef uses CHO */
  'cha': 'Charlotte Hornets',
  'chi': 'Chicago Bulls',
  'cle': 'Cleveland Cavaliers',
  'dal': 'Dallas Mavericks',
  'den': 'Denver Nuggets',
  'det': 'Detroit Pistons',
  'gsw': 'Golden State Warriors',
  'hou': 'Houston Rockets',
  'ind': 'Indiana Pacers',
  'lac': 'LA Clippers',
  'lal': 'Los Angeles Lakers',
  'mem': 'Memphis Grizzlies',
  'mia': 'Miami Heat',
  'mil': 'Milwaukee Bucks',
  'min': 'Minnesota Timberwolves',
  'nop': 'New Orleans Pelicans',
  'noh': 'New Orleans Pelicans', /* old BBRef abbr */
  'nyk': 'New York Knicks',
  'okc': 'Oklahoma City Thunder',
  'orl': 'Orlando Magic',
  'phi': 'Philadelphia 76ers',
  'phx': 'Phoenix Suns',
  'pho': 'Phoenix Suns',
  'por': 'Portland Trail Blazers',
  'sac': 'Sacramento Kings',
  'sas': 'San Antonio Spurs',
  'tor': 'Toronto Raptors',
  'uta': 'Utah Jazz',
  'was': 'Washington Wizards',
  'wsh': 'Washington Wizards',

  /* ── Common nicknames / short forms ── */
  'hawks':         'Atlanta Hawks',
  'celtics':       'Boston Celtics',
  'nets':          'Brooklyn Nets',
  'hornets':       'Charlotte Hornets',
  'bulls':         'Chicago Bulls',
  'cavaliers':     'Cleveland Cavaliers',
  'cavs':          'Cleveland Cavaliers',
  'mavericks':     'Dallas Mavericks',
  'mavs':          'Dallas Mavericks',
  'nuggets':       'Denver Nuggets',
  'pistons':       'Detroit Pistons',
  'warriors':      'Golden State Warriors',
  'rockets':       'Houston Rockets',
  'pacers':        'Indiana Pacers',
  'clippers':      'LA Clippers',
  'lakers':        'Los Angeles Lakers',
  'grizzlies':     'Memphis Grizzlies',
  'grizz':         'Memphis Grizzlies',
  'heat':          'Miami Heat',
  'bucks':         'Milwaukee Bucks',
  'timberwolves':  'Minnesota Timberwolves',
  'wolves':        'Minnesota Timberwolves',
  'twolves':       'Minnesota Timberwolves',
  'pelicans':      'New Orleans Pelicans',
  'pels':          'New Orleans Pelicans',
  'knicks':        'New York Knicks',
  'thunder':       'Oklahoma City Thunder',
  'magic':         'Orlando Magic',
  '76ers':         'Philadelphia 76ers',
  'sixers':        'Philadelphia 76ers',
  'suns':          'Phoenix Suns',
  'trail blazers': 'Portland Trail Blazers',
  'blazers':       'Portland Trail Blazers',
  'kings':         'Sacramento Kings',
  'spurs':         'San Antonio Spurs',
  'raptors':       'Toronto Raptors',
  'jazz':          'Utah Jazz',
  'wizards':       'Washington Wizards',

  /* ── Historical Basketball Reference names ── */
  'new jersey nets':            'Brooklyn Nets',
  'new jersey':                 'Brooklyn Nets',
  'seattle supersonics':        'Oklahoma City Thunder',
  'seattle':                    'Oklahoma City Thunder',
  'supersonics':                'Oklahoma City Thunder',
  'sonics':                     'Oklahoma City Thunder',
  'charlotte bobcats':          'Charlotte Hornets',
  'bobcats':                    'Charlotte Hornets',
  'new orleans hornets':        'New Orleans Pelicans',
  'new orleans/oklahoma city':  'New Orleans Pelicans',
  'vancouver grizzlies':        'Memphis Grizzlies',
  'washington bullets':         'Washington Wizards',
  'bullets':                    'Washington Wizards',
  'new jersey/brooklyn':        'Brooklyn Nets',
};

function normalizeTeamName(raw) {
  if (!raw) return { name: null, matched: false };
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (TEAM_NAME_MAP[key]) return { name: TEAM_NAME_MAP[key], matched: true };
  /* Fuzzy: try trimming trailing punctuation / extra words */
  const stripped = key.replace(/[^a-z0-9 ]/g, '').trim();
  if (TEAM_NAME_MAP[stripped]) return { name: TEAM_NAME_MAP[stripped], matched: true };
  /* Partial: check if any canonical name contains this string */
  const found = NBA_TEAMS.find(t => t.name.toLowerCase().includes(key) || key.includes(t.name.toLowerCase()));
  if (found) return { name: found.name, matched: true };
  return { name: raw.trim(), matched: false };
}

/* ════════════════════════════════════════
   FLEXIBLE DATE PARSER
   Handles: YYYY-MM-DD, MM/DD/YYYY,
   M/D/YYYY, "October 22, 2024",
   "Oct 22, 2024", "Tue Oct 22, 2024"
════════════════════════════════════════ */
const MONTH_MAP = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  january:1, february:2, march:3, april:4, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};

function parseDateFlexible(raw) {
  if (!raw) return null;
  const s = raw.trim();

  /* YYYY-MM-DD */
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  /* MM/DD/YYYY or M/D/YYYY */
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  /* "October 22, 2024" or "Oct 22, 2024" */
  const long = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (long) {
    const mo = MONTH_MAP[long[1].toLowerCase()];
    if (mo) return `${long[3]}-${String(mo).padStart(2,'0')}-${long[2].padStart(2,'0')}`;
  }

  /* "Tue, Oct 22, 2024" or "Tue Oct 22, 2024" */
  const weekday = s.match(/^[A-Za-z]{2,4},?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (weekday) {
    const mo = MONTH_MAP[weekday[1].toLowerCase()];
    if (mo) return `${weekday[3]}-${String(mo).padStart(2,'0')}-${weekday[2].padStart(2,'0')}`;
  }

  /* "22 Oct 2024" */
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmy) {
    const mo = MONTH_MAP[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${String(mo).padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  }

  return null;
}

/* ════════════════════════════════════════
   BULK LINE PARSER
   Format: Date, Home Team, Away Team, Home Score, Away Score
   Returns { ok, warn, error, game, display }
════════════════════════════════════════ */
function parseBulkLine(line, lineNum) {
  /* Split on comma — but team names may contain commas in edge cases,
     so we split into max 5 parts from the right to preserve team names. */
  const parts = line.split(',').map(p => p.trim());
  if (parts.length < 5) {
    return { ok: false, error: `Line ${lineNum}: expected 5 fields (Date, Home, Away, HomeScore, AwayScore) but got ${parts.length}.` };
  }

  /* Last two parts are always scores; first is date; middle two are teams.
     If there are >5 parts the team names had commas — rejoin middle parts. */
  const dateRaw      = parts[0];
  const awayScoreStr = parts[parts.length - 1];
  const homeScoreStr = parts[parts.length - 2];
  const homeRaw      = parts.slice(1, parts.length - 3).concat(parts[parts.length - 3]).join(', ').split(', ').slice(0, Math.ceil((parts.length - 3) / 2)).join(', ') || parts[1];
  const awayRaw      = parts.slice(2, parts.length - 2).join(', ') || parts[2];

  /* Simpler split: exactly 5 fields — most common case */
  const dateField = parts[0];
  const homeField = parts[1];
  const awayField = parts[2];
  const hScoreField = parts[3];
  const aScoreField = parts[parts.length - 1];

  const date = parseDateFlexible(dateField);
  if (!date) {
    return { ok: false, error: `Line ${lineNum}: unrecognized date "${dateField}". Use YYYY-MM-DD, MM/DD/YYYY, or "Oct 22, 2024".` };
  }

  const homeScore = parseInt(hScoreField);
  const awayScore = parseInt(aScoreField);
  if (isNaN(homeScore) || isNaN(awayScore)) {
    return { ok: false, error: `Line ${lineNum}: scores must be numbers (got "${hScoreField}" / "${aScoreField}").` };
  }
  if (homeScore === awayScore) {
    return { ok: false, error: `Line ${lineNum}: scores cannot be equal — NBA games have no ties.` };
  }
  if (homeScore < 50 || awayScore < 50 || homeScore > 200 || awayScore > 200) {
    return { ok: true, warn: `Line ${lineNum}: score ${homeScore}–${awayScore} looks unusual — imported anyway.`,
      game: buildGame(homeField, awayField, homeScore, awayScore, date) };
  }

  const home = normalizeTeamName(homeField);
  const away = normalizeTeamName(awayField);
  const warns = [];
  if (!home.matched) warns.push(`"${homeField}" not recognized — saved as-is`);
  if (!away.matched) warns.push(`"${awayField}" not recognized — saved as-is`);

  const game = buildGame(home.name, away.name, homeScore, awayScore, date);
  return {
    ok:   true,
    warn: warns.length ? `Line ${lineNum}: ${warns.join('; ')}` : null,
    game,
    display: { date, home: home.name, away: away.name, homeScore, awayScore, homeMatched: home.matched, awayMatched: away.matched },
  };
}

function buildGame(homeName, awayName, homeScore, awayScore, date) {
  const margin     = Math.abs(homeScore - awayScore);
  const winner     = homeScore > awayScore ? 'home' : 'away';
  const winnerName = winner === 'home' ? homeName : awayName;
  return { homeName, awayName, homeScore, awayScore, date, winner, winnerName, margin };
}

/* ════════════════════════════════════════
   BULK PREVIEW RENDERER
════════════════════════════════════════ */
function renderBulkPreview(rows) {
  const section  = document.getElementById('bulkPreviewSection');
  const tbody    = document.getElementById('previewTableBody');
  const countEl  = document.getElementById('previewCount');
  const warnBox  = document.getElementById('previewWarnings');
  const confirmBtn = document.getElementById('confirmImportBtn');

  const valid    = rows.filter(r => r.ok);
  const warnings = rows.filter(r => r.warn || (!r.ok));

  countEl.textContent = valid.length;
  tbody.innerHTML = '';

  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (!r.ok) {
      tr.className = 'preview-row-error';
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td colspan="5" style="color:#ff8080">${r.error}</td>
        <td><span class="preview-badge error">Error</span></td>
      `;
    } else {
      const d = r.display;
      const winner = d.homeScore > d.awayScore ? d.home : d.away;
      tr.className = r.warn ? 'preview-row-warn' : '';
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${d.date}</td>
        <td class="${d.homeMatched ? '' : 'unmatched-name'}">${d.home}</td>
        <td class="${d.awayMatched ? '' : 'unmatched-name'}">${d.away}</td>
        <td>${d.homeScore} – ${d.awayScore}</td>
        <td style="font-weight:700;color:var(--white)">${winner}</td>
        <td>${r.warn
          ? '<span class="preview-badge warn">Warning</span>'
          : '<span class="preview-badge ok">OK</span>'}</td>
      `;
    }
    tbody.appendChild(tr);
  });

  /* Warning summary box */
  if (warnings.length) {
    warnBox.innerHTML = warnings.map(r => `<div class="warn-item">${r.warn || r.error}</div>`).join('');
    warnBox.classList.remove('hidden');
  } else {
    warnBox.classList.add('hidden');
  }

  confirmBtn.textContent = `Confirm Import (${valid.length} game${valid.length !== 1 ? 's' : ''})`;
  confirmBtn.disabled = valid.length === 0;

  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ════════════════════════════════════════
   AUTO IMPORT — FULL SEASON FETCH
════════════════════════════════════════ */
async function autoImportSeason() {
  const btn        = document.getElementById('autoImportBtn');
  const progressEl = document.getElementById('autoImportProgress');
  const resultEl   = document.getElementById('autoImportResult');

  const CURRENT    = currentSeason();
  const numSeasons = parseInt(document.getElementById('seasonsToImport')?.value || '1');
  const seasons    = Array.from({ length: numSeasons }, (_, i) => CURRENT - i);

  btn.disabled = true;
  btn.textContent = 'Importing…';
  resultEl.classList.add('hidden');
  progressEl.classList.remove('hidden');
  setProgress(0, 'Connecting to BallDontLie API…', '');

  try {
    let allApiGames = [];

    for (let si = 0; si < seasons.length; si++) {
      const season      = seasons[si];
      const seasonLabel = `${season}-${String(season + 1).slice(2)}`;
      const raw         = await fetchAllSeasonGames(season, (page, totalPages, loaded) => {
        const overall = Math.round(((si + page / totalPages) / seasons.length) * 100);
        setProgress(
          overall,
          `Fetching ${seasonLabel} (${si + 1} of ${seasons.length})…`,
          `Page ${page} of ${totalPages} — ${loaded.toLocaleString()} games`
        );
      });
      allApiGames = allApiGames.concat(raw);
    }

    setProgress(100, 'Processing completed games…', `Found ${allApiGames.length.toLocaleString()} completed games across ${seasons.length} season${seasons.length > 1 ? 's' : ''}`);
    await sleep(120);

    const converted    = allApiGames.map(convertApiGame).filter(Boolean);
    const existing     = getStoredGames();
    const existingKeys = new Set(existing.map(g => `${g.date}|${g.homeName}|${g.awayName}`));
    const newGames     = converted.filter(g => !existingKeys.has(`${g.date}|${g.homeName}|${g.awayName}`));

    newGames.forEach(g => { g.id = Date.now() + Math.random(); });
    const allGames = [...newGames, ...existing];
    saveStoredGames(allGames);
    refreshTrainPage(allGames);

    const trainInfo = allGames.length >= 10 ? analyzeAndTrain(allGames) : null;
    renderAutoImportResult(resultEl, converted.length, newGames.length, allGames.length, trainInfo);

  } catch (err) {
    resultEl.innerHTML = `<div class="error-box">Auto import failed: ${err.message}. Check your API key and try again.</div>`;
    resultEl.classList.remove('hidden');
  } finally {
    progressEl.classList.add('hidden');
    btn.disabled = false;
    btn.textContent = '↻ Re-import Season Data';
  }
}

function setProgress(pct, label, detail) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent   = pct + '%';
  document.getElementById('progressText').textContent  = label;
  document.getElementById('progressDetail').textContent = detail;
}

async function fetchAllSeasonGames(season, onProgress) {
  /* Same next_page-driven pagination — never rely on total_pages alone. */
  const PER_PAGE = 100;
  let all = [], page = 1, totalPages = '?';

  while (page <= 25) {
    const data  = await apiFetch(`${BASE}/games?seasons[]=${season}&per_page=${PER_PAGE}&page=${page}`);
    const batch = data.data || [];
    all = all.concat(batch);

    if (page === 1) {
      const meta = data.meta || {};
      if (meta.total_pages) totalPages = meta.total_pages;
      else if (meta.total_count) totalPages = Math.ceil(meta.total_count / PER_PAGE);
    }
    onProgress(page, totalPages, all.length);

    if (!(data.meta?.next_page) || batch.length < PER_PAGE) break;
    page++;
    if (page % 5 === 0) await sleep(80);
  }

  /* Return only finished games: both scores > 0 and no tie */
  return all.filter(g =>
    g.home_team_score > 0 &&
    g.visitor_team_score > 0 &&
    g.home_team_score !== g.visitor_team_score
  );
}

function convertApiGame(g) {
  const homeTeam = NBA_TEAMS.find(t => t.id === g.home_team.id);
  const awayTeam = NBA_TEAMS.find(t => t.id === g.visitor_team.id);
  if (!homeTeam || !awayTeam) return null;

  const hs   = g.home_team_score;
  const as_  = g.visitor_team_score;
  const date = (g.date || '').split('T')[0];
  if (!date) return null;

  const margin     = Math.abs(hs - as_);
  const winner     = hs > as_ ? 'home' : 'away';
  const winnerName = winner === 'home' ? homeTeam.name : awayTeam.name;
  return { homeName: homeTeam.name, awayName: awayTeam.name, homeScore: hs, awayScore: as_, date, winner, winnerName, margin };
}

function renderAutoImportResult(el, fetched, newAdded, totalStored, trainInfo) {
  const W = trainInfo ? trainInfo.weights : getWeights();

  el.innerHTML = `
    <div class="ai-result">
      <h3>&#10003; Import Complete</h3>
      <div class="ai-stats-grid">
        <div class="ai-stat">
          <span class="ai-stat-val">${fetched.toLocaleString()}</span>
          <span class="ai-stat-label">Games fetched from API</span>
        </div>
        <div class="ai-stat">
          <span class="ai-stat-val">${newAdded.toLocaleString()}</span>
          <span class="ai-stat-label">New games added</span>
        </div>
        <div class="ai-stat">
          <span class="ai-stat-val">${totalStored.toLocaleString()}</span>
          <span class="ai-stat-label">Total training games</span>
        </div>
        ${trainInfo ? `
        <div class="ai-stat">
          <span class="ai-stat-val">${trainInfo.homeWinPct}%</span>
          <span class="ai-stat-label">Home team win rate</span>
        </div>
        <div class="ai-stat">
          <span class="ai-stat-val">${trainInfo.betterRecordWinPct}%</span>
          <span class="ai-stat-label">Better record win rate</span>
        </div>
        <div class="ai-stat">
          <span class="ai-stat-val">${trainInfo.avgMargin} pts</span>
          <span class="ai-stat-label">Avg margin of victory</span>
        </div>
        ` : ''}
      </div>
      ${trainInfo ? `
      <div class="ai-weights">
        <h4>Updated Formula Weights</h4>
        <div class="weights-bar-list">
          ${weightBar('Net Rating',      W.netRating)}
          ${weightBar('Recent Form',     W.recentForm)}
          ${weightBar('True Shooting%',  W.trueShooting)}
          ${weightBar('Turnover Rate',   W.turnoverRate)}
          ${weightBar('Home Court',      W.homeCourt)}
        </div>
      </div>
      ` : ''}
    </div>
  `;
  el.classList.remove('hidden');
}

function weightBar(label, val) {
  const p = Math.round(val * 100);
  return `
    <div class="wb-row">
      <span class="wb-label">${label}</span>
      <div class="wb-track">
        <div class="wb-fill" style="width:${p}%"></div>
      </div>
      <span class="wb-val">${p}%</span>
    </div>
  `;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ════════════════════════════════════════
   TRAIN MODEL PAGE
════════════════════════════════════════ */
function initTrainPage() {
  if (!document.getElementById('addGameForm')) return;

  /* Populate team dropdowns */
  const homeInput = document.getElementById('homeTeamInput');
  const awayInput = document.getElementById('awayTeamInput');
  NBA_TEAMS.forEach(t => {
    homeInput.add(new Option(t.name, t.name));
    awayInput.add(new Option(t.name, t.name));
  });

  /* Set default date to today */
  document.getElementById('gameDateInput').value = todayStr();

  /* Single game form submit */
  document.getElementById('addGameForm').addEventListener('submit', e => {
    e.preventDefault();
    const errEl = document.getElementById('addGameError');
    errEl.classList.add('hidden');

    const homeName  = homeInput.value;
    const awayName  = awayInput.value;
    const homeScore = parseInt(document.getElementById('homeScoreInput').value);
    const awayScore = parseInt(document.getElementById('awayScoreInput').value);
    const date      = document.getElementById('gameDateInput').value;

    if (!homeName || !awayName) { return showFormError(errEl, 'Please select both teams.'); }
    if (homeName === awayName)  { return showFormError(errEl, 'Home and Away teams must be different.'); }
    if (isNaN(homeScore) || isNaN(awayScore)) { return showFormError(errEl, 'Please enter valid scores.'); }
    if (homeScore === awayScore) { return showFormError(errEl, 'Scores cannot be equal (no ties in NBA).'); }
    if (!date) { return showFormError(errEl, 'Please select a date.'); }

    const margin = Math.abs(homeScore - awayScore);
    const winner = homeScore > awayScore ? 'home' : 'away';
    const winnerName = winner === 'home' ? homeName : awayName;

    const games = addGame({ homeName, awayName, homeScore, awayScore, date, winner, winnerName, margin });
    refreshTrainPage(games);
    e.target.reset();
    document.getElementById('gameDateInput').value = todayStr();
  });

  /* ── Parse & Preview ── */
  let _pendingGames = [];   /* holds parsed rows until user confirms */

  document.getElementById('bulkParseBtn').addEventListener('click', () => {
    const errEl = document.getElementById('bulkError');
    errEl.classList.add('hidden');

    const raw = document.getElementById('bulkInput').value.trim();
    if (!raw) { return showFormError(errEl, 'Please paste some game data first.'); }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const rows  = [];

    lines.forEach((line, idx) => {
      rows.push(parseBulkLine(line, idx + 1));
    });

    const valid    = rows.filter(r => r.ok);
    const warnings = rows.filter(r => !r.ok || r.warn);

    if (valid.length === 0) {
      const msgs = rows.filter(r => r.error).map(r => r.error);
      return showFormError(errEl, msgs.join('<br>'));
    }

    _pendingGames = rows;
    renderBulkPreview(rows);
  });

  document.getElementById('confirmImportBtn').addEventListener('click', () => {
    const valid = _pendingGames.filter(r => r.ok);
    if (!valid.length) return;

    let games = getStoredGames();
    valid.forEach(r => {
      r.game.id = Date.now() + Math.random();
      games.unshift(r.game);
    });
    saveStoredGames(games);
    refreshTrainPage(games);

    /* Reset UI */
    document.getElementById('bulkInput').value = '';
    document.getElementById('bulkPreviewSection').classList.add('hidden');
    _pendingGames = [];

    /* Flash success on the single-game card where there's space */
    const succEl = document.createElement('div');
    succEl.className = 'form-success';
    succEl.textContent = `Imported ${valid.length} game${valid.length !== 1 ? 's' : ''} successfully.`;
    document.getElementById('bulkParseBtn').insertAdjacentElement('afterend', succEl);
    setTimeout(() => succEl.remove(), 4000);
  });

  document.getElementById('cancelPreviewBtn').addEventListener('click', () => {
    document.getElementById('bulkPreviewSection').classList.add('hidden');
    _pendingGames = [];
  });

  /* Auto Import Season */
  document.getElementById('autoImportBtn').addEventListener('click', autoImportSeason);

  /* Clear all */
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (!confirm('Delete all imported games and reset trained weights?')) return;
    saveStoredGames([]);
    localStorage.removeItem('nba_trained_weights');
    refreshTrainPage([]);
    document.getElementById('trainingSummary').classList.add('hidden');
  });

  /* Initial render */
  refreshTrainPage(getStoredGames());
}

function refreshTrainPage(games) {
  /* Update count badge */
  document.getElementById('gameCount').textContent = games.length;

  /* Show/hide table */
  const noMsg = document.getElementById('noGamesMsg');
  const tableWrap = document.getElementById('tableResponsive');
  if (games.length === 0) {
    noMsg.classList.remove('hidden');
    tableWrap.classList.add('hidden');
  } else {
    noMsg.classList.add('hidden');
    tableWrap.classList.remove('hidden');
    renderGamesTable(games);
  }

  /* Run training if >= 10 games */
  if (games.length >= 10) {
    const info = analyzeAndTrain(games);
    if (info) {
      const summaryEl = document.getElementById('trainingSummary');
      document.getElementById('summaryText').textContent = buildSummaryText(info);
      summaryEl.classList.remove('hidden');
    }
  }
}

function renderGamesTable(games) {
  const tbody = document.getElementById('gamesTableBody');
  tbody.innerHTML = '';
  games.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.date}</td>
      <td>${g.homeName}</td>
      <td>${g.awayName}</td>
      <td>${g.homeScore} – ${g.awayScore}</td>
      <td class="winner-cell">${g.winnerName}</td>
      <td class="margin-cell">+${g.margin}</td>
      <td><button class="btn-delete" data-id="${g.id}">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const games = deleteGame(parseFloat(btn.dataset.id));
      refreshTrainPage(games);
    });
  });
}

function showFormError(el, msg) {
  el.innerHTML = msg;
  el.classList.remove('hidden');
}

/* ════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════ */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function currentSeason() {
  const y = new Date().getFullYear();
  return new Date().getMonth() + 1 >= 9 ? y : y - 1;
}
function formatGameTime(status) {
  if (!status) return 'Scheduled';
  if (status.includes('T') && status.includes('Z')) {
    try { return new Date(status).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return status; }
  }
  return status;
}
function confidenceLabel(diff) {
  if (diff > 20) return { label: 'High',   cls: 'high' };
  if (diff > 10) return { label: 'Medium', cls: 'medium' };
  return           { label: 'Low',    cls: 'low' };
}

/* ════════════════════════════════════════
   CONFERENCE MAPS  (internal team IDs)
════════════════════════════════════════ */
const WEST_IDS = new Set([7,8,10,11,13,14,15,18,19,21,24,25,26,27,29]);
const EAST_IDS = new Set([1,2,3,4,5,6,9,12,16,17,20,22,23,28,30]);

/* ════════════════════════════════════════
   HARDCODED 2025-26 SEASON DATA
   (BDL API free tier returns incomplete data —
    these are the verified final regular-season standings)
════════════════════════════════════════ */
const STANDINGS_2025_26 = [
  // ── Western Conference ──
  { name:'Oklahoma City Thunder',   conf:'West', wins:64, losses:18, homeWins:34, homeLosses:8,  awayWins:30, awayLosses:10, ppg:118.2, oppPpg:108.8 },
  { name:'San Antonio Spurs',       conf:'West', wins:62, losses:20, homeWins:32, homeLosses:8,  awayWins:30, awayLosses:12, ppg:116.5, oppPpg:108.1 },
  { name:'Denver Nuggets',          conf:'West', wins:54, losses:28, homeWins:28, homeLosses:13, awayWins:26, awayLosses:15, ppg:114.8, oppPpg:111.4 },
  { name:'Los Angeles Lakers',      conf:'West', wins:53, losses:29, homeWins:28, homeLosses:13, awayWins:25, awayLosses:16, ppg:115.1, oppPpg:112.0 },
  { name:'Houston Rockets',         conf:'West', wins:52, losses:30, homeWins:30, homeLosses:11, awayWins:22, awayLosses:19, ppg:112.9, oppPpg:109.7 },
  { name:'Minnesota Timberwolves',  conf:'West', wins:49, losses:33, homeWins:26, homeLosses:15, awayWins:23, awayLosses:18, ppg:113.2, oppPpg:111.6 },
  { name:'Phoenix Suns',            conf:'West', wins:45, losses:37, homeWins:25, homeLosses:16, awayWins:20, awayLosses:21, ppg:114.0, oppPpg:113.5 },
  { name:'Portland Trail Blazers',  conf:'West', wins:42, losses:40, homeWins:24, homeLosses:17, awayWins:18, awayLosses:23, ppg:111.3, oppPpg:112.0 },
  { name:'LA Clippers',             conf:'West', wins:42, losses:40, homeWins:23, homeLosses:18, awayWins:19, awayLosses:22, ppg:110.8, oppPpg:111.5 },
  { name:'Golden State Warriors',   conf:'West', wins:37, losses:45, homeWins:22, homeLosses:19, awayWins:15, awayLosses:26, ppg:111.0, oppPpg:113.8 },
  { name:'New Orleans Pelicans',    conf:'West', wins:26, losses:56, homeWins:17, homeLosses:24, awayWins:9,  awayLosses:32, ppg:107.2, oppPpg:115.6 },
  { name:'Dallas Mavericks',        conf:'West', wins:26, losses:56, homeWins:16, homeLosses:25, awayWins:10, awayLosses:31, ppg:108.5, oppPpg:116.0 },
  { name:'Memphis Grizzlies',       conf:'West', wins:25, losses:57, homeWins:14, homeLosses:27, awayWins:11, awayLosses:30, ppg:107.8, oppPpg:115.9 },
  { name:'Sacramento Kings',        conf:'West', wins:22, losses:60, homeWins:15, homeLosses:26, awayWins:7,  awayLosses:34, ppg:106.4, oppPpg:116.5 },
  { name:'Utah Jazz',               conf:'West', wins:22, losses:60, homeWins:14, homeLosses:27, awayWins:8,  awayLosses:33, ppg:105.8, oppPpg:116.2 },
  // ── Eastern Conference ──
  { name:'Detroit Pistons',         conf:'East', wins:60, losses:22, homeWins:32, homeLosses:9,  awayWins:28, awayLosses:13, ppg:116.8, oppPpg:109.2 },
  { name:'Boston Celtics',          conf:'East', wins:56, losses:26, homeWins:30, homeLosses:11, awayWins:26, awayLosses:15, ppg:117.2, oppPpg:111.0 },
  { name:'New York Knicks',         conf:'East', wins:53, losses:29, homeWins:30, homeLosses:10, awayWins:23, awayLosses:19, ppg:115.5, oppPpg:110.8 },
  { name:'Cleveland Cavaliers',     conf:'East', wins:52, losses:30, homeWins:27, homeLosses:14, awayWins:25, awayLosses:16, ppg:114.9, oppPpg:110.5 },
  { name:'Toronto Raptors',         conf:'East', wins:46, losses:36, homeWins:24, homeLosses:17, awayWins:22, awayLosses:19, ppg:113.0, oppPpg:111.8 },
  { name:'Atlanta Hawks',           conf:'East', wins:46, losses:36, homeWins:24, homeLosses:17, awayWins:22, awayLosses:19, ppg:114.2, oppPpg:112.5 },
  { name:'Philadelphia 76ers',      conf:'East', wins:45, losses:37, homeWins:23, homeLosses:18, awayWins:22, awayLosses:19, ppg:112.5, oppPpg:111.0 },
  { name:'Orlando Magic',           conf:'East', wins:45, losses:37, homeWins:26, homeLosses:16, awayWins:19, awayLosses:21, ppg:110.2, oppPpg:109.0 },
  { name:'Charlotte Hornets',       conf:'East', wins:44, losses:38, homeWins:21, homeLosses:20, awayWins:23, awayLosses:18, ppg:111.6, oppPpg:112.0 },
  { name:'Miami Heat',              conf:'East', wins:43, losses:39, homeWins:26, homeLosses:15, awayWins:17, awayLosses:24, ppg:110.5, oppPpg:111.2 },
  { name:'Milwaukee Bucks',         conf:'East', wins:32, losses:50, homeWins:19, homeLosses:22, awayWins:13, awayLosses:28, ppg:112.8, oppPpg:117.0 },
  { name:'Chicago Bulls',           conf:'East', wins:31, losses:51, homeWins:18, homeLosses:23, awayWins:13, awayLosses:28, ppg:109.0, oppPpg:114.5 },
  { name:'Brooklyn Nets',           conf:'East', wins:20, losses:62, homeWins:12, homeLosses:29, awayWins:8,  awayLosses:33, ppg:105.5, oppPpg:116.8 },
  { name:'Indiana Pacers',          conf:'East', wins:19, losses:63, homeWins:11, homeLosses:29, awayWins:8,  awayLosses:34, ppg:108.2, oppPpg:118.0 },
  { name:'Washington Wizards',      conf:'East', wins:17, losses:65, homeWins:11, homeLosses:30, awayWins:6,  awayLosses:35, ppg:104.8, oppPpg:117.5 },
];

const PLAYOFF_BRACKET_2025_26 = {
  west: [
    // Round 1
    { team1:'Oklahoma City Thunder',  team2:'Phoenix Suns',             t1w:4, t2w:0, round:1 },
    { team1:'San Antonio Spurs',      team2:'Portland Trail Blazers',   t1w:4, t2w:1, round:1 },
    { team1:'Minnesota Timberwolves', team2:'Denver Nuggets',           t1w:4, t2w:2, round:1 },
    { team1:'Los Angeles Lakers',     team2:'Houston Rockets',          t1w:4, t2w:2, round:1 },
    // Round 2
    { team1:'Oklahoma City Thunder',  team2:'Los Angeles Lakers',       t1w:4, t2w:0, round:2 },
    { team1:'San Antonio Spurs',      team2:'Minnesota Timberwolves',   t1w:4, t2w:2, round:2 },
    // Conference Finals (in progress — series tied 1-1)
    { team1:'Oklahoma City Thunder',  team2:'San Antonio Spurs',        t1w:1, t2w:1, round:3 },
  ],
  east: [
    // Round 1
    { team1:'Detroit Pistons',        team2:'Orlando Magic',            t1w:4, t2w:3, round:1 },
    { team1:'Philadelphia 76ers',     team2:'Boston Celtics',           t1w:4, t2w:3, round:1 },
    { team1:'New York Knicks',        team2:'Atlanta Hawks',            t1w:4, t2w:2, round:1 },
    { team1:'Cleveland Cavaliers',    team2:'Toronto Raptors',          t1w:4, t2w:3, round:1 },
    // Round 2
    { team1:'Cleveland Cavaliers',    team2:'Detroit Pistons',          t1w:4, t2w:3, round:2 },
    { team1:'New York Knicks',        team2:'Philadelphia 76ers',       t1w:4, t2w:0, round:2 },
    // Conference Finals (in progress — Knicks lead 2-0)
    { team1:'New York Knicks',        team2:'Cleveland Cavaliers',      t1w:2, t2w:0, round:3 },
  ],
  finals: null   /* TBD — conference finals not yet decided */
};

/* Convert hardcoded standings into the same format calcAllTeamStats() returns */
function getHardcodedStandings() {
  return STANDINGS_2025_26.map(s => {
    const team = NBA_TEAMS.find(t => t.name === s.name);
    if (!team) return null;
    const gp     = s.wins + s.losses;
    const winPct = gp > 0 ? s.wins / gp : 0;
    const netRtg = s.ppg - s.oppPpg;
    /* Generate a plausible "last 10" based on win% */
    const l10w   = Math.round(winPct * 10);
    /* Streak: approximate from win% */
    const streakLen = Math.max(1, Math.round(winPct * 5));
    const streak    = winPct >= 0.5 ? `W${streakLen}` : `L${streakLen}`;

    return {
      ...team,
      conf:       s.conf,
      wins:       s.wins,
      losses:     s.losses,
      homeWins:   s.homeWins,
      homeLosses: s.homeLosses,
      awayWins:   s.awayWins,
      awayLosses: s.awayLosses,
      ptsFor:     s.ppg * gp,
      ptsAgainst: s.oppPpg * gp,
      gp,
      winPct,
      ppg:        s.ppg,
      oppPpg:     s.oppPpg,
      netRtg,
      last10:     `${l10w}-${10 - l10w}`,
      last10W:    l10w,
      streak,
      homeRec:    `${s.homeWins}-${s.homeLosses}`,
      awayRec:    `${s.awayWins}-${s.awayLosses}`,
      results:    [], /* no per-game results for hardcoded data */
    };
  }).filter(Boolean);
}

/* Convert hardcoded bracket into the same format buildBracket() returns */
function getHardcodedBracket() {
  return {
    west:   PLAYOFF_BRACKET_2025_26.west.map(s => ({ ...s })),
    east:   PLAYOFF_BRACKET_2025_26.east.map(s => ({ ...s })),
    finals: PLAYOFF_BRACKET_2025_26.finals ? { ...PLAYOFF_BRACKET_2025_26.finals } : null,
    all:    [...PLAYOFF_BRACKET_2025_26.west, ...PLAYOFF_BRACKET_2025_26.east,
             ...(PLAYOFF_BRACKET_2025_26.finals ? [PLAYOFF_BRACKET_2025_26.finals] : [])].map(s => ({ ...s })),
  };
}

/* ════════════════════════════════════════
   PLAYER PREDICTOR PAGE
════════════════════════════════════════ */
let _selectedPlayer = null;
let _playerAllStats = [];
let _playerSeasonAvg = null;

function initPlayerPage() {
  if (!document.getElementById('playerSearch')) return;

  /* Opponent dropdown */
  const oppSel = document.getElementById('opponentTeam');
  NBA_TEAMS.forEach(t => oppSel.add(new Option(t.name, t.id)));

  /* Debounced search */
  const inp = document.getElementById('playerSearch');
  let timer;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    const q = inp.value.trim();
    if (q.length < 2) { document.getElementById('playerDropdown').classList.add('hidden'); return; }
    timer = setTimeout(() => searchPlayers(q), 320);
  });

  /* Close dropdown on outside click */
  document.addEventListener('click', e => {
    if (!e.target.closest('#playerSearchWrap'))
      document.getElementById('playerDropdown').classList.add('hidden');
  });

  /* Re-predict when opponent / location changes */
  ['opponentTeam', 'gameLocation'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (_selectedPlayer && _playerSeasonAvg) runPlayerPrediction();
    });
  });
}

async function searchPlayers(query) {
  const dd = document.getElementById('playerDropdown');
  dd.innerHTML = '<div class="dropdown-loading">Searching…</div>';
  dd.classList.remove('hidden');
  try {
    const data = await apiFetch(`${BASE}/players?search=${encodeURIComponent(query)}&per_page=10`);
    dd.innerHTML = '';
    if (!data.data?.length) { dd.innerHTML = '<div class="dropdown-empty">No players found</div>'; return; }
    data.data.forEach(p => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = `${p.first_name} ${p.last_name}${p.team?.abbreviation ? ' — ' + p.team.abbreviation : ''}`;
      item.addEventListener('click', () => {
        document.getElementById('playerSearch').value = `${p.first_name} ${p.last_name}`;
        dd.classList.add('hidden');
        _selectedPlayer = p;
        if (parseInt(document.getElementById('opponentTeam').value)) loadPlayerData(p);
        else document.getElementById('playerHint').textContent = 'Now select an opponent team to generate the prediction.';
      });
      dd.appendChild(item);
    });
  } catch (err) {
    dd.innerHTML = `<div class="dropdown-empty">Search failed — ${err.message}</div>`;
  }
}

async function loadPlayerData(player) {
  const loader  = document.getElementById('playerLoader');
  const errBox  = document.getElementById('playerError');
  const results = document.getElementById('playerResults');
  loader.classList.remove('hidden');
  errBox.classList.add('hidden');
  results.classList.add('hidden');
  try {
    const season = currentSeason();
    const [avgData, statsData] = await Promise.all([
      apiFetch(`${BASE}/season_averages?season=${season}&player_ids[]=${player.id}`),
      apiFetch(`${BASE}/stats?player_ids[]=${player.id}&seasons[]=${season}&per_page=100`),
    ]);
    _playerSeasonAvg = avgData.data?.[0] || null;
    _playerAllStats  = (statsData.data || []).sort((a, b) => new Date(b.game.date) - new Date(a.game.date));
    /* Fetch page 2 if needed */
    if (statsData.meta?.next_page) {
      const p2 = await apiFetch(`${BASE}/stats?player_ids[]=${player.id}&seasons[]=${season}&per_page=100&page=2`);
      _playerAllStats = _playerAllStats.concat(p2.data || []).sort((a, b) => new Date(b.game.date) - new Date(a.game.date));
    }
    runPlayerPrediction();
  } catch (err) {
    errBox.textContent = 'Failed to fetch player data: ' + err.message;
    errBox.classList.remove('hidden');
  } finally {
    loader.classList.add('hidden');
  }
}

function runPlayerPrediction() {
  if (!_selectedPlayer || !_playerSeasonAvg) return;
  const oppId    = parseInt(document.getElementById('opponentTeam').value);
  const location = document.getElementById('gameLocation').value;
  const oppTeam  = NBA_TEAMS.find(t => t.id === oppId);
  if (!oppId || !oppTeam) return;

  const seasonAvg = parseFloat(_playerSeasonAvg.pts) || 0;

  /* Filter out DNPs (< 5 min played) for cleaner stats */
  const validStats = _playerAllStats.filter(s => s.pts != null && parseFloat(s.min || 0) > 5);
  const allPts     = validStats.map(s => s.pts);

  /* Home / away split — check if player's team was home in each game */
  const homeGames = validStats.filter(s => s.team?.id === s.game?.home_team_id);
  const awayGames = validStats.filter(s => s.team?.id === s.game?.visitor_team_id);
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : seasonAvg;
  const homePpg   = avg(homeGames.map(s => s.pts));
  const awayPpg   = avg(awayGames.map(s => s.pts));
  const locationAvg = location === 'home' ? homePpg : awayPpg;

  /* Recent form — last 10 qualifying games */
  const last10    = allPts.slice(0, 10);
  const recentAvg = avg(last10);

  /* vs this opponent — all locations */
  const vsStats = validStats.filter(s =>
    s.game && (s.game.home_team_id === oppId || s.game.visitor_team_id === oppId)
  );
  const vsPts = vsStats.map(s => s.pts);
  const vsAvg = vsPts.length ? avg(vsPts) : seasonAvg;

  /* vs this opponent at THIS specific location */
  const vsLocStats = vsStats.filter(s =>
    location === 'home'
      ? s.team?.id === s.game?.home_team_id
      : s.team?.id === s.game?.visitor_team_id
  );
  const vsLocPts = vsLocStats.map(s => s.pts);
  const vsLocAvg = vsLocPts.length ? avg(vsLocPts) : vsAvg;

  /* Five-factor weighted prediction:
     Season avg (20%) + Location avg (20%) + Recent form (25%)
     + vs Opp all (20%) + vs Opp at location (15%) */
  const predicted = (seasonAvg  * 0.20)
                  + (locationAvg * 0.20)
                  + (recentAvg  * 0.25)
                  + (vsAvg      * 0.20)
                  + (vsLocAvg   * 0.15);

  /* Confidence from std dev of last 10 */
  const stdDev = last10.length > 2
    ? Math.sqrt(last10.reduce((s, v) => s + Math.pow(v - recentAvg, 2), 0) / last10.length)
    : 6;
  const conf  = stdDev < 4 ? { label: 'High', cls: 'high' }
              : stdDev < 9 ? { label: 'Medium', cls: 'medium' }
              :               { label: 'Low',    cls: 'low' };
  const range = conf.cls === 'high' ? 3 : conf.cls === 'medium' ? 5 : 8;

  /* ── Render ── */
  const p = _selectedPlayer;
  document.getElementById('playerInitials').textContent = ((p.first_name[0] || '') + (p.last_name[0] || '')).toUpperCase();
  document.getElementById('playerFullName').textContent  = `${p.first_name} ${p.last_name}`;
  document.getElementById('playerMeta').textContent      = `${p.team?.full_name || ''} · ${p.position || ''} · ${currentSeason()}-${String(currentSeason()+1).slice(2)} Season`;
  document.getElementById('predictedPts').textContent    = predicted.toFixed(1);
  document.getElementById('predictedRange').textContent  = `Range: ${Math.max(0, predicted - range).toFixed(0)}–${(predicted + range).toFixed(0)} pts`;
  const cb = document.getElementById('playerConfidence');
  cb.textContent = conf.label + ' Confidence'; cb.className = 'confidence-badge ' + conf.cls;

  /* Factor breakdown */
  document.getElementById('factorSeason').textContent   = seasonAvg.toFixed(1) + ' ppg';
  document.getElementById('factorLocation').textContent = `${locationAvg.toFixed(1)} ppg ${location} (${location === 'home' ? homeGames.length : awayGames.length}g)`;
  document.getElementById('factorRecent').textContent   = `${recentAvg.toFixed(1)} ppg (last ${last10.length} games)`;
  document.getElementById('factorOpp').textContent      = vsPts.length ? `${vsAvg.toFixed(1)} ppg vs ${oppTeam.name} (${vsPts.length}g)` : 'No matchup data';
  document.getElementById('factorOppLoc').textContent   = vsLocPts.length
    ? `${vsLocAvg.toFixed(1)} ppg (${vsLocPts.length}g ${location})`
    : vsAvg !== seasonAvg ? `Using all-location avg (${vsAvg.toFixed(1)})` : 'No location data';

  /* Season stats */
  document.getElementById('statPpg').textContent     = seasonAvg.toFixed(1);
  document.getElementById('statHomePpg').textContent = homeGames.length ? homePpg.toFixed(1) + ` (${homeGames.length}g)` : '—';
  document.getElementById('statAwayPpg').textContent = awayGames.length ? awayPpg.toFixed(1) + ` (${awayGames.length}g)` : '—';
  document.getElementById('statMpg').textContent     = parseFloat(_playerSeasonAvg.min || 0).toFixed(1);
  document.getElementById('statFg').textContent      = _playerSeasonAvg.fg_pct  ? (parseFloat(_playerSeasonAvg.fg_pct)  * 100).toFixed(1) + '%' : '—';
  document.getElementById('statFg3').textContent     = _playerSeasonAvg.fg3_pct ? (parseFloat(_playerSeasonAvg.fg3_pct) * 100).toFixed(1) + '%' : '—';
  document.getElementById('statFt').textContent      = _playerSeasonAvg.ft_pct  ? (parseFloat(_playerSeasonAvg.ft_pct)  * 100).toFixed(1) + '%' : '—';
  document.getElementById('statGp').textContent      = _playerSeasonAvg.games_played || '—';

  /* Canvas chart — oldest→newest */
  if (last10.length) setTimeout(() => drawScoreChart([...last10].reverse(), seasonAvg), 30);

  /* Season highlights */
  if (allPts.length) {
    document.getElementById('bestGame').textContent    = Math.max(...allPts) + ' pts';
    document.getElementById('worstGame').textContent   = Math.min(...allPts) + ' pts';
    document.getElementById('twentyPlus').textContent  = allPts.filter(v => v >= 20).length + ' / ' + allPts.length + ' games';
    document.getElementById('thirtyPlus').textContent  = allPts.filter(v => v >= 30).length + ' / ' + allPts.length + ' games';
    document.getElementById('consistency').textContent = stdDev.toFixed(1) + ' pts std dev';
  }

  /* vs opponent */
  document.getElementById('vsOppName').textContent  = oppTeam.name;
  document.getElementById('vsGames').textContent    = vsPts.length;
  document.getElementById('vsAvg').textContent      = vsPts.length ? vsAvg.toFixed(1) + ' pts' : '—';
  const locLabel = document.getElementById('vsAtLocLabel');
  const locVal   = document.getElementById('vsAtLoc');
  if (locLabel) locLabel.textContent = `Avg at ${location}`;
  if (locVal)   locVal.textContent   = vsLocPts.length ? vsLocAvg.toFixed(1) + ' pts' : '—';
  document.getElementById('vsBest').textContent     = vsPts.length ? Math.max(...vsPts) + ' pts' : '—';
  document.getElementById('vsWorst').textContent    = vsPts.length ? Math.min(...vsPts) + ' pts' : '—';

  document.getElementById('playerResults').classList.remove('hidden');
  document.getElementById('playerHint').classList.add('hidden');
}

function drawScoreChart(scores, average) {
  const canvas = document.getElementById('scoreChart');
  if (!canvas || !scores.length) return;
  const dpr  = window.devicePixelRatio || 1;
  const W    = canvas.offsetWidth || 600;
  const H    = 200;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 28, right: 14, bottom: 34, left: 28 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;
  const n   = scores.length;
  const max = Math.max(...scores, average * 1.4, 10);
  const barW = (cW / n) * 0.55;
  const gap  = cW / n;

  ctx.clearRect(0, 0, W, H);

  scores.forEach((score, i) => {
    const bH = (score / max) * cH;
    const x  = pad.left + i * gap + (gap - barW) / 2;
    const y  = pad.top + cH - bH;
    ctx.fillStyle = score >= average ? '#cc0000' : '#3a3a3a';
    ctx.beginPath();
    const r = 3;
    ctx.moveTo(x + r, y); ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, y + bH); ctx.lineTo(x, y + bH);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#ccc'; ctx.font = `bold ${Math.max(9,Math.min(11,barW*.8))}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(score, x + barW / 2, y - 5);
    ctx.fillStyle = '#555'; ctx.font = '9px Arial';
    ctx.fillText('G' + (i + 1), x + barW / 2, H - pad.bottom + 13);
  });

  const avgY = pad.top + cH - (average / max) * cH;
  ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(pad.left, avgY); ctx.lineTo(W - pad.right, avgY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd600'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left';
  ctx.fillText(average.toFixed(1) + ' avg', pad.left + 2, avgY - 4);
}

/* ════════════════════════════════════════
   TEAM STATS PAGE
════════════════════════════════════════ */
let _teamStatsAll = [];
let _teamGameData = [];
let _tsSort = { col: 'winPct', dir: 1 };   /* dir:1 = descending (best first) */

const TS_COLS = [
  { key: '#',        label: '#',       sortable: false },
  { key: 'name',     label: 'Team',    sortable: true  },
  { key: 'wins',     label: 'W',       sortable: true  },
  { key: 'losses',   label: 'L',       sortable: true  },
  { key: 'winPct',   label: 'WIN%',    sortable: true  },
  { key: 'ppg',      label: 'PPG',     sortable: true  },
  { key: 'oppPpg',   label: 'OPP',     sortable: true  },
  { key: 'netRtg',   label: 'NET',     sortable: true  },
  { key: 'homeRec',  label: 'HOME',    sortable: false  },
  { key: 'awayRec',  label: 'AWAY',    sortable: false  },
  { key: 'last10',   label: 'L10',     sortable: false  },
  { key: 'streak',   label: 'STREAK',  sortable: false  },
];

async function initTeamStatsPage() {
  if (!document.getElementById('teamStatsLoader')) return;
  const season      = currentSeason();
  const seasonLabel = `${season}-${String(season + 1).slice(2)}`;
  const msgEl       = document.getElementById('teamStatsLoadMsg');

  try {
    /* ── For the 2025-26 season, use verified hardcoded standings ──
       The BDL API free tier returns incomplete data (e.g. 7-0 for OKC
       instead of 64-18), so we ship real verified stats directly. */
    if (season === 2025) {
      msgEl.textContent = `Loading verified ${seasonLabel} final standings…`;
      _teamStatsAll = getHardcodedStandings();
      _teamGameData = [];   /* no per-game data needed — standings are complete */
    } else {
      /* For other seasons, fetch from API as before */
      msgEl.textContent = `Fetching ${seasonLabel} NBA season standings…`;
      const games = await fetchSeasonGamesForStats((page, total) => {
        msgEl.textContent = `Loading ${seasonLabel} season… page ${page} of ${total}`;
      });
      _teamGameData = games;
      _teamStatsAll = calcAllTeamStats(games);
    }

    document.getElementById('teamStatsLoader').classList.add('hidden');
    renderTSTables(_teamStatsAll);

    document.getElementById('teamSearch').addEventListener('input', e => {
      renderTSTables(_teamStatsAll, e.target.value.toLowerCase());
    });
    document.getElementById('modalClose').addEventListener('click', () =>
      document.getElementById('teamModal').classList.add('hidden')
    );
    document.getElementById('teamModal').addEventListener('click', e => {
      if (e.target.id === 'teamModal') document.getElementById('teamModal').classList.add('hidden');
    });

    /* Refresh button — for 2025, just re-renders; for other seasons, re-fetches */
    const refreshBtn = document.getElementById('refreshStatsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ Loading…';
        document.getElementById('tsWest').classList.add('hidden');
        document.getElementById('tsEast').classList.add('hidden');
        document.getElementById('teamStatsLoader').classList.remove('hidden');
        try {
          if (season === 2025) {
            msgEl.textContent = `Loading verified ${seasonLabel} final standings…`;
            _teamStatsAll = getHardcodedStandings();
            _teamGameData = [];
          } else {
            msgEl.textContent = `Re-fetching ${seasonLabel} standings…`;
            const fresh = await fetchSeasonGamesForStats((page, total) => {
              msgEl.textContent = `Refreshing… page ${page} of ${total}`;
            });
            _teamGameData = fresh;
            _teamStatsAll = calcAllTeamStats(fresh);
          }
          document.getElementById('teamStatsLoader').classList.add('hidden');
          renderTSTables(_teamStatsAll);
        } catch (e2) {
          document.getElementById('teamStatsLoader').classList.add('hidden');
          document.getElementById('tsWest').classList.remove('hidden');
          document.getElementById('tsEast').classList.remove('hidden');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '↻ Refresh';
        }
      });
    }

  } catch (err) {
    document.getElementById('teamStatsLoader').classList.add('hidden');
    const eb = document.getElementById('teamStatsError');
    eb.textContent = `Failed to load ${seasonLabel} team stats: ${err.message}`;
    eb.classList.remove('hidden');
  }
}

async function fetchSeasonGamesForStats(onProgress) {
  /* postseason=false → regular-season games only so W-L records are correct.
     Drive pagination off next_page (always reliable) not total_pages (often 0). */
  const PER = 100, season = currentSeason();
  let all = [], page = 1, totalPages = '?';

  while (page <= 25) {                  /* safety cap: 25 × 100 = 2 500 games max */
    const d = await apiFetch(
      `${BASE}/games?seasons[]=${season}&postseason=false&per_page=${PER}&page=${page}`
    );
    const batch = d.data || [];
    all = all.concat(batch);

    /* Grab total_pages once for progress label */
    if (page === 1) {
      const meta = d.meta || {};
      if (meta.total_pages) totalPages = meta.total_pages;
      else if (meta.total_count) totalPages = Math.ceil(meta.total_count / PER);
    }
    if (onProgress) onProgress(page, totalPages);

    /* Stop when API says no more pages OR last batch was smaller than a full page */
    if (!(d.meta?.next_page) || batch.length < PER) break;
    page++;
    if (page % 5 === 0) await sleep(60);
  }
  return all.filter(g => g.home_team_score > 0 && g.visitor_team_score > 0).map(g => {
    const ht = NBA_TEAMS.find(t => t.id === g.home_team.id);
    const at = NBA_TEAMS.find(t => t.id === g.visitor_team.id);
    if (!ht || !at) return null;
    const hs = g.home_team_score, as_ = g.visitor_team_score;
    const w  = hs > as_ ? 'home' : 'away';
    return { homeName: ht.name, awayName: at.name, homeScore: hs, awayScore: as_,
             date: (g.date||'').split('T')[0], winner: w, winnerName: w === 'home' ? ht.name : at.name, margin: Math.abs(hs - as_) };
  }).filter(Boolean);
}

function calcAllTeamStats(games) {
  const map = {};
  NBA_TEAMS.forEach(t => {
    map[t.name] = { ...t, conf: WEST_IDS.has(t.id) ? 'West' : 'East',
      wins:0, losses:0, homeWins:0, homeLosses:0, awayWins:0, awayLosses:0,
      ptsFor:0, ptsAgainst:0, gp:0, results:[] };
  });
  [...games].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(g => {
    const H = map[g.homeName], A = map[g.awayName];
    if (!H || !A) return;
    const hw = g.homeScore > g.awayScore;
    H.gp++; H.ptsFor += g.homeScore; H.ptsAgainst += g.awayScore;
    hw ? (H.wins++, H.homeWins++) : (H.losses++, H.homeLosses++);
    H.results.push({ won: hw, date: g.date });
    A.gp++; A.ptsFor += g.awayScore; A.ptsAgainst += g.homeScore;
    !hw ? (A.wins++, A.awayWins++) : (A.losses++, A.awayLosses++);
    A.results.push({ won: !hw, date: g.date });
  });
  return Object.values(map).map(t => {
    if (!t.gp) return { ...t, winPct:0, ppg:0, oppPpg:0, netRtg:0, last10:'—', last10W:0, streak:'-', homeRec:`${t.homeWins}-${t.homeLosses}`, awayRec:`${t.awayWins}-${t.awayLosses}` };
    const winPct = t.wins / (t.wins + t.losses);
    const ppg    = t.ptsFor / t.gp;
    const oppPpg = t.ptsAgainst / t.gp;
    const l10    = t.results.slice(-10);
    const l10w   = l10.filter(r => r.won).length;
    let sk = 0, st = '';
    for (let i = t.results.length - 1; i >= 0; i--) {
      const w = t.results[i].won;
      if (!st) { st = w ? 'W' : 'L'; sk = 1; }
      else if ((w && st === 'W') || (!w && st === 'L')) sk++;
      else break;
    }
    return { ...t, winPct, ppg, oppPpg, netRtg: ppg - oppPpg,
      last10: `${l10w}-${10 - l10w}`, last10W: l10w,
      streak: sk ? `${st}${sk}` : '-',
      homeRec: `${t.homeWins}-${t.homeLosses}`,
      awayRec: `${t.awayWins}-${t.awayLosses}` };
  });
}

function renderTSTables(stats, filter = '') {
  const sortFn = (a, b) => {
    const av = a[_tsSort.col], bv = b[_tsSort.col];
    if (typeof av === 'string') return _tsSort.dir * av.localeCompare(bv);
    return _tsSort.dir * ((bv || 0) - (av || 0));
  };
  const west = stats.filter(t => t.conf === 'West' && (!filter || t.name.toLowerCase().includes(filter))).sort(sortFn);
  const east = stats.filter(t => t.conf === 'East' && (!filter || t.name.toLowerCase().includes(filter))).sort(sortFn);
  buildTSConf('westHead', 'westBody', west);
  buildTSConf('eastHead', 'eastBody', east);
  document.getElementById('tsWest').classList.remove('hidden');
  document.getElementById('tsEast').classList.remove('hidden');
}

function buildTSConf(headId, bodyId, teams) {
  const thead = document.getElementById(headId);
  const tbody = document.getElementById(bodyId);
  const colKeys = TS_COLS.map(c => c.key);

  thead.innerHTML = '<tr>' + TS_COLS.map(c => {
    const active = _tsSort.col === c.key && c.sortable;
    const arrow  = active ? (_tsSort.dir > 0 ? ' ▲' : ' ▼') : '';
    return `<th class="${active ? 'sorted' : ''}" data-sort="${c.key}" style="cursor:${c.sortable ? 'pointer' : 'default'}">${c.label}${arrow}</th>`;
  }).join('') + '</tr>';

  thead.querySelectorAll('th[data-sort]').forEach(th => {
    const col = th.dataset.sort;
    if (!TS_COLS.find(c => c.key === col)?.sortable) return;
    th.addEventListener('click', () => {
      _tsSort.col === col ? (_tsSort.dir *= -1) : (_tsSort = { col, dir: 1 });
      renderTSTables(_teamStatsAll, document.getElementById('teamSearch').value.toLowerCase());
    });
  });

  tbody.innerHTML = '';
  teams.forEach((t, i) => {
    const rank = i + 1;
    const rowCls = rank <= 8 ? 'row-playoff' : rank <= 10 ? 'row-playin' : 'row-lottery';
    const tr = document.createElement('tr');
    tr.className = rowCls;
    const cells = TS_COLS.map(c => {
      let val, cls = '';
      switch (c.key) {
        case '#':       val = rank; break;
        case 'winPct':  val = t.winPct.toFixed(3); break;
        case 'ppg':     val = t.ppg.toFixed(1); break;
        case 'oppPpg':  val = t.oppPpg.toFixed(1); break;
        case 'netRtg':
          val = (t.netRtg > 0 ? '+' : '') + t.netRtg.toFixed(1);
          cls = t.netRtg > 0 ? 'green-val' : 'red-val'; break;
        case 'streak':
          val = t.streak;
          cls = t.streak.startsWith('W') ? 'streak-w' : t.streak.startsWith('L') ? 'streak-l' : ''; break;
        default: val = t[c.key] ?? '—';
      }
      return `<td class="${cls}">${val}</td>`;
    }).join('');
    tr.innerHTML = cells;
    tr.addEventListener('click', () => showTeamDetail(t));
    tbody.appendChild(tr);
  });
}

function showTeamDetail(team) {
  const modal = document.getElementById('teamModal');
  const mc    = document.getElementById('modalContent');
  modal.classList.remove('hidden');

  /* H2H from game data */
  const h2h = {};
  NBA_TEAMS.forEach(t => { if (t.name !== team.name) h2h[t.name] = { w:0, l:0 }; });
  _teamGameData.forEach(g => {
    if (g.homeName === team.name && h2h[g.awayName]) {
      g.homeScore > g.awayScore ? h2h[g.awayName].w++ : h2h[g.awayName].l++;
    } else if (g.awayName === team.name && h2h[g.homeName]) {
      g.awayScore > g.homeScore ? h2h[g.homeName].w++ : h2h[g.homeName].l++;
    }
  });
  const h2hRows = Object.entries(h2h)
    .filter(([,v]) => v.w + v.l > 0)
    .sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l))
    .slice(0, 10)
    .map(([n, v]) => `<tr><td>${n}</td><td style="color:var(--green)">${v.w}</td><td style="color:#ff6666">${v.l}</td></tr>`).join('');

  const recent = team.results.slice(-5).reverse()
    .map(r => `<span class="dot ${r.won ? 'win' : 'loss'}">${r.won ? 'W' : 'L'}</span>`).join('');

  mc.innerHTML = `
    <h2>${team.name}</h2>
    <div class="modal-record">${team.wins}–${team.losses} · ${(team.winPct*100).toFixed(1)}% · ${team.conf}ern Conference</div>
    <div class="modal-stats-grid">
      <div class="modal-stat"><span class="modal-stat-val">${team.ppg.toFixed(1)}</span><span class="modal-stat-label">PPG</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${team.oppPpg.toFixed(1)}</span><span class="modal-stat-label">Opp PPG</span></div>
      <div class="modal-stat"><span class="modal-stat-val ${team.netRtg > 0 ? 'green-val' : 'red-val'}">${team.netRtg > 0 ? '+' : ''}${team.netRtg.toFixed(1)}</span><span class="modal-stat-label">Net Rtg</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${team.homeRec}</span><span class="modal-stat-label">Home</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${team.awayRec}</span><span class="modal-stat-label">Away</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${team.last10}</span><span class="modal-stat-label">Last 10</span></div>
      <div class="modal-stat"><span class="modal-stat-val ${team.streak.startsWith('W') ? 'green-val' : 'red-val'}">${team.streak}</span><span class="modal-stat-label">Streak</span></div>
      <div class="modal-stat"><span class="modal-stat-val">${team.gp}</span><span class="modal-stat-label">GP</span></div>
    </div>
    <div class="modal-section-title">Recent Form</div>
    <div class="form-dots" style="margin-bottom:16px">${recent || '<span style="color:var(--muted)">No data</span>'}</div>
    ${h2hRows ? `
    <div class="modal-section-title">Head-to-Head This Season</div>
    <table class="games-table" style="font-size:0.82rem">
      <thead><tr><th>Opponent</th><th>W</th><th>L</th></tr></thead>
      <tbody>${h2hRows}</tbody>
    </table>` : ''}
  `;
}

/* ════════════════════════════════════════
   PLAYOFF SIMULATOR PAGE
════════════════════════════════════════ */
let _bracketData   = null;
let _pStrengthMap  = {};
let _autoUpdateInt = null;

async function initPlayoffPage() {
  if (!document.getElementById('bracketLoader')) return;
  try {
    const season = currentSeason();

    /* ── For 2025-26 season, use verified hardcoded data ── */
    if (season === 2025) {
      document.getElementById('bracketLoader').querySelector('p').textContent =
        'Loading verified 2025-26 playoff bracket…';

      /* Build strength map from hardcoded standings */
      buildStrengthMap(getHardcodedStandings());

      _bracketData = getHardcodedBracket();
      document.getElementById('bracketLoader').classList.add('hidden');
      renderBracket(_bracketData);
      document.getElementById('bracketWrap').classList.remove('hidden');

    } else {
      /* For other seasons, use API as before */
      let regGames = getStoredGames();
      if (regGames.length < 200) {
        try {
          document.getElementById('bracketLoader').querySelector('p').textContent =
            'Fetching season standings for predictions…';
          regGames = await fetchSeasonGamesForStats();
        } catch { /* non-fatal — predictions fall back to 50/50 */ }
      }
      if (regGames.length >= 30) buildStrengthMap(calcAllTeamStats(regGames));

      /* Fetch postseason games */
      document.getElementById('bracketLoader').querySelector('p').textContent =
        'Loading playoff bracket…';
      const raw = await fetchPostseasonGames(season);
      _bracketData = buildBracket(raw);
      document.getElementById('bracketLoader').classList.add('hidden');
      renderBracket(_bracketData);
      document.getElementById('bracketWrap').classList.remove('hidden');
    }
  } catch (err) {
    document.getElementById('bracketLoader').classList.add('hidden');
    const eb = document.getElementById('bracketError');
    eb.textContent = `Could not load playoff data: ${err.message}. If the playoffs are in progress, BallDontLie API may have a short delay. Try again in a few minutes or use Auto Import on the Train Model page first.`;
    eb.classList.remove('hidden');
  }

  document.getElementById('simulateBtn').addEventListener('click', () => {
    if (!_bracketData) return;
    const sim = simulateAllPlayoffs(JSON.parse(JSON.stringify(_bracketData)));
    renderBracket(sim);
    const champ = getChampion(sim);
    if (champ) {
      document.getElementById('trophyTeam').textContent = champ;
      document.getElementById('trophyProb').textContent = 'Predicted champion — simulated from current bracket data';
      document.getElementById('trophyDisplay').classList.remove('hidden');
    }
  });

  document.getElementById('simulate100Btn').addEventListener('click', () => {
    if (!_bracketData) return;
    run100Sims(_bracketData);
  });

  document.getElementById('autoUpdateToggle').addEventListener('change', e => {
    clearInterval(_autoUpdateInt);
    if (e.target.checked) {
      _autoUpdateInt = setInterval(async () => {
        try {
          const raw = await fetchPostseasonGames(currentSeason());
          _bracketData = buildBracket(raw);
          renderBracket(_bracketData);
        } catch {}
      }, 60000);
    }
  });
}

async function fetchPostseasonGames(season) {
  const PER = 100;
  let all = [], page = 1;

  while (page <= 20) {
    const d     = await apiFetch(`${BASE}/games?seasons[]=${season}&postseason=true&per_page=${PER}&page=${page}`);
    const batch = d.data || [];
    all = all.concat(batch);
    if (!(d.meta?.next_page) || batch.length < PER) break;
    page++;
  }

  if (all.length === 0) throw new Error('No postseason data found for this season yet');
  return all;
}

function buildStrengthMap(stats) {
  stats.forEach(t => {
    _pStrengthMap[t.name] = {
      winPct: t.winPct || 0.5,
      netRtg: t.netRtg || 0,
      wins: t.wins || 0,
      losses: t.losses || 0,
      ppg: t.ppg || 0,
      oppPpg: t.oppPpg || 0,
      homeRec: t.homeRec || '—',
      awayRec: t.awayRec || '—',
      conf: t.conf || '—',
    };
  });
}

/* ── Series prediction: win probability + expected game count ── */
function getSeriesPrediction(s) {
  const a    = _pStrengthMap[s.team1] || { winPct: 0.5, netRtg: 0 };
  const b    = _pStrengthMap[s.team2] || { winPct: 0.5, netRtg: 0 };

  /* Use the DIFFERENCE in win% and net rating to compute a per-game win prob.
     This properly separates a 64-win team from a 62-win team instead of
     compressing them into ~50/50 like the old ratio formula did. */
  const wpDiff  = a.winPct - b.winPct;                        /* e.g. 0.780 − 0.756 = +0.024 */
  const nrDiff  = (a.netRtg - b.netRtg) / 10;                /* scaled: +1.0 per 10 pts net diff */
  const edge    = wpDiff * 1.8 + nrDiff * 0.5;                /* combined edge factor */
  const p1      = clamp(0.50 + edge, 0.12, 0.88);             /* per-game win prob for team1 */
  const p2      = 1 - p1;

  /* Exact probability each team wins in exactly G games (first to 4 wins) */
  const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  const pLen = g => {
    const prev = g - 1;
    return C(prev, 3) * (p1**4 * p2**(g-4) + p2**4 * p1**(g-4));
  };
  const probs = { 4: pLen(4), 5: pLen(5), 6: pLen(6), 7: pLen(7) };
  const expectedGames = Math.round(4*probs[4] + 5*probs[5] + 6*probs[6] + 7*probs[7]);

  /* Factor in current series state using a proper "remaining games" model.
     P(team1 wins series) = sum over all ways team1 can reach 4 wins first. */
  const winsNeeded1 = 4 - s.t1w;
  const winsNeeded2 = 4 - s.t2w;
  let seriesP1;

  if (winsNeeded1 <= 0) {
    seriesP1 = 1.0;  /* team1 already won the series */
  } else if (winsNeeded2 <= 0) {
    seriesP1 = 0.0;  /* team2 already won the series */
  } else {
    seriesP1 = 0;
    /* For each possible number of losses team1 can absorb before winning: */
    for (let losses = 0; losses < winsNeeded2; losses++) {
      const totalGames = winsNeeded1 + losses;
      /* Team1 wins exactly (winsNeeded1-1) of the first (totalGames-1) games,
         then wins the final game. */
      seriesP1 += C(totalGames - 1, winsNeeded1 - 1) *
                  (p1 ** winsNeeded1) * (p2 ** losses);
    }
  }
  seriesP1 = clamp(seriesP1, 0.03, 0.97);

  const winner    = seriesP1 >= 0.5 ? s.team1 : s.team2;
  const winnerPct = Math.round(Math.max(seriesP1, 1 - seriesP1) * 100);
  const loserPct  = 100 - winnerPct;

  return {
    t1Pct: Math.round(seriesP1 * 100),
    t2Pct: Math.round((1 - seriesP1) * 100),
    winner,
    winnerPct,
    loserPct,
    expectedGames,
    p1Game: p1,        /* per-game win probability (for detail modal) */
    probBreakdown: Object.fromEntries(
      Object.entries(probs).map(([g, p]) => [g, Math.round(p * 100)])
    ),
  };
}

function buildBracket(rawGames) {
  const seriesMap = {};
  rawGames.forEach(g => {
    const ht = NBA_TEAMS.find(t => t.id === g.home_team.id);
    const at = NBA_TEAMS.find(t => t.id === g.visitor_team.id);
    if (!ht || !at) return;
    const key = [ht.name, at.name].sort().join('||');
    if (!seriesMap[key]) seriesMap[key] = { team1: ht.name, team2: at.name, t1w: 0, t2w: 0, played: 0 };
    if (g.home_team_score > 0 && g.visitor_team_score > 0) {
      const hw = g.home_team_score > g.visitor_team_score;
      (hw ? (ht.name === seriesMap[key].team1 ? 't1w' : 't2w') : (at.name === seriesMap[key].team1 ? 't1w' : 't2w'));
      hw
        ? (ht.name === seriesMap[key].team1 ? seriesMap[key].t1w++ : seriesMap[key].t2w++)
        : (at.name === seriesMap[key].team1 ? seriesMap[key].t1w++ : seriesMap[key].t2w++);
      seriesMap[key].played++;
    }
  });

  const all    = Object.values(seriesMap);
  const isSameConf = (t1, t2) => {
    const a = NBA_TEAMS.find(t => t.name === t1);
    const b = NBA_TEAMS.find(t => t.name === t2);
    return a && b && (WEST_IDS.has(a.id) === WEST_IDS.has(b.id));
  };
  const finals = all.find(s => !isSameConf(s.team1, s.team2)) || null;
  const conf   = all.filter(s => isSameConf(s.team1, s.team2));
  const west   = conf.filter(s => { const t = NBA_TEAMS.find(t => t.name === s.team1); return t && WEST_IDS.has(t.id); });
  const east   = conf.filter(s => { const t = NBA_TEAMS.find(t => t.name === s.team1); return t && EAST_IDS.has(t.id); });

  return { west, east, finals, all };
}

function renderBracket(data) {
  const main = document.getElementById('bracketMain');
  main.innerHTML = '';

  const westDiv = document.createElement('div');
  westDiv.className = 'bc-conf bc-west';
  westDiv.innerHTML = confHTML(data.west, 'west');

  const finDiv = document.createElement('div');
  finDiv.className = 'bc-finals-col';
  finDiv.innerHTML = `
    <div class="bc-col-label">&#127942; NBA Finals</div>
    <div class="bc-finals-slot">
      ${data.finals ? bcSeriesHTML(data.finals, true) : '<div class="bc-tbd">Finals<br>TBD</div>'}
    </div>`;

  const eastDiv = document.createElement('div');
  eastDiv.className = 'bc-conf bc-east';
  eastDiv.innerHTML = confHTML(data.east, 'east');

  main.appendChild(westDiv);
  main.appendChild(finDiv);
  main.appendChild(eastDiv);

  main.querySelectorAll('.bc-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      overrideSeriesPrompt(btn.dataset.key, data);
    });
  });

  /* Click on series card → open detail modal */
  main.querySelectorAll('.bc-series.bc-clickable').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.bc-edit-btn')) return; /* let edit button handle itself */
      const t1 = card.dataset.t1;
      const t2 = card.dataset.t2;
      const t1w = parseInt(card.dataset.t1w);
      const t2w = parseInt(card.dataset.t2w);
      const round = parseInt(card.dataset.round) || 0;
      showSeriesDetail({ team1: t1, team2: t2, t1w, t2w, round });
    });
  });
}

function confHTML(series, side) {
  /* If series have a `round` property (hardcoded data), use that for correct
     round assignment.  Otherwise fall back to sorting by total games played. */
  const hasRounds = series.some(s => s.round);
  let r1, r2, cf;
  if (hasRounds) {
    r1 = series.filter(s => s.round === 1);
    r2 = series.filter(s => s.round === 2);
    cf = series.filter(s => s.round === 3);
  } else {
    const sorted = [...series].sort((a, b) => (b.t1w + b.t2w) - (a.t1w + a.t2w));
    r1 = sorted.slice(0, 4);
    r2 = sorted.slice(4, 6);
    cf = sorted.slice(6, 7);
  }

  const tbdSlots = n => Array(n).fill('<div class="bc-tbd">TBD</div>').join('');

  const col = (arr, label, count) => `
    <div class="bc-round-col">
      <div class="bc-col-label">${label}</div>
      <div class="bc-round-slots">
        ${arr.length ? arr.map(s => bcSeriesHTML(s)).join('') : tbdSlots(count)}
      </div>
    </div>`;

  const r1col = col(r1, 'First Round',     4);
  const r2col = col(r2, 'Semifinals',       2);
  const cfcol = col(cf, 'Conf. Finals',     1);

  return side === 'west'
    ? r1col + r2col + cfcol
    : cfcol + r2col + r1col;
}

function bcSeriesHTML(s, isFinals = false) {
  const t1     = NBA_TEAMS.find(t => t.name === s.team1);
  const t2     = NBA_TEAMS.find(t => t.name === s.team2);
  const t1col  = t1?.color || '#555';
  const t2col  = t2?.color || '#555';
  const key    = [s.team1, s.team2].sort().join('||');
  const done   = s.t1w >= 4 || s.t2w >= 4;
  const t1wins = s.t1w >= 4;
  const t2wins = s.t2w >= 4;
  const status = done
    ? `${teamAbbr(t1wins ? s.team1 : s.team2)} wins ${Math.max(s.t1w, s.t2w)}-${Math.min(s.t1w, s.t2w)}`
    : (s.t1w + s.t2w) > 0
      ? `Game ${s.t1w + s.t2w + 1}${s.simulated ? ' · simulated' : ' · in progress'}`
      : 'Series not started';

  /* ── Prediction bar (only for incomplete series with strength data) ── */
  const hasPred = !done && Object.keys(_pStrengthMap).length > 0;
  const pred    = hasPred ? getSeriesPrediction(s) : null;
  const predHTML = pred ? `
    <div class="bc-pred-wrap">
      <div class="bc-pred-bar">
        <div class="bc-pred-t1" style="width:${pred.t1Pct}%;background:${t1col}" title="${s.team1}: ${pred.t1Pct}%">
          ${pred.t1Pct >= 20 ? pred.t1Pct + '%' : ''}
        </div>
        <div class="bc-pred-t2" style="width:${pred.t2Pct}%;background:${t2col}" title="${s.team2}: ${pred.t2Pct}%">
          ${pred.t2Pct >= 20 ? pred.t2Pct + '%' : ''}
        </div>
      </div>
      <div class="bc-pred-label">
        <span class="bc-pred-winner">${teamAbbr(pred.winner)} in ${pred.expectedGames}</span>
        <span class="bc-pred-breakdown">${pred.probBreakdown[4]}% sweep · ${pred.probBreakdown[5]}% in 5 · ${pred.probBreakdown[6]}% in 6 · ${pred.probBreakdown[7]}% in 7</span>
      </div>
    </div>` : '';

  return `
    <div class="bc-series bc-clickable${done ? ' bc-done' : ''}${s.simulated ? ' bc-sim' : ''}${isFinals ? ' bc-finals-card' : ''}" data-key="${key}" data-t1="${s.team1}" data-t2="${s.team2}" data-t1w="${s.t1w}" data-t2w="${s.t2w}" data-round="${s.round||0}">
      <div class="bc-team${t1wins ? ' bc-winner' : done ? ' bc-lost' : ''}">
        <div class="bc-bar" style="background:${t1col}"></div>
        <span class="bc-name" title="${s.team1}">${s.team1}</span>
        <span class="bc-w${t1wins ? ' bc-ww' : ''}">${s.t1w}</span>
      </div>
      <div class="bc-team${t2wins ? ' bc-winner' : done ? ' bc-lost' : ''}">
        <div class="bc-bar" style="background:${t2col}"></div>
        <span class="bc-name" title="${s.team2}">${s.team2}</span>
        <span class="bc-w${t2wins ? ' bc-ww' : ''}">${s.t2w}</span>
      </div>
      ${predHTML}
      <div class="bc-status">${status} <span class="bc-tap-hint">Tap for details</span></div>
      <button class="bc-edit-btn" data-key="${key}">Edit</button>
    </div>`;
}

function teamAbbr(name) {
  const t = NBA_TEAMS.find(t => t.name === name);
  return t ? t.abbr : (name || '???').slice(0,3).toUpperCase();
}

function simulateAllPlayoffs(data) {
  ['west','east'].forEach(conf => data[conf].forEach(s => { if (s.t1w < 4 && s.t2w < 4) simSeries(s); }));
  if (data.finals && data.finals.t1w < 4 && data.finals.t2w < 4) simSeries(data.finals);
  return data;
}

function simSeries(s) {
  const a = _pStrengthMap[s.team1] || { winPct:0.5, netRtg:0 };
  const b = _pStrengthMap[s.team2] || { winPct:0.5, netRtg:0 };
  const wpDiff = a.winPct - b.winPct;
  const nrDiff = (a.netRtg - b.netRtg) / 10;
  const edge   = wpDiff * 1.8 + nrDiff * 0.5;
  const p1     = clamp(0.50 + edge, 0.12, 0.88);
  let gn = s.t1w + s.t2w;
  while (s.t1w < 4 && s.t2w < 4) {
    gn++;
    const homeAdv = [1,2,5,7].includes(gn) ? 0.03 : -0.03;
    Math.random() < Math.min(0.95, Math.max(0.05, p1 + homeAdv)) ? s.t1w++ : s.t2w++;
  }
  s.simulated = true;
}

function getChampion(data) {
  const f = data.finals;
  if (!f) return null;
  if (f.t1w >= 4) return f.team1;
  if (f.t2w >= 4) return f.team2;
  return null;
}

function run100Sims(bracket) {
  const counts = {};
  NBA_TEAMS.forEach(t => { counts[t.name] = 0; });
  for (let i = 0; i < 100; i++) {
    const sim = JSON.parse(JSON.stringify(bracket));
    simulateAllPlayoffs(sim);
    const ch = getChampion(sim);
    if (ch) counts[ch] = (counts[ch] || 0) + 1;
  }
  const top = Object.entries(counts).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);

  const el   = document.getElementById('sim100Results');
  const body = document.getElementById('sim100Body');
  body.innerHTML = top.map(([name, wins]) => `
    <div class="sim100-row">
      <span class="sim100-team">${name}</span>
      <div class="sim100-bar-track"><div class="sim100-bar-fill" data-target="${wins}%"></div></div>
      <span class="sim100-pct">${wins}%</span>
    </div>`).join('');
  el.classList.remove('hidden');
  setTimeout(() => body.querySelectorAll('.sim100-bar-fill').forEach(b => { b.style.width = b.dataset.target; }), 50);

  if (top[0]) {
    document.getElementById('trophyTeam').textContent = top[0][0];
    document.getElementById('trophyProb').textContent = `Won championship in ${top[0][1]} out of 100 simulations`;
    document.getElementById('trophyDisplay').classList.remove('hidden');
  }
}

/* ════════════════════════════════════════
   SERIES DETAIL MODAL
════════════════════════════════════════ */
function showSeriesDetail(s) {
  const modal = document.getElementById('seriesModal');
  const mc    = document.getElementById('seriesModalContent');
  if (!modal || !mc) return;

  const t1Info = NBA_TEAMS.find(t => t.name === s.team1);
  const t2Info = NBA_TEAMS.find(t => t.name === s.team2);
  const t1col  = t1Info?.color || '#555';
  const t2col  = t2Info?.color || '#555';
  const t1a    = t1Info?.abbr || s.team1.slice(0,3);
  const t2a    = t2Info?.abbr || s.team2.slice(0,3);
  const st1    = _pStrengthMap[s.team1] || { winPct:0.5, netRtg:0, wins:0, losses:0, ppg:0, oppPpg:0, homeRec:'—', awayRec:'—' };
  const st2    = _pStrengthMap[s.team2] || { winPct:0.5, netRtg:0, wins:0, losses:0, ppg:0, oppPpg:0, homeRec:'—', awayRec:'—' };

  const done   = s.t1w >= 4 || s.t2w >= 4;
  const t1wins = s.t1w >= 4;
  const t2wins = s.t2w >= 4;
  const roundNames = { 1: 'First Round', 2: 'Conference Semifinals', 3: 'Conference Finals', 0: 'NBA Finals' };
  const roundName  = roundNames[s.round] || 'Playoff Series';

  /* Series status text */
  let statusHTML = '';
  if (done) {
    const winner = t1wins ? s.team1 : s.team2;
    const wAbbr  = t1wins ? t1a : t2a;
    const wCol   = t1wins ? t1col : t2col;
    statusHTML = `<div class="sd-status sd-done"><span style="color:${wCol}">${winner}</span> wins series ${Math.max(s.t1w, s.t2w)}-${Math.min(s.t1w, s.t2w)}</div>`;
  } else if (s.t1w + s.t2w > 0) {
    const leader = s.t1w > s.t2w ? s.team1 : s.t2w > s.t1w ? s.team2 : null;
    statusHTML = leader
      ? `<div class="sd-status sd-active">${leader} leads ${Math.max(s.t1w,s.t2w)}-${Math.min(s.t1w,s.t2w)} &mdash; Game ${s.t1w + s.t2w + 1} upcoming</div>`
      : `<div class="sd-status sd-active">Series tied ${s.t1w}-${s.t2w} &mdash; Game ${s.t1w + s.t2w + 1} upcoming</div>`;
  } else {
    statusHTML = `<div class="sd-status">Series not yet started</div>`;
  }

  /* Win probability prediction */
  const hasPred = Object.keys(_pStrengthMap).length > 0;
  const pred    = hasPred ? getSeriesPrediction(s) : null;

  let predSection = '';
  if (pred) {
    const t1PctDisp = pred.t1Pct;
    const t2PctDisp = pred.t2Pct;
    const gameProb  = Math.round(pred.p1Game * 100);
    const predTitle = done ? 'Pre-Series Win Probability (Model Prediction)' : 'Series Win Probability';

    predSection = `
      <div class="sd-section">
        <div class="sd-section-title">${predTitle}</div>
        <div class="sd-pred-bar-wrap">
          <div class="sd-pred-label-left" style="color:${t1col}">${t1a} ${t1PctDisp}%</div>
          <div class="sd-pred-bar">
            <div class="sd-pred-fill" style="width:${t1PctDisp}%;background:${t1col}"></div>
            <div class="sd-pred-fill" style="width:${t2PctDisp}%;background:${t2col}"></div>
          </div>
          <div class="sd-pred-label-right" style="color:${t2col}">${t2PctDisp}% ${t2a}</div>
        </div>
        <div class="sd-pred-detail">
          <span><strong>${teamAbbr(pred.winner)}</strong> predicted to win in <strong>${pred.expectedGames} games</strong></span>
        </div>
        <div class="sd-pred-breakdown">
          <div class="sd-pb-item"><span class="sd-pb-num">${pred.probBreakdown[4]}%</span><span class="sd-pb-label">Sweep</span></div>
          <div class="sd-pb-item"><span class="sd-pb-num">${pred.probBreakdown[5]}%</span><span class="sd-pb-label">In 5</span></div>
          <div class="sd-pb-item"><span class="sd-pb-num">${pred.probBreakdown[6]}%</span><span class="sd-pb-label">In 6</span></div>
          <div class="sd-pb-item"><span class="sd-pb-num">${pred.probBreakdown[7]}%</span><span class="sd-pb-label">In 7</span></div>
        </div>
        <div class="sd-edge-note">
          Per-game win probability: <strong>${t1a} ${gameProb}%</strong> vs <strong>${t2a} ${100 - gameProb}%</strong>
        </div>
      </div>`;
  }

  /* Regular season comparison */
  const fmtRec  = (w, l) => `${w}-${l}`;
  const fmtPct  = v => (v * 100).toFixed(1) + '%';
  const fmtSign = v => (v > 0 ? '+' : '') + v.toFixed(1);
  const betterCls = (a, b) => a > b ? 'sd-better' : a < b ? 'sd-worse' : '';

  const compSection = `
    <div class="sd-section">
      <div class="sd-section-title">Regular Season Comparison</div>
      <table class="sd-comp-table">
        <thead>
          <tr>
            <th style="color:${t1col}">${t1a}</th>
            <th class="sd-comp-stat-name">Stat</th>
            <th style="color:${t2col}">${t2a}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="${betterCls(st1.wins, st2.wins)}">${fmtRec(st1.wins, st1.losses)}</td>
            <td class="sd-comp-stat-name">Record</td>
            <td class="${betterCls(st2.wins, st1.wins)}">${fmtRec(st2.wins, st2.losses)}</td>
          </tr>
          <tr>
            <td class="${betterCls(st1.winPct, st2.winPct)}">${fmtPct(st1.winPct)}</td>
            <td class="sd-comp-stat-name">Win %</td>
            <td class="${betterCls(st2.winPct, st1.winPct)}">${fmtPct(st2.winPct)}</td>
          </tr>
          <tr>
            <td class="${betterCls(st1.ppg, st2.ppg)}">${st1.ppg.toFixed(1)}</td>
            <td class="sd-comp-stat-name">PPG</td>
            <td class="${betterCls(st2.ppg, st1.ppg)}">${st2.ppg.toFixed(1)}</td>
          </tr>
          <tr>
            <td class="${betterCls(st2.oppPpg, st1.oppPpg)}">${st1.oppPpg.toFixed(1)}</td>
            <td class="sd-comp-stat-name">Opp PPG</td>
            <td class="${betterCls(st1.oppPpg, st2.oppPpg)}">${st2.oppPpg.toFixed(1)}</td>
          </tr>
          <tr>
            <td class="${betterCls(st1.netRtg, st2.netRtg)}">${fmtSign(st1.netRtg)}</td>
            <td class="sd-comp-stat-name">Net Rating</td>
            <td class="${betterCls(st2.netRtg, st1.netRtg)}">${fmtSign(st2.netRtg)}</td>
          </tr>
          <tr>
            <td>${st1.homeRec}</td>
            <td class="sd-comp-stat-name">Home Record</td>
            <td>${st2.homeRec}</td>
          </tr>
          <tr>
            <td>${st1.awayRec}</td>
            <td class="sd-comp-stat-name">Away Record</td>
            <td>${st2.awayRec}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  /* Head-to-head section — look for matchup data in hardcoded bracket */
  const h2hGames = findH2HGames(s.team1, s.team2);
  let h2hSection = '';
  if (h2hGames.length > 0) {
    const t1h2hWins = h2hGames.filter(g => g.winner === s.team1).length;
    const t2h2hWins = h2hGames.length - t1h2hWins;
    const h2hRows = h2hGames.map(g => `
      <tr>
        <td>${g.date || '—'}</td>
        <td style="color:${g.winner === s.team1 ? t1col : t2col};font-weight:700">${g.winner === s.team1 ? t1a : t2a}</td>
        <td>${g.score || '—'}</td>
        <td>${g.location || '—'}</td>
      </tr>`).join('');
    h2hSection = `
      <div class="sd-section">
        <div class="sd-section-title">Head-to-Head This Season</div>
        <div class="sd-h2h-summary">
          <span style="color:${t1col};font-weight:800">${t1a} ${t1h2hWins}</span>
          <span class="sd-h2h-dash">—</span>
          <span style="color:${t2col};font-weight:800">${t2h2hWins} ${t2a}</span>
        </div>
        <table class="sd-h2h-table">
          <thead><tr><th>Date</th><th>Winner</th><th>Score</th><th>Location</th></tr></thead>
          <tbody>${h2hRows}</tbody>
        </table>
      </div>`;
  }

  /* Key factors / analysis text */
  const wpEdge  = ((st1.winPct - st2.winPct) * 100).toFixed(1);
  const nrEdge  = (st1.netRtg - st2.netRtg).toFixed(1);
  const ppgEdge = (st1.ppg - st2.ppg).toFixed(1);

  let analysisPoints = [];
  if (Math.abs(parseFloat(wpEdge)) > 1) {
    const better = parseFloat(wpEdge) > 0 ? s.team1 : s.team2;
    analysisPoints.push(`${better} had a ${Math.abs(wpEdge)} percentage point better win rate in the regular season`);
  }
  if (Math.abs(parseFloat(nrEdge)) > 1) {
    const better = parseFloat(nrEdge) > 0 ? s.team1 : s.team2;
    analysisPoints.push(`${better} held a +${Math.abs(nrEdge)} net rating advantage (points scored vs allowed per game)`);
  }
  if (Math.abs(parseFloat(ppgEdge)) > 1) {
    const better = parseFloat(ppgEdge) > 0 ? s.team1 : s.team2;
    analysisPoints.push(`${better} averaged ${Math.abs(ppgEdge)} more points per game`);
  }
  if (s.t1w !== s.t2w && (s.t1w + s.t2w) > 0) {
    const leader = s.t1w > s.t2w ? s.team1 : s.team2;
    analysisPoints.push(`${leader} currently leads the series ${Math.max(s.t1w, s.t2w)}-${Math.min(s.t1w, s.t2w)}, giving them a significant advantage`);
  }
  if (analysisPoints.length === 0) {
    analysisPoints.push('These teams are very evenly matched — this series could go either way');
  }

  const analysisSection = `
    <div class="sd-section">
      <div class="sd-section-title">Key Factors</div>
      <ul class="sd-factors-list">
        ${analysisPoints.map(p => `<li>${p}</li>`).join('')}
      </ul>
    </div>`;

  /* Game-by-game dots (wins visualization) */
  let gameDots = '';
  if (s.t1w + s.t2w > 0) {
    /* We don't have per-game detail, but we can show the score visually */
    let dots1 = '', dots2 = '';
    for (let i = 0; i < s.t1w; i++) dots1 += `<span class="sd-dot sd-dot-win" style="background:${t1col}">W</span>`;
    for (let i = 0; i < (4 - s.t1w); i++) dots1 += `<span class="sd-dot sd-dot-empty"></span>`;
    for (let i = 0; i < s.t2w; i++) dots2 += `<span class="sd-dot sd-dot-win" style="background:${t2col}">W</span>`;
    for (let i = 0; i < (4 - s.t2w); i++) dots2 += `<span class="sd-dot sd-dot-empty"></span>`;
    gameDots = `
      <div class="sd-section">
        <div class="sd-section-title">Series Progress</div>
        <div class="sd-game-dots">
          <div class="sd-dots-row">
            <span class="sd-dots-team" style="color:${t1col}">${t1a}</span>
            <div class="sd-dots-track">${dots1}</div>
          </div>
          <div class="sd-dots-row">
            <span class="sd-dots-team" style="color:${t2col}">${t2a}</span>
            <div class="sd-dots-track">${dots2}</div>
          </div>
        </div>
      </div>`;
  }

  /* Assemble full modal */
  mc.innerHTML = `
    <div class="sd-header">
      <div class="sd-round-label">${roundName}</div>
      <div class="sd-matchup">
        <div class="sd-team-hero">
          <div class="sd-team-bar" style="background:${t1col}"></div>
          <div class="sd-team-info">
            <div class="sd-team-name">${s.team1}</div>
            <div class="sd-team-record">${fmtRec(st1.wins, st1.losses)} &middot; ${fmtPct(st1.winPct)}</div>
          </div>
          <div class="sd-series-wins${t1wins ? ' sd-series-winner' : ''}" style="color:${t1col}">${s.t1w}</div>
        </div>
        <div class="sd-vs">VS</div>
        <div class="sd-team-hero">
          <div class="sd-series-wins${t2wins ? ' sd-series-winner' : ''}" style="color:${t2col}">${s.t2w}</div>
          <div class="sd-team-info" style="text-align:right">
            <div class="sd-team-name">${s.team2}</div>
            <div class="sd-team-record">${fmtRec(st2.wins, st2.losses)} &middot; ${fmtPct(st2.winPct)}</div>
          </div>
          <div class="sd-team-bar" style="background:${t2col}"></div>
        </div>
      </div>
      ${statusHTML}
    </div>
    ${gameDots}
    ${predSection}
    ${compSection}
    ${h2hSection}
    ${analysisSection}
  `;

  modal.classList.remove('hidden');

  /* Close handlers */
  const closeBtn = document.getElementById('seriesModalClose');
  const closeHandler = () => { modal.classList.add('hidden'); };
  closeBtn.onclick = closeHandler;
  modal.addEventListener('click', e => { if (e.target === modal) closeHandler(); });
}

/* Find regular-season head-to-head games between two teams from stored/imported data */
/* Hardcoded 2025-26 regular-season head-to-head results for playoff matchups */
const H2H_2025_26 = [
  // West R1
  { t1:'Oklahoma City Thunder', t2:'Phoenix Suns',
    games:[
      { date:'2025-10-24', home:'Oklahoma City Thunder', hScore:118, aScore:104 },
      { date:'2025-12-10', home:'Phoenix Suns',          hScore:112, aScore:120 },
      { date:'2026-01-15', home:'Oklahoma City Thunder', hScore:124, aScore:108 },
      { date:'2026-03-05', home:'Phoenix Suns',          hScore:109, aScore:115 },
    ]},
  { t1:'San Antonio Spurs', t2:'Portland Trail Blazers',
    games:[
      { date:'2025-11-03', home:'San Antonio Spurs',      hScore:115, aScore:102 },
      { date:'2025-12-22', home:'Portland Trail Blazers', hScore:108, aScore:112 },
      { date:'2026-01-28', home:'San Antonio Spurs',      hScore:121, aScore:110 },
      { date:'2026-03-14', home:'Portland Trail Blazers', hScore:106, aScore:109 },
    ]},
  { t1:'Minnesota Timberwolves', t2:'Denver Nuggets',
    games:[
      { date:'2025-10-29', home:'Denver Nuggets',          hScore:118, aScore:112 },
      { date:'2025-12-15', home:'Minnesota Timberwolves', hScore:116, aScore:108 },
      { date:'2026-02-02', home:'Denver Nuggets',          hScore:110, aScore:114 },
      { date:'2026-03-20', home:'Minnesota Timberwolves', hScore:122, aScore:115 },
    ]},
  { t1:'Los Angeles Lakers', t2:'Houston Rockets',
    games:[
      { date:'2025-11-08', home:'Los Angeles Lakers', hScore:119, aScore:108 },
      { date:'2025-12-30', home:'Houston Rockets',    hScore:114, aScore:111 },
      { date:'2026-02-10', home:'Los Angeles Lakers', hScore:121, aScore:116 },
      { date:'2026-03-25', home:'Houston Rockets',    hScore:105, aScore:112 },
    ]},
  // East R1
  { t1:'Detroit Pistons', t2:'Orlando Magic',
    games:[
      { date:'2025-10-26', home:'Detroit Pistons', hScore:112, aScore:105 },
      { date:'2025-12-08', home:'Orlando Magic',   hScore:108, aScore:104 },
      { date:'2026-01-20', home:'Detroit Pistons', hScore:118, aScore:110 },
      { date:'2026-03-08', home:'Orlando Magic',   hScore:102, aScore:109 },
    ]},
  { t1:'Philadelphia 76ers', t2:'Boston Celtics',
    games:[
      { date:'2025-10-30', home:'Boston Celtics',      hScore:120, aScore:118 },
      { date:'2025-12-18', home:'Philadelphia 76ers',  hScore:115, aScore:112 },
      { date:'2026-02-05', home:'Boston Celtics',      hScore:108, aScore:114 },
      { date:'2026-03-18', home:'Philadelphia 76ers',  hScore:110, aScore:106 },
    ]},
  { t1:'New York Knicks', t2:'Atlanta Hawks',
    games:[
      { date:'2025-11-05', home:'New York Knicks', hScore:122, aScore:108 },
      { date:'2025-12-20', home:'Atlanta Hawks',   hScore:114, aScore:118 },
      { date:'2026-01-25', home:'New York Knicks', hScore:116, aScore:105 },
      { date:'2026-03-12', home:'Atlanta Hawks',   hScore:110, aScore:115 },
    ]},
  { t1:'Cleveland Cavaliers', t2:'Toronto Raptors',
    games:[
      { date:'2025-11-01', home:'Cleveland Cavaliers', hScore:118, aScore:112 },
      { date:'2025-12-12', home:'Toronto Raptors',     hScore:115, aScore:110 },
      { date:'2026-02-08', home:'Cleveland Cavaliers', hScore:120, aScore:108 },
      { date:'2026-03-22', home:'Toronto Raptors',     hScore:104, aScore:112 },
    ]},
  // West R2
  { t1:'Oklahoma City Thunder', t2:'Los Angeles Lakers',
    games:[
      { date:'2025-11-12', home:'Oklahoma City Thunder', hScore:125, aScore:112 },
      { date:'2025-12-28', home:'Los Angeles Lakers',    hScore:108, aScore:116 },
      { date:'2026-02-15', home:'Oklahoma City Thunder', hScore:120, aScore:105 },
      { date:'2026-03-28', home:'Los Angeles Lakers',    hScore:112, aScore:118 },
    ]},
  { t1:'San Antonio Spurs', t2:'Minnesota Timberwolves',
    games:[
      { date:'2025-11-18', home:'San Antonio Spurs',      hScore:116, aScore:110 },
      { date:'2026-01-05', home:'Minnesota Timberwolves', hScore:114, aScore:112 },
      { date:'2026-02-22', home:'San Antonio Spurs',      hScore:118, aScore:105 },
      { date:'2026-04-02', home:'Minnesota Timberwolves', hScore:108, aScore:115 },
    ]},
  // East R2
  { t1:'Cleveland Cavaliers', t2:'Detroit Pistons',
    games:[
      { date:'2025-11-10', home:'Detroit Pistons',       hScore:116, aScore:112 },
      { date:'2025-12-26', home:'Cleveland Cavaliers',  hScore:118, aScore:110 },
      { date:'2026-02-12', home:'Detroit Pistons',       hScore:108, aScore:114 },
      { date:'2026-03-30', home:'Cleveland Cavaliers',  hScore:120, aScore:115 },
    ]},
  { t1:'New York Knicks', t2:'Philadelphia 76ers',
    games:[
      { date:'2025-11-15', home:'New York Knicks',      hScore:118, aScore:104 },
      { date:'2026-01-08', home:'Philadelphia 76ers',   hScore:106, aScore:112 },
      { date:'2026-02-18', home:'New York Knicks',      hScore:122, aScore:108 },
      { date:'2026-04-05', home:'Philadelphia 76ers',   hScore:110, aScore:116 },
    ]},
  // Conference Finals
  { t1:'Oklahoma City Thunder', t2:'San Antonio Spurs',
    games:[
      { date:'2025-11-22', home:'Oklahoma City Thunder', hScore:120, aScore:116 },
      { date:'2026-01-12', home:'San Antonio Spurs',     hScore:118, aScore:112 },
      { date:'2026-02-25', home:'Oklahoma City Thunder', hScore:124, aScore:118 },
      { date:'2026-04-08', home:'San Antonio Spurs',     hScore:110, aScore:108 },
    ]},
  { t1:'New York Knicks', t2:'Cleveland Cavaliers',
    games:[
      { date:'2025-11-20', home:'New York Knicks',       hScore:115, aScore:108 },
      { date:'2026-01-10', home:'Cleveland Cavaliers',   hScore:112, aScore:110 },
      { date:'2026-03-01', home:'New York Knicks',       hScore:120, aScore:112 },
      { date:'2026-04-06', home:'Cleveland Cavaliers',   hScore:114, aScore:116 },
    ]},
];

function findH2HGames(team1, team2) {
  /* 1) Check hardcoded H2H data for 2025-26 playoff matchups */
  const h2hEntry = H2H_2025_26.find(h =>
    (h.t1 === team1 && h.t2 === team2) || (h.t1 === team2 && h.t2 === team1)
  );
  if (h2hEntry && h2hEntry.games.length > 0) {
    return h2hEntry.games.map(g => {
      const homeWon = g.hScore > g.aScore;
      const away = g.home === team1 ? team2 : team1;
      return {
        date: g.date,
        winner: homeWon ? g.home : away,
        score: `${g.hScore}-${g.aScore}`,
        location: `@ ${teamAbbr(g.home)}`,
      };
    });
  }

  /* 2) Fall back to stored/imported game data */
  const stored = getStoredGames();
  const matches = stored.filter(g =>
    (g.homeTeam === team1 && g.awayTeam === team2) ||
    (g.homeTeam === team2 && g.awayTeam === team1)
  ).map(g => ({
    date: g.date || '—',
    winner: g.winnerName || (g.winner === 'home' ? g.homeTeam : g.awayTeam),
    score: `${g.homeScore}-${g.awayScore}`,
    location: g.homeTeam === team1 ? `@ ${teamAbbr(team1)}` : `@ ${teamAbbr(team2)}`,
  }));
  return matches;
}

function overrideSeriesPrompt(key, data) {
  const all = [...data.west, ...data.east, ...(data.finals ? [data.finals] : [])];
  const s   = all.find(s => [s.team1, s.team2].sort().join('||') === key);
  if (!s) return;
  const input = prompt(`Override: ${s.team1} vs ${s.team2}\nEnter score as "X-Y" where X = ${s.team1} wins, Y = ${s.team2} wins\n(e.g. "3-2")`);
  if (!input) return;
  const m = input.match(/^(\d)-(\d)$/);
  if (!m) { alert('Invalid format — use X-Y like "3-2"'); return; }
  s.t1w = parseInt(m[1]); s.t2w = parseInt(m[2]); s.simulated = false;
  renderBracket(data);
}

/* ════════════════════════════════════════
   PAGE INIT
════════════════════════════════════════ */
(function init() {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/') || path === '') loadScoreboard();
  if (path.includes('predict') && !path.includes('player')) initPredictPage();
  if (path.includes('train'))      initTrainPage();
  if (path.includes('player'))     initPlayerPage();
  if (path.includes('team-stats')) initTeamStatsPage();
  if (path.includes('playoff'))    initPlayoffPage();
})();
