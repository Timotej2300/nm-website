import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { fetchVoteSites } from "../../../data/votes";

import topminecraftservers from "../../../assets/vote-sites/topminecraftservers.png";
import minecraftMp from "../../../assets/vote-sites/minecraft-mp.png";
import planetminecraft from "../../../assets/vote-sites/planetminecraft.png";
import mclist from "../../../assets/vote-sites/mclist.png";
import minecraftlist from "../../../assets/vote-sites/minecraftlist.png";
import minecraftbestservers from "../../../assets/vote-sites/minecraftbestservers.png";
import topg from "../../../assets/vote-sites/topg.png";
import minecraftServerlist from "../../../assets/vote-sites/minecraft-serverlist.png";
import minerank from "../../../assets/vote-sites/minerank.png";
import minecraftiplist from "../../../assets/vote-sites/minecraftiplist.png";
import minecraftbuzz from "../../../assets/vote-sites/minecraftbuzz.png";

// id -> local image, keeps the data file (Data/votes.js) free of import paths.
const LOGOS = {
  topminecraftservers,
  "minecraft-mp": minecraftMp,
  planetminecraft,
  mclist,
  minecraftlist,
  minecraftbestservers,
  topg,
  "minecraft-serverlist": minecraftServerlist,
  minerank,
  minecraftiplist,
  minecraftbuzz,
};

export default function VotingSitesTab() {
  const [sites, setSites] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetchVoteSites().then((data) => {
      if (isMounted) setSites(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!sites) {
    return (
      <p className="mt-10 text-center text-[15px] gold-gradient-text">Loading sites...</p>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="title text-[25px]! gold-gradient-text">
        All Sites
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sites.map(({ id, name, href }) => (
          <PixelBox
            key={id}
            tone="primary"
            contentClassName="flex flex-col items-center gap-3 text-center"
          >
            <img
              src={LOGOS[id]}
              alt={name}
              className="h-8 w-8 object-contain [image-rendering:pixelated]"
            />
            <span className="text-[12.5px] gradient-text">{name}</span>
            <PixelButton
              tone="primary"
              href={href}
              icon={ExternalLink}
              iconClassName="text-[#ffc02e]"
              size="sm"
              className="w-full py-4!"
            >
              <span className="gold-gradient-text">Vote Now</span>
            </PixelButton>
          </PixelBox>
        ))}
      </div>
    </div>
  );
}