import PixelBox from "../../ui/PixelBox";
import "./WhyPlayBdZone.css";

import lagFree from "../../../assets/reasons/lag-free.png";
import uptime from "../../../assets/reasons/uptime.png";
import moderation from "../../../assets/reasons/moderation.png";
import events from "../../../assets/reasons/events.png";
import fairPlay from "../../../assets/reasons/fair-play.png";
import crossPlatform from "../../../assets/reasons/cross-platform.png";
import community from "../../../assets/reasons/community.png";
import customFeatures from "../../../assets/reasons/custom-features.png";

const REASONS = [
  {
    image: lagFree,
    title: "Lag-Free Performance",
    description: "Powerful servers ensure smooth gameplay even with high player counts",
  },
  {
    image: uptime,
    title: "24/7 Uptime",
    description: "Our servers run around the clock so you can play anytime",
  },
  {
    image: moderation,
    title: "Active Moderation",
    description: "Dedicated staff team keeping the community safe and friendly",
  },
  {
    image: events,
    title: "Regular Events",
    description: "Weekly events and tournaments with amazing prizes",
  },
  {
    image: fairPlay,
    title: "Fair Gameplay",

    description: "Strict anti-cheat and balanced economy for everyone",
  },
  {
    image: crossPlatform,
    title: "Cross-Platform",
    description: "Play on Java or Bedrock edition - we support both!",
  },
  {
    image: community,
    title: "Active Community",
    description: "Join thousands of players in our vibrant Discord community",
  },
  {
    image: customFeatures,
    title: "Custom Features",
    description: "Unique plugins and features you won't find anywhere else",
  },
];

function ReasonCard({ image, title, description }) {
  return (
    <PixelBox
      className="w-70  shrink-0"
      contentClassName="flex flex-col gap-2"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl "

      >
        <img
          src={image}
          alt={title}
          className="h-15 w-15 object-contain [image-rendering:pixelated]"
        />
      </div>

      <h3 className="text-[13px] gold-gradient-text">{title}</h3>

      <p className="text-[11.5px] leading-relaxed text-(--color-text-muted)">
        {description}
      </p>
    </PixelBox>
  );
}

export default function WhyPlayBdZone() {
  const items = [...REASONS, ...REASONS];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-25 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <h2 className="title gold-gradient-text">
          Why Play on BD ZONE?
        </h2>
        <p className="p">Experience the difference with our premium Minecraft server</p>
      </div>

      <div className="marquee-wrap mt-10">
        <div className="marquee-track gap-5" style={{ "--marquee-duration": "36s" }}>
          {items.map(({ image, title,  description }, index) => (
            <ReasonCard
              key={`${title}-${index}`}
              image={image}
              title={title}
              description={description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}