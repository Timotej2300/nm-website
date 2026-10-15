import { useState } from "react";
import StoreOverview from "../components/store/StoreOverview";
import StoreTabs from "../components/store/StoreTabs";
import { STORE_TABS } from "../components/store/storeTabsConfig";
import RanksTab from "../components/store/tabs/RanksTab";
import CratesTab from "../components/store/tabs/CratesTab";
import CurrencyTab from "../components/store/tabs/CurrencyTab";
import TopDonatorsTab from "../components/store/tabs/TopDonatorsTab";
import { useSeo } from "../hooks/useSeo";

const TAB_COMPONENTS = {
  ranks: RanksTab,
  crates: CratesTab,
  currency: CurrencyTab,
  donators: TopDonatorsTab,
};

export default function Store() {
  useSeo({
    title: "Store",
    description:
      "Support BDZONE and get ranks, crate keys, and in-game currency. Instant delivery on every purchase.",
    path: "/store",
  });

  const [activeTab, setActiveTab] = useState(STORE_TABS[0].key);
  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1
        className="mt-3 title gold-gradient-text "
      >
        Store
      </h1>
      <p className="p">
        Every purchase directly supports the server's hosting and
        development — ranks, crates, and currency, all in one place.
      </p>

      <StoreOverview />
      <StoreTabs active={activeTab} onChange={setActiveTab} />
      <ActiveTabComponent />
    </section>
  );
}