import PixelButton from "../ui/PixelButton";
import { VOTE_TABS } from "./voteTabsConfig";

export default function VoteTabs({ active, onChange }) {
  return (
    // Mobile: a tidy 2-column grid so 4 long labels ("Voting Rewards",
    // "Wall of Fame"...) never wrap awkwardly into a lopsided line.
    // sm+: back to a single centered row, same as before.
    <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
      {VOTE_TABS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <PixelButton
            key={key}
            tone="primary"
            className="w-full px-3! py-3! text-center sm:w-auto sm:px-4! sm:py-5!"
            filled={isActive}
            size="sm"
            onClick={() => onChange(key)}
            textClassName="gradient-text truncate"
            textStyle={{
              "--nav-grad-top": isActive ? "#ffe066" : "",
              "--nav-grad-bottom": isActive ? "#c97a12" : "",
            }}
          >
            {label}
          </PixelButton>
        );
      })}
    </div>
  );
}