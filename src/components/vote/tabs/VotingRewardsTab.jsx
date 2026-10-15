import { useEffect, useState } from "react";
import PixelBox from "../../ui/PixelBox";
import { fetchVoteRewards } from "../../../data/votes";

// One image per reward tier — filenames match each tier's `votes` count
// in src/Data/votes.js. Drop the real files into src/assets/vote-rewards/
// with these exact names.
import tier1 from "../../../assets/votes/coin.png";
import tier5 from "../../../assets/votes/gem.png";
import tier10 from "../../../assets/votes/xp.png";
import tier25 from "../../../assets/votes/key.png";
// No 4th distinct image exists yet — using a lucide Crown icon as a stand-in
// for the top (Legendary) tier so it doesn't just repeat key.png. Swap this
// for a real image later (e.g. import tier25 from "../../../assets/votes/crown.png").

// votes -> local tier image
const TIER_IMAGES = { 1: tier1, 5: tier5, 10: tier10, 25: tier25 };

export default function VotingRewardsTab() {
  const [rewards, setRewards] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetchVoteRewards().then((data) => {
      if (isMounted) setRewards(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!rewards) {
    return (
      <p className="mt-10 text-center text-[12px] text-(--color-text-dim)">Loading rewards...</p>
    );
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {rewards.map(({ votes, label, reward }) => {
        const items = reward.split(",").map((item) => item.trim()).filter(Boolean);
        const tierImage = TIER_IMAGES[votes];

        return (
          <PixelBox
            key={votes}
            tone="primary"
            contentClassName="flex flex-col items-center gap-3 text-center"
          >
            {tierImage ? (
              <img
                src={tierImage}
                alt={label}
                className="h-14 w-14 object-contain [image-rendering:pixelated]"
              />
            ) : (
             ""
            )}
            <span className="text-[13px] gold-gradient-text">{label}</span>

            <ul className="flex w-full flex-col items-center gap-1.5">
              {items.map((item) => (
                <li
                  key={item}
                  className="text-[11.5px] leading-snug gradient-text"
                >
                  {item}
                </li>
              ))}
            </ul>
          </PixelBox>
        );
      })}
    </div>
  );
}