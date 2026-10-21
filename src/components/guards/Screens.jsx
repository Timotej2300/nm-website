import { Link } from "react-router-dom";
import { Hammer, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import PixelBox from "../ui/PixelBox";
import PixelButton from "../ui/PixelButton";

function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(left / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return (
    <p className="text-[16px] gold-gradient-text">
      {h}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </p>
  );
}

export function MaintenanceScreen({ maintenance, showLogin }) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <PixelBox tone="warning" className="w-full" contentClassName="flex flex-col items-center gap-4 px-6! py-10!">
        <Hammer size={30} className="text-(--color-warning)" />
        <h1 className="text-[20px] gold-gradient-text">{maintenance.title}</h1>
        <p className="max-w-md text-[12.5px] leading-relaxed text-(--color-text-muted)">{maintenance.message}</p>
        {maintenance.returnAt && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10.5px] text-(--color-text-dim)">
              Plánovaný návrat: {new Date(maintenance.returnAt).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" })}
            </span>
            {maintenance.showCountdown && <Countdown to={maintenance.returnAt} />}
          </div>
        )}
        {showLogin && (
          <Link to="/login" className="mt-2">
            <PixelButton tone="neutral" size="sm" className="px-4!">
              Prihlásenie pre tím
            </PixelButton>
          </Link>
        )}
      </PixelBox>
    </section>
  );
}

export function UnavailableScreen({ message }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <PixelBox tone="neutral" className="w-full" contentClassName="flex flex-col items-center gap-4 px-6! py-10!">
        <EyeOff size={28} className="text-(--color-text-dim)" />
        <h1 className="text-[18px] gold-gradient-text">Stránka je dočasne nedostupná</h1>
        <p className="max-w-md text-[12.5px] leading-relaxed text-(--color-text-muted)">{message}</p>
        <Link to="/" className="mt-1">
          <PixelButton tone="primary" size="sm" className="px-5! py-4!">
            <span className="gold-gradient-text">Späť na Home</span>
          </PixelButton>
        </Link>
      </PixelBox>
    </section>
  );
}

export function BootScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-[14px] gold-gradient-text">Načítavam…</p>
    </div>
  );
}
