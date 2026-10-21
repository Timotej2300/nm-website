import { useCallback, useState } from "react";
import PixelBox from "../../components/ui/PixelBox";
import PixelButton from "../../components/ui/PixelButton";
import { Notice } from "../../components/ui/Form";
import { errorMessage } from "../../lib/api";

/** Runs an async action with busy/error/message state (all set from event handlers). */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const run = useCallback(async (fn, okMessage) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fn();
      if (okMessage) setMessage(okMessage);
      return { ok: true, data: r };
    } catch (e) {
      setError(errorMessage(e));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, []);
  const clear = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);
  return { run, busy, error, message, clear };
}

export function Feedback({ error, message }) {
  if (!error && !message) return null;
  return (
    <div className="flex flex-col gap-2">
      {error && <Notice tone="danger">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
    </div>
  );
}

export function SectionTitle({ title, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[18px] gold-gradient-text">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Panel({ title, tone = "neutral", children, className = "" }) {
  return (
    <PixelBox
      tone={tone}
      className={`mb-5 ${className}`}
      contentClassName="flex flex-col gap-4"
      header={title ? <span className="gradient-text uppercase">{title}</span> : undefined}
    >
      {children}
    </PixelBox>
  );
}

export function Btn({ tone = "neutral", children, ...rest }) {
  return (
    <PixelButton tone={tone} size="sm" {...rest}>
      {children}
    </PixelButton>
  );
}

export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[11.5px]">
        <thead>
          <tr className="text-[9.5px] tracking-[0.08em] text-(--color-text-dim) uppercase">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "" }) => (
  <td className={`border-t border-white/5 px-2 py-2 align-middle text-(--color-text-muted) ${className}`}>{children}</td>
);

export function Pager({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2 text-[11.5px] text-(--color-text-muted)">
      <Btn disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ←
      </Btn>
      <span>
        {page} / {pages} ({total})
      </span>
      <Btn disabled={page >= pages} onClick={() => onPage(page + 1)}>
        →
      </Btn>
    </div>
  );
}

export function Forbidden() {
  return <Notice tone="danger">Na túto sekciu nemáte oprávnenie.</Notice>;
}

export function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
