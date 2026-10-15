import rear from "../../../assets/hero/rear.png";
import seaAnim from "../../../assets/hero/sea-anim.webp";
import foreground from "../../../assets/hero/foreground.png";
import flowerAnim from "../../../assets/hero/flower-anim.webp";
import bee1 from "../../../assets/hero/bee1.webp";
import bee2 from "../../../assets/hero/bee2.webp";

const LAYER = "absolute inset-0 [image-rendering:pixelated]";
const SCENE_ASPECT = "400 / 280";
const SHIFT_DOWN_PX = 56;

export default function HeroBackground() {
  return (
    <div
      className="fixed inset-x-0 top-0 -z-10 h-[clamp(420px,62vw,750px)] overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="fixed left-2/3 sm:left-1/2 md:left-1/2 lg:left-1/2 bottom-0 h-auto w-auto min-h-full min-w-full"
        style={{
          aspectRatio: SCENE_ASPECT,
          transform: `translate(-50%, ${SHIFT_DOWN_PX}px)`,
        }}
      >
        <div className={`${LAYER} z-0`} style={{ backgroundImage: `url(${rear})`, backgroundSize: "100% 100%" }} />
        <div className={`${LAYER} z-10`} style={{ backgroundImage: `url(${seaAnim})`, backgroundSize: "100% 100%" }} />
        <div className={`${LAYER} z-20`} style={{ backgroundImage: `url(${foreground})`, backgroundSize: "100% 100%" }} />
        <div className={`${LAYER} z-30`} style={{ backgroundImage: `url(${flowerAnim})`, backgroundSize: "100% 100%" }} />

        <img
          src={bee1}
          alt=""
          className="absolute top-[46%] z-50 h-[15%] w-[15%] [image-rendering:pixelated] filter-[drop-shadow(0_2px_2px_rgba(0,0,0,0.35))] animate-[bee-drift-1_14s_ease-in-out_infinite] motion-reduce:animate-none!"
        />
        <img
          src={bee2}
          alt=""
          className="absolute top-[38%] z-50 h-[10%] w-[10%] [image-rendering:pixelated] filter-[drop-shadow(0_2px_2px_rgba(0,0,0,0.35))] animate-[bee-drift-2_17s_ease-in-out_infinite] [animation-delay:-5s] motion-reduce:animate-none!"
        />
      </div>

      <div className="fixed inset-0 z-40 bg-black/50 sm:bg-black/65 md:bg-black/65 lg:bg-black/75" />
    </div>
  );
}