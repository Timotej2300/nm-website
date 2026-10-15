import { useState } from "react";
import VoteOverview from "../components/vote/VoteOverview";
import PlayerSearch from "../components/vote/PlayerSearch";
import VoteTabs from "../components/vote/VoteTabs";
import { VOTE_TABS } from "../components/vote/voteTabsConfig";
import VotingSitesTab from "../components/vote/tabs/VotingSitesTab";
import LeaderboardsTab from "../components/vote/tabs/LeaderboardsTab";
import VotingRewardsTab from "../components/vote/tabs/VotingRewardsTab";
import WallOfFameTab from "../components/vote/tabs/WallOfFameTab";
import { useSeo } from "../hooks/useSeo";

const TAB_COMPONENTS = {
  sites: VotingSitesTab,
  leaderboards: LeaderboardsTab,
  rewards: VotingRewardsTab,
  "wall-of-fame": WallOfFameTab,
};

export default function Votes() {
  useSeo({
    title: "Vote",
    description:
      "Vote for BDZONE on top server lists to earn in-game rewards. Check leaderboards, voting sites, and the wall of fame.",
    path: "/votes",
  });
  
  const [activeTab, setActiveTab] = useState(VOTE_TABS[0].key);
  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 ">
      <VoteOverview />
      <PlayerSearch />
      <VoteTabs active={activeTab} onChange={setActiveTab} />
      <ActiveTabComponent />
    </section>
  );
}