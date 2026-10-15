import { Link } from "react-router-dom";
import defaultBtn from "../../assets/buttons/default-button.png";

export default function Logo() {
  return (
    <Link
      to="/"
      aria-label="Go to homepage"
      className="relative flex h-14 shrink-0 items-center gap-2 px-2 sm:px-3 box-border border-10 border-solid border-transparent [image-rendering:pixelated] [border-image-repeat:stretch] [border-image-width:21px] [border-image-slice:20_fill] [border-image-source:var(--btn-bg)]"
      style={{ "--btn-bg": `url(${defaultBtn})` }}
    >
      <img src="/favicon.svg" alt="" className="h-4.5 w-4.5" />
      <span className="hidden whitespace-nowrap gold-gradient-text text-[14px] sm:inline">
        BDZONE
      </span>
    </Link>
  );
}