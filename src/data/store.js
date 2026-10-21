// Store data layer — real API calls (same function names/shapes as the old mock layer).
import { api } from "../lib/api";

export const fetchStoreStats = () => api.get("/store/stats");
export const fetchMonthlyGoal = async () => (await api.get("/store/monthly-goal")).goal;
export const fetchRanks = async () => (await api.get("/store/ranks")).items;
export const fetchCrateKeys = async () => (await api.get("/store/crate-keys")).items;
export const fetchCurrencyPacks = async () => (await api.get("/store/currency-packs")).items;
export const fetchTopDonators = async (period = "monthly") =>
  (await api.get(`/store/top-donators?period=${encodeURIComponent(period)}`)).items;

// Rows shown in the Store comparison table, top to bottom. `type` controls
// how RanksTab renders the cell for each rank:
//   "check"  -> green check / greyed dash
//   "number" -> the value itself (or a greyed dash when falsy/0)
export const RANK_PERK_ROWS = [
  { key: "chatIcon", label: "Special Chat Icon", type: "check" },
  { key: "priorityQueue", label: "Priority Queue", type: "check" },
  { key: "exclusiveKits", label: "Access to Exclusive Kits", type: "check" },
  { key: "remoteWarpAccess", label: "Remote Access to Player Warps", type: "check" },
  { key: "bulkSellAccess", label: "Bulk Sell & Auto-Sell Access", type: "check" },
  { key: "disguiseAccess", label: "Access to Disguises", type: "check" },
  { key: "rankColorChanger", label: "Nickname & Rank Color Changer", type: "check" },
  { key: "joinAnnouncement", label: "Server-wide Join Announcement", type: "check" },
  { key: "webstoreDiscount", label: "Discount on Future Webstore Purchases", type: "number", suffix: "%" },
  { key: "bonusVotePoints", label: "Bonus Vote Points (per vote)", type: "number" },
  { key: "bonusCrateKeys", label: "Bonus Crate Keys (monthly)", type: "number" },
  { key: "bonusHomes", label: "Bonus Home Locations", type: "number" },
  { key: "bonusWarps", label: "Bonus Player Warps", type: "number" },
  { key: "bonusQuestRerolls", label: "Bonus Daily Quest Rerolls", type: "number" },
  { key: "bonusWeeklyQuests", label: "Bonus Weekly Quests", type: "number" },
];
