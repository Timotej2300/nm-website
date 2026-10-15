import { useState } from "react";
import normalBase from "../../assets/buttons/normal-base.png";
import hoveredBase from "../../assets/buttons/hovered-base.png";
import normalClicked from "../../assets/buttons/normal-clicked.png";
import normalDisabled from "../../assets/buttons/normal-disabled.png";

export default function PlayButton({ children, disabled = false, href, ...rest }) {
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);

  const bg = disabled ? normalDisabled : down ? normalClicked : hover ? hoveredBase : normalBase;
  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      className={
        "relative inline-flex h-[52px] select-none items-center justify-center px-7 " +
        "border-[3px] border-black text-[13px] tracking-[0.08em] text-[#10240f] " +
        "[text-shadow:1px_1px_0_rgba(255,255,255,0.25)] " +
        "shadow-[inset_2px_2px_0_rgba(255,255,255,0.35),inset_-3px_-3px_0_rgba(0,0,0,0.45)] " +
        "transition-transform active:translate-y-0.5 " +
        "aria-disabled:cursor-not-allowed aria-disabled:text-[#33361f] aria-disabled:pointer-events-none"
      }
      style={{ backgroundImage: `url(${bg})`, backgroundRepeat: "repeat", backgroundSize: "12px 12px" }}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setDown(false);
      }}
      onMouseDown={() => !disabled && setDown(true)}
      onMouseUp={() => setDown(false)}
      {...rest}
    >
      <span>{children}</span>
    </Tag>
  );
}
