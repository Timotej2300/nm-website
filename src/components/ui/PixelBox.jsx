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
  },primary_active: {
    base: "var(--btn-bg-primary-active)",
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
    base: "var(--btn-bg-info-hover)",
    hover: "var(--btn-bg-info-hover)",
    focus: "var(--btn-bg-info-hover)",
  },
  success: {
    base: "var(--btn-bg-success)",
    hover: "var(--btn-bg-success)",
    focus: "var(--btn-bg-success)",
  },
};

const PADDING = {
  none: "p-0",
  sm: "p-2.5",
  md: "p-4",
  lg: "p-6",
};

const BASE =
  "relative flex flex-col " +
  "transition-transform pixel-btn"; 
  // pixel-btn class re-use kora hocche border/shadow er pixel look pawar jonno,
  // eta tomar CSS e already exist kore, tai hover/active transform effect gulo
  // niche override kore disable kore dicchi jehetu eta ekta container, button na.

export default function PixelBox({
  tone = "neutral",
  filled = false,
  padding = "md",
  as: Tag = "div",
  header,
  headerClassName = "",
  children,
  className = "",
  contentClassName = "",
  ...rest
}) {
  const vars = TONE_VARS[tone] ?? TONE_VARS.neutral;

  const style = {
    "--btn-bg": filled ? vars.hover : vars.base,
    "--btn-bg-hover": filled ? vars.hover : vars.base,
    "--btn-bg-focus": filled ? vars.hover : vars.base,
  };

  return (
    <Tag
      className={`${BASE} !active:translate-y-0 !hover:cursor-default ${className}`}
      style={style}
      {...rest}
    >
      {header && (
        <div
          className={`shrink-0 flex items-center gap-2 px-4 py-2 tracking-[0.08em] text-[11px] border-b border-black/10 ${headerClassName}`}
        >
          {header}
        </div>
      )}
      <div className={`${PADDING[padding]} ${contentClassName}`}>
        {children}
      </div>
    </Tag>
  );
}