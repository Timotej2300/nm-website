// Votes data layer — real API calls (same function names/shapes as the old mock layer).
import { api } from "../lib/api";

// Centralized avatar source — change this one line if the avatar provider ever changes.
export function avatarUrl(username, size = 64) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`;
}

export const fetchVoteSites = async () => (await api.get("/votes/sites")).items;
export const fetchVoteStats = () => api.get("/votes/stats");
export const fetchLeaderboard = async (period = "daily") => (await api.get(`/votes/leaderboard?period=${encodeURIComponent(period)}`)).items;
export const fetchVoteRewards = async () => (await api.get("/votes/rewards")).items;
export const fetchWallOfFame = async (period = "daily") => (await api.get(`/votes/wall-of-fame?period=${encodeURIComponent(period)}`)).items;
export const searchPlayer = async (query) => {
  const q = query.trim();
  if (!q) return null;
  return (await api.get(`/votes/search?q=${encodeURIComponent(q)}`)).player;
};
