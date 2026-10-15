const TONE_VARS = {
  neutral: {
    base: "var(--btn-bg-default)",
    hover: "var(--btn-bg-default-hover)",
    focus: "var(--btn-bg-default-hover)",
  },
  primary: {
    base: "var(--btn-bg-primary)",
    hover: "var(--btn-bg-primary-hover)",
    focus: "var(--btn-bg-primary-focus)",
  },
  danger: {
    base: "var(--btn-bg-danger)",
    hover: "var(--btn-bg-danger-hover)",
    focus: "var(--btn-bg-danger-focus)",
  },
  pink: {
    base: "var(--btn-bg-pink)",
    hover: "var(--btn-bg-pink-hover)",
    focus: "var(--btn-bg-pink-focus)",
  },
  warning: {
    base: "var(--btn-bg-default)",
    hover: "var(--btn-bg-warning-hover)",
    focus: "var(--btn-bg-warning-focus)",
  },
  info: {
    base: "var(--btn-bg-info)",
    hover: "var(--btn-bg-info-hover)",
    focus: "var(--btn-bg-info-hover)",
  },
  success: {
    base: "var(--btn-bg-success)",
    hover: "var(--btn-bg-success)",
    focus: "var(--btn-bg-success)",
  },
};

const SIZES = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-10 px-6 text-[13px]",
  lg: "h-14 px-8 text-[15px]",
};

const BASE =
  "relative shrink-0 flex items-center justify-center whitespace-nowrap " +
  "gap-2 tracking-[0.08em] " +
  "transition-transform active:translate-y-px outline-none pixel-btn";

export default function PixelButton({
  tone = "neutral",
  filled = false,
  size = "md",
  href,
  children,
  icon: Icon,
  className = "",
  textClassName = "",
  textStyle = {},   
  iconClassName= "",
  iconSize= "18",
  ...rest
}) {
  const vars = TONE_VARS[tone] ?? TONE_VARS.neutral;
  const Tag = href ? "a" : "button";

  const style = {
    "--btn-bg": filled ? vars.hover : vars.base,
    "--btn-bg-hover": vars.hover,
    "--btn-bg-focus": vars.focus,
  };

  return (
    <Tag
      href={href}
      className={`${BASE} ${SIZES[size]} ${className}`}
      style={style}
      {...rest}
    >
      {Icon && <Icon size={iconSize} strokeWidth={2.5} className={iconClassName} />}
      <span className={textClassName} style={textStyle}>{children}</span>
    </Tag>
  );
}