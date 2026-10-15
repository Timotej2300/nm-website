import Hero from "../components/landing/Hero/Hero";

import GameModes from "../components/landing/GameModes/GameModes";
import HowToJoin from "../components/landing/HowToJoin/HowToJoin";
import WhyPlayBdZone from "../components/landing/WhyPlayBdZone/WhyPlayBdZone";
import LatestNews from "../components/landing/LatestNews/LatestNews";
import { useSeo } from "../hooks/useSeo";

export default function Home() {
  useSeo({
    title: "Home",
    description:
      "Join BDZONE, a friendly Java & Bedrock cross-play Minecraft survival server built for the Bangladeshi community. Vote for rewards, grab ranks and crates, and climb the leaderboards.",
    path: "/",
  });

  return (
    <>
      <Hero />
      <WhyPlayBdZone/>
      <GameModes />
      <LatestNews />
      <HowToJoin/>
    </>
  );
}