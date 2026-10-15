import PixelBox from "../../ui/PixelBox";
import Survival from "../../../assets/modes/survival.png";
import MiniGames from "../../../assets/modes/minigames.png";
import Bedwars from "../../../assets/modes/bedwars.png";
import Skyblock from "../../../assets/modes/skyblock.png";

const MODES = [
  {
    image: Survival,
    title: "Survival",
    dot: "var(--color-success)",
    description: "Classic Minecraft survival with custom features and economy",
    perks: ["Custom Economy", "Land Claiming", "Player Shops"],
  },
  {
    image: Bedwars,
    title: "PvP Arena",
    dot: "var(--color-danger)",
    description: "Intense player vs player combat with unique game modes",
    perks: ["Kit PvP", "Tournaments", "Rankings"],
  },
  {
    image: MiniGames,
    title: "Minigames",
    dot: "var(--color-pink)",
    description: "Fun and competitive minigames for everyone",
    perks: ["Bedwars", "Skywars", "Build Battle"],
  },
  {
    image: Skyblock,
    title: "Skyblock",
    dot: "var(--color-info)",
    description: "Build your island empire in the sky",
    perks: ["Custom Islands", "Challenges", "Trading"],
  },
];

export default function GameModes() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-18 sm:px-6 ">

        <div className="flex flex-col items-center">
          <h2 className="title gold-gradient-text">Choose your adventure</h2>
          <p className="p">
            Multiple game modes to keep you entertained for hours.
          </p>
        </div>


      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map(({ image, title, dot, description, perks }) => (
          <PixelBox
            key={title}
            contentClassName="flex flex-col items-center text-center gap-3 transition-transform hover:-translate-y-2"
          >
            <div className="h-20 w-20 shrink-0 flex items-center justify-center">
              <img
                src={image}
                alt={title}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            </div>

            <h3 className="text-[13px] text-(--color-text)">{title}</h3>

            <p className="text-[11.5px] leading-relaxed text-(--color-text-muted)">
              {description}
            </p>

            <span
              className="h-px w-10 my-1"
              style={{ backgroundColor: dot, opacity: 0.4 }}
            />

            <ul className="flex flex-col items-center gap-2">
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-center gap-2 text-[11.5px] text-[var(--color-text-muted)]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dot }}
                  />
                  {perk}
                </li>
              ))}
            </ul>
          </PixelBox>
        ))}
      </div>
    </section>
  );
}