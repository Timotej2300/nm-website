import PixelButton from "../ui/PixelButton";
import { STORE_TABS } from "./storeTabsConfig";

export default function StoreTabs({ active, onChange }) {
  return (
    // Mobile: a tidy 2-column grid so labels never wrap awkwardly.
    // sm+: a single centered row.
    <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
      {STORE_TABS.map(({ key, label }) => {
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
