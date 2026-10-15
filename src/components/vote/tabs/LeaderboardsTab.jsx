import { useEffect, useState } from "react";
import PixelBox from "../../ui/PixelBox";
import { fetchLeaderboard, avatarUrl } from "../../../data/votes";

// Rank 1/2/3 get a medal image instead of a "#N" text badge.
import goldMedal from "../../../assets/votes/medals/medal_gold.png";
import silverMedal from "../../../assets/votes/medals/medal_bronze.png";
import bronzeMedal from "../../../assets/votes/medals/medal_stone.png";

const RANK_MEDALS = { 1: goldMedal, 2: silverMedal, 3: bronzeMedal };

const RANK_GRADIENT = { 1: "gold-gradient-text", 2: "bronze-gradient-text", 3: "silver-gradient-text" };

// Faint tinted background + left accent for the top-3 rows, so the podium
// stands out from the plain list without needing extra markup per row.
const RANK_ROW_STYLE = {
  1: "bg-[#ffd54a]/5  border-[#ffd54a]/60",
  2: "bg-[#c7cad1]/5  border-[#c7cad1]/50",
  3: "bg-[#e0a45f]/5  border-[#e0a45f]/50",
};

const PANELS = [
  { period: "allTime", title: "All-Time Top Voters" },
  { period: "daily", title: "Daily Top Voters" },
  { period: "weekly", title: "Weekly Top Voters" },
  { period: "monthly", title: "Monthly Top Voters" },
];

function RankBadge({ rank }) {
  const medal = RANK_MEDALS[rank];

  if (medal) {
    return (
      <img
        src={medal}
        alt={`Rank ${rank}`}
        className="h-7 w-7 shrink-0 object-contain [image-rendering:pixelated] drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
      />
    );
  }

  return (
    <span
      className={`w-7 shrink-0 text-[11px] font-bold ${RANK_GRADIENT[rank] ?? "gradient-text"}`}
    >
      #{rank}
    </span>
  );
}

function LeaderboardPanel({ title, entries }) {
  return (
    <PixelBox tone="neutral" contentClassName="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-3">
        <h3
          className="text-[13px] tracking-[0.08em] gold-gradient-text uppercase"
        >
          {title}
        </h3>
      </div>

      <div className="flex flex-col gap-1">
        {entries === null && (
          <p className="py-6 text-center text-[11px] tracking-[0.08em] text-(--color-text-dim)">
            Loading...
          </p>
        )}

        {entries?.length === 0 && (
          <p className="py-6 text-center text-[11px] tracking-[0.08em] text-(--color-text-dim)">
            No votes yet — be the first!
          </p>
        )}

        {entries?.map(({ rank, username, votes }) => (
          <div
            key={username}
            className={`flex items-center gap-3 rounded-sm px-2.5 py-2 transition-colors hover:bg-white/5 ${
              RANK_ROW_STYLE[rank] ?? "border-l-2 border-transparent"
            }`}
          >
            <RankBadge rank={rank} />

            <img
              src={avatarUrl(username, 28)}
              alt={username}
              className="h-7 w-7 shrink-0 rounded-sm ring-1 ring-black/40 [image-rendering:pixelated]"
            />

            <span
              className={`flex-1 truncate text-[12px] ${RANK_GRADIENT[rank] ?? "green-gradient-text"}`}
            >
              {username}
            </span>

            <span className="shrink-0 rounded-sm bg-black/25 px-2 py-1 text-[10.5px] tracking-[0.04em] text-(--color-text-muted)">
              <span className="gold-gradient-text font-semibold">
                {votes.toLocaleString()}
              </span>{" "}
              votes
            </span>
          </div>
        ))}
      </div>
    </PixelBox>
  );
}

export default function LeaderboardsTab() {
  const [data, setData] = useState({
    daily: null,
    weekly: null,
    monthly: null,
    allTime: null,
  });

  useEffect(() => {
    let isMounted = true;
    PANELS.forEach(({ period }) => {
      fetchLeaderboard(period).then((entries) => {
        if (isMounted) setData((prev) => ({ ...prev, [period]: entries }));
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      {PANELS.map(({ period, title }) => (
        <LeaderboardPanel
          key={period}
          title={title}
          entries={data[period]}
        />
      ))}
    </div>
  );
}