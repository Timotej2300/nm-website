import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Gamepad2, Menu, X } from "lucide-react";
import Logo from "./Logo";
import NavButton from "./NavButton";
import { navItems } from "./navItems";
import PixelButton from "../ui/PixelButton";
import { useCart } from "../../context/useCart";
import cartIcon from "../../assets/icons/cart.png";

function CartBadge({ count, className = "top-1.5 right-1.5" }) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute ${className} flex h-4 min-w-4 items-center justify-center rounded-full bg-(--color-primary) px-1 text-[9px] font-bold text-black`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  const { count } = useCart();

  // close the mobile panel whenever the route changes (derived during render,
  // see https://react.dev/learn/you-might-not-need-an-effect)
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  return (
    <header className="fixed top-0 left-0 w-full border-b-3 border-t-3 border-(--color-border) bg-(--color-header) z-1000">
      <div className="flex h-14 w-full items-center justify-between">
        <div className="flex items-stretch">
          <Logo />
          <nav
            className="hidden items-stretch min-[1080px]:flex"
            aria-label="Primary"
          >
            {navItems.map((item) => (
              <NavButton key={item.to} {...item} />
            ))}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 pr-3 min-[1080px]:flex">
          <Link
            to="/cart"
            aria-label="View cart"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center text-(--color-text) transition-colors hover:text-(--color-primary)"
          >
            <img
              src={cartIcon}
              alt=""
              className="h-5 w-5 object-contain [image-rendering:pixelated]"
            />
            <CartBadge count={count} />
          </Link>

          <Link to={'/login'}>
            <PixelButton
              tone="success"
              size="lg"
              icon={Gamepad2}
              className="shrink-0 px-4!"
              textClassName="gradient-text"
              textStyle={{
                "--nav-grad-top": "#6fcb6b",
                "--nav-grad-bottom": "#2a9328",
              }}
            >
              Sign in with Xbox
            </PixelButton>
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center text-(--color-text) min-[1080px]:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div
        className={
          "grid overflow-hidden transition-all duration-300 min-[1080px]:hidden " +
          (open
            ? "grid-rows-[1fr] border-t-2 border-(--color-border) opacity-100"
            : "grid-rows-[0fr] opacity-0")
        }
      >
        <div className="min-h-0">
          <nav className="flex flex-col" aria-label="Primary mobile">
            {navItems.map((item) => (
              <NavButton
                key={item.to}
                {...item}
                mobile
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
          <Link
            to="/cart"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2 border-b border-white/5 px-4 py-4 text-[15px]"
          >
            <span className="gradient-text">Cart</span>
            <span className="relative flex items-center">
              <img
                src={cartIcon}
                alt=""
                className="h-4.5 w-4.5 object-contain [image-rendering:pixelated]"
              />
              <CartBadge count={count} className="-top-2 -right-2" />
            </span>
          </Link>

          <div className="px-4 py-4">
            <PixelButton
              tone="success"
              filled
              icon={Gamepad2}
              className="h-14 w-full"
              textClassName="gradient-text"
              textStyle={{
                "--nav-grad-top": "#6fcb6b",
                "--nav-grad-bottom": "#2a9328",
              }}
            >
              Sign in with Xbox
            </PixelButton>
          </div>
        </div>
      </div>
    </header>
  );
}
