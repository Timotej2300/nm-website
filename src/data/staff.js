// src/data/staff.js
// ─────────────────────────────────────────────────────────────
// Staff roster. Same plain-data convention as data/votes.js and
// data/store.js — swap STAFF for a real fetch() once there's a backend;
// the Staff page itself doesn't need to change.
// ─────────────────────────────────────────────────────────────

// Tiers in display order — highest authority first.
export const STAFF_TIERS = [
  { key: "owner", label: "Owner" },
  { key: "admin", label: "Administrator" },
  { key: "moderator", label: "Moderator" },
  { key: "helper", label: "Helper & Builder" },
];

export const STAFF = [
  {
    username: "Efath",
    role: "Founder & Owner",
    tier: "owner",
    bio: "Started BDZONE in 2022 and still writes half the plugins personally.",
    discord: "efath",
    online: true,
  },
  {
    username: "River",
    role: "Lead Developer",
    tier: "admin",
    bio: "Ships new game modes and keeps the network running smoothly.",
    discord: "river.dev",
    online: true,
  },
  {
    username: "Aster",
    role: "Server Administrator",
    tier: "admin",
    bio: "Handles infrastructure, backups, and anti-cheat tuning.",
    discord: "aster",
    online: false,
  },
  {
    username: "Wren",
    role: "Community Manager",
    tier: "moderator",
    bio: "Runs events and keeps the Discord lively.",
    discord: "wren",
    online: true,
  },
  {
    username: "Sable",
    role: "Head Moderator",
    tier: "moderator",
    bio: "Trains new moderators and reviews ban appeals.",
    discord: "sable",
    online: false,
  },
  {
    username: "Iris",
    role: "Moderator",
    tier: "moderator",
    bio: "On duty most evenings — say hi in chat!",
    discord: "iris",
    online: true,
  },
  {
    username: "Juno",
    role: "Builder",
    tier: "helper",
    bio: "Designs spawn, lobbies, and every seasonal event arena.",
    discord: "juno",
    online: false,
  },
  {
    username: "Finch",
    role: "Helper",
    tier: "helper",
    bio: "Usually the first to answer questions in #support.",
    discord: "finch",
    online: true,
  },
];