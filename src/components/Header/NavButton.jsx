import { NavLink } from "react-router-dom";

const DESKTOP_BASE =
  "relative shrink-0 flex items-center justify-center whitespace-nowrap " +
  "h-14 px-[18px]  text-[14px]    " +
  "transition-transform active:translate-y-px outline-none " +
  "box-border border-[6px] border-solid border-transparent [image-rendering:pixelated] " +
  "[border-image-repeat:stretch] [border-image-width:21px] [border-image-slice:20_fill] " +
  "[border-image-source:var(--btn-bg-default)] hover:[border-image-source:var(--btn-bg-default-hover)] " +
  "focus-visible:[border-image-source:var(--btn-bg-primary-focus)]";

// Flat list row for the mobile dropdown — divider line instead of a
// pixel-button border, matching the reference mobile menu.
const MOBILE_BASE =
  "flex w-full items-center justify-between gap-2 whitespace-nowrap " +
  "border-b border-white/5 px-4 py-4 text-[15px]  " +
  "transition-colors outline-none";

export default function NavButton({
  to,
  label,
  end,
  badge,
  mobile,
  onNavigate,
}) {
  if (mobile) {
    return (
      <NavLink
      onClick={onNavigate}
        to={to}
        end={end}
        className={MOBILE_BASE}
      >
        {({ isActive }) => (
          <>
            <span
              className={
                "gradient-text " +
                (isActive
                  ? ""
                  : "group-hover:[--nav-grad-top:#ffe066] group-hover:[--nav-grad-bottom:#c97a12]")
              }
              style={{
                "--nav-grad-top": isActive ? "#ffe066" : "",
                "--nav-grad-bottom": isActive ? "#c97a12" : "",
              }}
            >
              {label}
            </span>

            {badge && (
              <span className="absolute -top-2 -right-1.5 border border-black bg-(--color-success) px-1 py-0.5 text-[8px] tracking-wider text-[#0d1f0d]">
                {badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        DESKTOP_BASE +
        " group " +
        (isActive
          ? "[border-image-source:var(--btn-bg-primary-active)] hover:[border-image-source:var(--btn-bg-primary-active)]"
          : "")
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={
              "gradient-text " +
              (isActive
                ? ""
                : "group-hover:[--nav-grad-top:#ffe066] group-hover:[--nav-grad-bottom:#c97a12]")
            }
            style={{
              "--nav-grad-top": isActive ? "#ffe066" : "",
              "--nav-grad-bottom": isActive ? "#c97a12" : "",
            }}
          >
            {label}
          </span>

          {badge && (
            <span className="absolute -top-2 -right-1.5 border border-black bg-(--color-success) px-1 py-0.5 text-[8px] tracking-wider text-[#0d1f0d]">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
