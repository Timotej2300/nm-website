// Shared tab definitions — single source of truth for tab keys/labels,
// used by both StoreTabs.jsx (nav buttons) and Store.jsx (tab content map).
// Ranks leads since it's the main purchase flow; Top Donators closes out
// the page as social proof.
export const STORE_TABS = [
  { key: "ranks", label: "Ranks" },
  { key: "crates", label: "Crates & Keys" },
  { key: "currency", label: "Currency" },
  { key: "donators", label: "Top Donators" },
];