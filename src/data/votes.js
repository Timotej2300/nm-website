// src/Data/votes.js
// ─────────────────────────────────────────────────────────────
// Data + lightweight "API layer" for the /votes page.
//
// Every exported `fetchX` / `searchX` function below is written the way a
// real network call would be used from a component (returns a Promise,
// takes the same arguments a real endpoint would need). Right now they
// resolve from local mock data after a small simulated delay — swap the
// BODY of these functions for real `fetch("/api/...")` calls whenever the
// backend exists, and no component needs to change at all.
//
// Suggested real endpoints, for whenever the backend is ready:
//   GET /api/votes/sites
//   GET /api/votes/stats
//   GET /api/votes/leaderboard?period=daily|weekly|monthly|allTime
//   GET /api/votes/rewards
//   GET /api/votes/wall-of-fame?period=daily|weekly|monthly|allTime
//   GET /api/players/search?q=username
// ─────────────────────────────────────────────────────────────

const SIMULATED_DELAY = 250; // ms — mimics a network round-trip

function resolve(data) {
  return new Promise((res) => setTimeout(() => res(data), SIMULATED_DELAY));
}

// Centralized avatar source — change this one line if the avatar
// provider ever changes (e.g. to crafatar, or your own skin API).
export function avatarUrl(username, size = 64) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`;
}

// ── Vote sites 
const voteSites = [
  { id: "topminecraftservers", name: "TopMinecraftServers.org", href: "#" },
  { id: "minecraft-mp", name: "Minecraft-MP.com", href: "#" },
  { id: "planetminecraft", name: "PlanetMinecraft.com", href: "#" },
  { id: "mclist", name: "Mclist.io", href: "#" },
  { id: "minecraftlist", name: "minecraftlist.org", href: "#" },
  { id: "minecraftbestservers", name: "MinecraftBestServers.com", href: "#" },
  { id: "topg", name: "TopG.org", href: "#" },
  { id: "minecraft-serverlist", name: "minecraft-serverlist.com", href: "#" },
  { id: "minerank", name: "minerank.com", href: "#" },
  { id: "minecraftiplist", name: "minecraftiplist.com", href: "#" },
  { id: "minecraftbuzz", name: "Minecraft.Buzz", href: "#" },
];
export function fetchVoteSites() {
  return resolve(voteSites);
}

// ── Overview stats 
function getNextResetAt() {
  const d = new Date();
  d.setHours(24, 0, 0, 0); // next local midnight
  return d.toISOString();
}

export function fetchVoteStats() {
  return resolve({
    totalVotes: 152770,
    totalVoters: 3069,
    todayVotes: 56,
    weekVotes: 296,
    monthVotes: 8075,
    weeklyGoal: { current: 296, target: 2000 },
    nextResetAt: getNextResetAt(),
  });
}

// ── Leaderboards 
const leaderboards = {
  daily: [
    { rank: 1, username: "ShadowSniper", votes: 11 },
    { rank: 2, username: "LMxRITAM143", votes: 11 },
    { rank: 3, username: "BigFred30", votes: 11 },
    { rank: 4, username: "BodnaChorX89", votes: 10 },
    { rank: 5, username: "simanto", votes: 8 },
    { rank: 6, username: "MahirPro7", votes: 2 },
    { rank: 7, username: "Sahib36", votes: 2 },
    { rank: 8, username: "JJ_ZERO", votes: 1 },
  ],
  weekly: [
    { rank: 1, username: "LMxRITAM143", votes: 23 },
    { rank: 2, username: "BodnaChorX89", votes: 22 },
    { rank: 3, username: "BigFred30", votes: 21 },
    { rank: 4, username: "simanto", votes: 17 },
    { rank: 5, username: "JJ_ZERO", votes: 14 },
    { rank: 6, username: "MahirPro7", votes: 13 },
    { rank: 7, username: "Sahib36", votes: 12 },
    { rank: 8, username: "ShadowSniper", votes: 11 },
    { rank: 9, username: "larry_khalu", votes: 11 },
    { rank: 10, username: "RAFI_SKULL", votes: 11 },
  ],
  monthly: [
    { rank: 1, username: "MahirPro7", votes: 331 },
    { rank: 2, username: "JJ_ZERO", votes: 321 },
    { rank: 3, username: "niloy3334444", votes: 263 },
    { rank: 4, username: "LMxRITAM143", votes: 261 },
    { rank: 5, username: "BodnaChorX89", votes: 258 },
    { rank: 6, username: "AD_IR", votes: 229 },
    { rank: 7, username: "BigFred30", votes: 228 },
    { rank: 8, username: "tasneem", votes: 225 },
    { rank: 9, username: "DarknItFound", votes: 216 },
    { rank: 10, username: "tr420", votes: 203 },
  ],
  allTime: [
    { rank: 1, username: "OpEfath", votes: 1481 },
    { rank: 2, username: "MahirPro7", votes: 1400 },
    { rank: 3, username: "MahinIsBest", votes: 1385 },
    { rank: 4, username: "RoyPlays28", votes: 1200 },
    { rank: 5, username: "tasneem", votes: 1081 },
    { rank: 6, username: "parbon50", votes: 902 },
    { rank: 7, username: "Arman_Mahim", votes: 884 },
    { rank: 8, username: "MrDeshiGamer", votes: 883 },
    { rank: 9, username: "iori", votes: 847 },
    { rank: 10, username: "Sayham", votes: 822 },
  ],
};

export function fetchLeaderboard(period = "daily") {
  return resolve(leaderboards[period] ?? []);
}

// ── Voting rewards (milestones) 
const voteRewards = [
  {
    votes: 1,
    label: "1 Votes",
    reward:
      "1 Vote Key, 550 XP Points, 1000 Game Money, 1 Vote Point",
  },
  {
    votes: 5,
    label: "5 Votes",
    reward: "1 Rare Crate Key, 3000 XP Points, 5000 Game Money, 5 Vote Points",
  },
  {
    votes: 10,
    label: "10 Votes",
    reward: "1 Epic Crate Key, 7500 XP Points, 12000 Game Money, 10 Vote Points",
  },
  {
    votes: 25,
    label: "25 Votes",
    reward: "1 Legendary Crate Key, 20000 XP Points, 30000 Game Money, 25 Vote Points",
  },
];

export function fetchVoteRewards() {
  return resolve(voteRewards);
}

// ── Wall of Fame (top 3 per period, with a title/badge) ─────
const wallOfFame = {
  daily: [
    { rank: 1, username: "ShadowSniper", title: "#1 Top Daily Voter", votes: 11 },
    { rank: 2, username: "LMxRITAM143", title: "Daily Hero", votes: 11 },
    { rank: 3, username: "BigFred30", title: "Daily Star", votes: 11 },
  ],
  weekly: [
    { rank: 1, username: "LMxRITAM143", title: "#1 Top Weekly Voter", votes: 23 },
    { rank: 2, username: "BodnaChorX89", title: "Weekly Hero", votes: 22 },
    { rank: 3, username: "BigFred30", title: "Weekly Star", votes: 21 },
  ],
  monthly: [
    { rank: 1, username: "MahirPro7", title: "#1 Top Monthly Voter", votes: 331 },
    { rank: 2, username: "JJ_ZERO", title: "Monthly Hero", votes: 321 },
    { rank: 3, username: "niloy3334444", title: "Monthly Star", votes: 263 },
  ],
  allTime: [
    { rank: 1, username: "OpEfath", title: "#1 Top Voter Ever", votes: 1481 },
    { rank: 2, username: "MahirPro7", title: "All-Time Hero", votes: 1400 },
    { rank: 3, username: "MahinIsBest", title: "All-Time Star", votes: 1385 },
  ],
};

export function fetchWallOfFame(period = "daily") {
  return resolve(wallOfFame[period] ?? []);
}

// ── Player search ───────────────────────────────────────────
export function searchPlayer(query) {
  const q = query.trim().toLowerCase();
  if (!q) return resolve(null);
  const match = leaderboards.allTime.find((p) => p.username.toLowerCase() === q);
  return resolve(match ?? null);
}