import { useEffect, useState } from "react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { fetchWallOfFame, avatarUrl } from "../../../data/votes";

// Same medal set used on the Leaderboards tab, reused here for the podium.
import goldMedal from "../../../assets/votes/medals/medal_gold.png";
import silverMedal from "../../../assets/votes/medals/medal_bronze.png";
import bronzeMedal from "../../../assets/votes/medals/medal_stone.png";

// Crown shown above the #1 podium card. Drop the real file into
// src/assets/votes/ with this exact name.
import crownIcon from "../../../assets/votes/crown.png";

const RANK_MEDALS = { 1: goldMedal, 2: silverMedal, 3: bronzeMedal };

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "allTime", label: "All Time" },
];

const RANK_STYLE = {
  1: {
    tone: "primary",
    accent: "#ffd54a",
    gradient: "gold-gradient-text",
    avatar: "h-24 w-24 sm:h-32 sm:w-32",
    card: "max-w-[240px] sm:max-w-[260px]",
    lift: "sm:-translate-y-6",
    platform: "sm:h-28",
    platformBg: "linear-gradient(180deg,#3a2f14,#1a1408)",
    // Mobile stacks in rank order (1-2-3 top to bottom); desktop keeps the
    // classic silver-gold-bronze podium arrangement (2-1-3 left to right).
    order: "order-1 sm:order-2",
  },
  2: {
    tone: "primary",
    accent: "#e0a45f",
    gradient: "bronze-gradient-text",
    avatar: "h-20 w-20 sm:h-24 sm:w-24",
    card: "max-w-[200px] sm:max-w-[220px]",
    lift: "",
    platform: "sm:h-28",
    platformBg: "linear-gradient(180deg,#3a2617,#1c130b)",
    order: "order-2 sm:order-1",
  },
  3: {
    tone: "primary",
    accent: "#c7cad1",
    gradient: "silver-gradient-text",
    avatar: "h-20 w-20 sm:h-24 sm:w-24",
    card: "max-w-[200px] sm:max-w-[220px]",
    lift: "",
    platform: "sm:h-28",
    platformBg: "linear-gradient(180deg,#2b2d33,#15161a)",
    order: "order-3 sm:order-3",
  },
};

function PodiumCard({ entry }) {
  const style = RANK_STYLE[entry.rank];
  const isFirst = entry.rank === 1;

  return (
    <div className={`flex w-full max-w-90 flex-col items-center ${style.lift} ${style.order}`}>
      {isFirst && (
        <img
          src={crownIcon}
          alt="Crown"
          className="mb-2 h-8 w-8 shrink-0 object-contain [image-rendering:pixelated] drop-shadow-[0_0_10px_rgba(255,176,32,0.7)] sm:h-9 sm:w-9"
        />
      )}

      <PixelBox
        tone={style.tone}
        filled={isFirst}
        className={`w-full ${style.card}`}
        contentClassName="flex flex-col items-center gap-2 px-4! py-5! text-center sm:gap-2.5 sm:px-5! sm:py-6!"
      >
        <div className="relative shrink-0">
          <img
            src={avatarUrl(entry.username, 128)}
            alt={entry.username}
            className={`${style.avatar} rounded-sm [image-rendering:pixelated]`}
            style={{ boxShadow: `0 0 0 4px ${style.accent}, 0 0 24px 0 ${style.accent}55` }}
          />
          <img
            src={RANK_MEDALS[entry.rank]}
            alt={`Rank ${entry.rank}`}
            className="absolute -bottom-2 -right-2 h-7 w-7 object-contain [image-rendering:pixelated] drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)] sm:h-9 sm:w-9"
          />
        </div>

        <span className={`max-w-full truncate px-1 text-[14px] sm:text-[16px] ${style.gradient}`}>
          {entry.username}
        </span>
        <span
          className="max-w-full truncate px-1 text-[10px] tracking-[0.06em] uppercase sm:text-[11px]"
          style={{ color: style.accent }}
        >
          {entry.title}
        </span>
        <span className="text-[12px] gold-gradient-text font-semibold sm:text-[13px]">
          {entry.votes.toLocaleString()} votes
        </span>

        <PixelButton tone="neutral" size="sm" className="mt-2 w-full">
          View Profile
        </PixelButton>
      </PixelBox>

      {/* Podium base block — taller for rank 1, gives the classic 1-2-3 stair look.
          Only shown at sm+ where the cards sit side by side; on mobile the
          order-based stacking above already communicates rank. */}
      <div
        className={`mt-3 hidden w-full rounded-t-sm sm:block ${style.platform}`}
        style={{
          background: style.platformBg,
          boxShadow: `inset 0 3px 0 0 ${style.accent}88`,
        }}
      >
        <div
          className="flex h-full items-start justify-center pt-2 text-[22px] font-bold"
          style={{ color: style.accent, opacity: 0.35 }}
        >
          #{entry.rank}
        </div>
      </div>
    </div>
  );
}

export default function WallOfFameTab() {
  const [period, setPeriod] = useState("daily");
  const [cache, setCache] = useState({});

  useEffect(() => {
    if (cache[period]) return; // already loaded, no need to refetch
    let isMounted = true;
    fetchWallOfFame(period).then((data) => {
      if (isMounted) setCache((prev) => ({ ...prev, [period]: data }));
    });
    return () => {
      isMounted = false;
    };
  }, [period, cache]);

  const entries = cache[period] ?? null;

  const podiumOrder = entries
    ? [2, 1, 3].map((rank) => entries.find((e) => e.rank === rank)).filter(Boolean)
    : [];

  return (
    <div className="mt-6 sm:mt-8">
      <div className="flex flex-wrap justify-center gap-2 px-2">
        {PERIODS.map(({ key, label }) => (
          <PixelButton
            key={key}
            tone="primary"
            filled={period === key}
            size="sm"
            className="px-3! py-3! sm:px-4! sm:py-4!"
            onClick={() => setPeriod(key)}
          >
            <span className="gradient-text">{label}</span>
          </PixelButton>
        ))}
      </div>

      {!entries && (
        <p className="mt-10 text-center text-[15px] gold-gradient-text">Loading...</p>
      )}

      {entries && (
        <div className="mt-8 flex flex-col items-center gap-6 px-4 sm:mt-10 sm:flex-row sm:items-end sm:justify-center sm:gap-6 sm:px-0">
          {podiumOrder.map((entry) => (
            <PodiumCard key={entry.rank} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}