import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { fetchTopDonators } from "../../../data/store";
import { avatarUrl } from "../../../data/votes";

// Same medal set used across the vote leaderboards, reused here so a top
// donator's rank badge feels like part of the same reward system.
import goldMedal from "../../../assets/votes/medals/medal_gold.png";
import silverMedal from "../../../assets/votes/medals/medal_bronze.png";
import bronzeMedal from "../../../assets/votes/medals/medal_stone.png";

const RANK_MEDALS = { 1: goldMedal, 2: silverMedal, 3: bronzeMedal };
const RANK_GRADIENT = { 1: "gold-gradient-text", 2: "bronze-gradient-text", 3: "silver-gradient-text" };
const RANK_ROW_STYLE = {
  1: "bg-[#ffd54a]/5 border-[#ffd54a]/60",
  2: "bg-[#c7cad1]/5 border-[#c7cad1]/50",
  3: "bg-[#e0a45f]/5 border-[#e0a45f]/50",
};

const PERIODS = [
  { key: "monthly", label: "This Month" },
  { key: "allTime", label: "All Time" },
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
  return <span className="w-7 shrink-0 text-[11px] font-bold gradient-text">#{rank}</span>;
}

export default function TopDonatorsTab() {
  const [period, setPeriod] = useState("monthly");
  const [cache, setCache] = useState({});

  useEffect(() => {
    if (cache[period]) return;
    let isMounted = true;
    fetchTopDonators(period).then((data) => {
      if (isMounted) setCache((prev) => ({ ...prev, [period]: data }));
    });
    return () => {
      isMounted = false;
    };
  }, [period, cache]);

  const donators = cache[period] ?? null;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] tracking-[0.06em] gold-gradient-text uppercase sm:text-[15px]">
          <Trophy size={16} /> Top Donators
        </h2>
        <div className="flex gap-2">
          {PERIODS.map(({ key, label }) => (
            <PixelButton
              key={key}
              tone="primary"
              size="sm"
              filled={period === key}
              className="px-3! py-2.5! sm:px-4! sm:py-3!"
              onClick={() => setPeriod(key)}
            >
              <span className="gradient-text">{label}</span>
            </PixelButton>
          ))}
        </div>
      </div>

      <PixelBox tone="neutral" className="mt-4" contentClassName="flex flex-col gap-1">
        {!donators && (
          <p className="py-6 text-center text-[11px] tracking-[0.08em] text-(--color-text-dim)">
            Loading...
          </p>
        )}

        {donators?.length === 0 && (
          <p className="py-6 text-center text-[11px] tracking-[0.08em] text-(--color-text-dim)">
            No donations yet — be the first to support the server!
          </p>
        )}

        {donators?.map((d) => (
          <div
            key={d.username}
            className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 transition-colors hover:bg-white/5 sm:gap-3 ${
              RANK_ROW_STYLE[d.rank] ?? "border-l-2 border-transparent"
            }`}
          >
            <RankBadge rank={d.rank} />

            <img
              src={avatarUrl(d.username, 28)}
              alt={d.username}
              className="h-7 w-7 shrink-0 rounded-sm ring-1 ring-black/40 [image-rendering:pixelated]"
            />

            <span
              className={`min-w-0 flex-1 truncate text-[12px] ${RANK_GRADIENT[d.rank] ?? "green-gradient-text"}`}
            >
              {d.username}
            </span>

            <span className="hidden shrink-0 rounded-sm bg-black/25 px-2 py-1 text-[9.5px] tracking-[0.05em] text-(--color-text-muted) uppercase sm:inline-block">
              {d.tier}
            </span>

            <span className="shrink-0 rounded-sm bg-black/25 px-2 py-1 text-[10.5px] tracking-[0.02em] text-(--color-text-muted)">
              <span className="gold-gradient-text font-semibold">
                ৳{d.amount.toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </PixelBox>
    </div>
  );
}
