import { useEffect, useState } from "react";

import {
  Check,
  X,
  Star,
  Crown,
  Flame,
  Info,
  MessageSquare,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { fetchRanks, RANK_PERK_ROWS } from "../../../data/store";
import { useCart } from "../../../context/useCart";

// One icon per tier so the columns read at a glance instead of repeating
// the same crown three times.
const RANK_ICONS = { vip: Star, mvp: Crown, legend: Flame };

// Rank tone keys line up 1:1 with the theme's own color variables
// (--color-success / --color-info / --color-primary), so we can reuse the
// tone string directly for both the gradient-text class and border color.
const TONE_GRADIENT = {
  success: "green-gradient-text",
  info: "info-gradient-text",
  primary: "gold-gradient-text",
};

function PerkCell({ row, value }) {
  if (row.type === "check") {
    return value ? (
      <Check size={16} className="text-(--color-success)" strokeWidth={3} />
    ) : (
      <X size={13} className="text-red-400" strokeWidth={2.5} />
    );
  }

  // number type
  if (!value) {
    return <span className="text-[13px] text-(--color-text-dim)">—</span>;
  }
  return (
    <span className="text-[13px]  text-(--color-success)">
      {value}
      {row.suffix ?? ""}
    </span>
  );
}

function PerkRow({ row, value }) {
  return (
    <div className="flex flex-col items-center gap-1.5 border-b border-white/5 py-2.5 text-center last:border-0">
      <span className="text-[10px] leading-tight gradient-text">{row.label}</span>
      <PerkCell row={row} value={value} />
    </div>
  );
}

export default function RanksTab() {
  const [ranks, setRanks] = useState(null);
  const [addedKey, setAddedKey] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    let isMounted = true;
    fetchRanks().then((data) => {
      if (isMounted) setRanks(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddToCart = (rank) => {
    addToCart({
      id: `rank-${rank.key}`,
      category: "rank",
      name: `${rank.name} Rank`,
      price: rank.price,
      tone: rank.tone,
      icon: RANK_ICONS[rank.key] ?? Star,
    });
    setAddedKey(rank.key);
    setTimeout(() => setAddedKey((k) => (k === rank.key ? null : k)), 1500);
  };

  return (
    <div className="mt-8">
      {/* Upgrade-discount banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-sm border border-(--color-info)/40 bg-(--color-info)/10 px-4 py-3 text-[11px] leading-snug text-(--color-text-muted)">
        <Info size={15} className="mt-0.5 shrink-0 text-(--color-info)" />
        Purchasing a lower rank makes you eligible for a discount when
        upgrading to a higher rank later.
      </div>

      {!ranks && (
        <p className="py-10 text-center text-[15px] gold-gradient-text">Loading...</p>
      )}

      {ranks && (
        <div className="grid gap-5 sm:grid-cols-3">
          {ranks.map((rank) => {
            const Icon = RANK_ICONS[rank.key] ?? Star;
            const gradientClass = TONE_GRADIENT[rank.tone] ?? "gradient-text";

            return (
              <PixelBox
                key={rank.key}
                tone={rank.tone}
                filled={rank.featured}
                padding="none"
                className={`overflow-hidden `}
                contentClassName="flex h-full flex-col gap-4 p-5"
                header={
                  <div className="flex w-full items-center gap-2.5 py-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black/25">
                      <Icon size={16} color="#fff" strokeWidth={2.25} />
                    </span>
                    <h3 className="text-[14px] tracking-[0.04em] gradient-text uppercase">
                      {rank.name}
                    </h3>
                    <span
                      className="ml-auto text-[17px] text-(--color-text) gold-gradient-text "
                    >
                      {rank.price}
                    </span>
                  </div>
                }
                headerClassName="px-5! py-3! bg-black/10"
              >
                {/* Username color + special nameplate preview */}
                <div className="flex flex-col items-center gap-3 rounded-sm bg-black/15 py-3">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[9.5px] tracking-[0.08em] text-(--color-text-dim) uppercase">
                      Username Color
                    </span>
                    <span className={`text-[12.5px] font-semibold ${gradientClass}`}>
                      {rank.usernameColor}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[9.5px] tracking-[0.08em] text-(--color-text-dim) uppercase">
                      Special Nameplate
                    </span>
                    <span
                      className="flex items-center gap-1.5 rounded-sm border px-3 py-1"
                      style={{ borderColor: `var(--color-${rank.tone})` }}
                    >
                      <MessageSquare size={11} className={gradientClass} />
                      <span className={`text-[11px] font-bold uppercase ${gradientClass}`}>
                        {rank.name}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Full perk comparison */}
                <div className="flex flex-col">
                  {RANK_PERK_ROWS.map((row) => (
                    <PerkRow key={row.key} row={row} value={rank.values[row.key]} />
                  ))}
                </div>

                <PixelButton
                  tone={rank.tone}
                  className="mt-auto w-full py-5!"
                  filled={rank.featured}
                  icon={addedKey === rank.key ? CheckCircle2 : ShoppingCart}
                  iconClassName="text-[#ffc02e]"
                  onClick={() => handleAddToCart(rank)}
                >
                  <span className="gold-gradient-text ">
                    {addedKey === rank.key ? "Added to Cart" : "Add to Cart"}
                  </span>
                </PixelButton>
              </PixelBox>
            );
          })}
        </div>
      )}

    </div>
  );
}