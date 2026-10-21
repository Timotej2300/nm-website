import { useEffect } from "react";
import PixelBox from "./PixelBox";
import PixelButton from "./PixelButton";

const INPUT =
  "w-full rounded-sm border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-(--color-text) outline-none " +
  "placeholder:text-(--color-text-dim) focus:border-(--color-primary) disabled:opacity-50";

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 text-left ${className}`}>
      {label && <span className="text-[10.5px] tracking-[0.06em] text-(--color-text-muted) uppercase">{label}</span>}
      {children}
      {hint && !error && <span className="text-[10px] text-(--color-text-dim)">{hint}</span>}
      {error && <span className="text-[10.5px] text-(--color-danger)">{error}</span>}
    </label>
  );
}

export function TextInput({ className = "", ...rest }) {
  return <input className={`${INPUT} ${className}`} {...rest} />;
}

export function TextArea({ className = "", rows = 4, ...rest }) {
  return <textarea rows={rows} className={`${INPUT} resize-y leading-relaxed ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`${INPUT} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex items-center gap-2 text-[11.5px] text-(--color-text-muted) ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-(--color-primary)"
      />
      {label}
    </label>
  );
}

const BADGE = {
  neutral: "bg-white/10 text-(--color-text-muted)",
  gold: "bg-(--color-primary)/15 text-(--color-primary)",
  green: "bg-(--color-success)/15 text-(--color-success)",
  red: "bg-(--color-danger)/15 text-(--color-danger)",
  blue: "bg-(--color-info)/15 text-(--color-info)",
  pink: "bg-(--color-pink)/15 text-(--color-pink)",
};

export function Badge({ tone = "neutral", children }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold tracking-[0.06em] uppercase ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

export function Loading({ text = "Načítavam…" }) {
  return <p className="py-10 text-center text-[13px] gold-gradient-text">{text}</p>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <PixelBox tone="danger" className="my-4" contentClassName="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-[12px] text-(--color-text)">{message || "Nastala chyba"}</p>
      {onRetry && (
        <PixelButton tone="neutral" size="sm" onClick={onRetry}>
          Skúsiť znova
        </PixelButton>
      )}
    </PixelBox>
  );
}

export function EmptyState({ title, text }) {
  return (
    <PixelBox tone="neutral" className="my-4" contentClassName="flex flex-col items-center gap-2 py-10 text-center">
      <h3 className="text-[13px] gold-gradient-text">{title}</h3>
      {text && <p className="max-w-sm text-[11.5px] leading-relaxed text-(--color-text-muted)">{text}</p>}
    </PixelBox>
  );
}

export function Notice({ tone = "info", children }) {
  const color = { info: "var(--color-info)", success: "var(--color-success)", danger: "var(--color-danger)", warning: "var(--color-warning)" }[tone];
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className="rounded-sm px-3 py-2 text-left text-[11.5px] leading-relaxed"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {children}
    </p>
  );
}

/** Confirmation before destructive / risky actions. */
export function ConfirmDialog({ open, title, text, confirmLabel = "Potvrdiť", tone = "danger", onConfirm, onCancel, busy }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-2000 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <PixelBox tone={tone} className="w-full max-w-md" contentClassName="flex flex-col gap-4 p-5">
        <h2 className="text-[15px] gold-gradient-text">{title}</h2>
        {text && <p className="text-[12px] leading-relaxed text-(--color-text-muted)">{text}</p>}
        <div className="flex justify-end gap-2">
          <PixelButton tone="neutral" size="sm" onClick={onCancel} disabled={busy}>
            Zrušiť
          </PixelButton>
          <PixelButton tone={tone} size="sm" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </PixelButton>
        </div>
      </PixelBox>
    </div>
  );
}
