import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { Field, TextInput } from "../ui/Form";

/**
 * Server-verified visual CAPTCHA. The SVG is shown through <img src="data:…">,
 * so it can never run script. A CAPTCHA is single-use: call `ref.refresh()`
 * after every submit attempt (the parent does it via `reset`).
 * `onChange({ id, answer })` reports the current pair.
 */
const Captcha = forwardRef(function Captcha({ onChange, disabled }, ref) {
  const [c, setC] = useState(null);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get("/auth/captcha")
      .then((r) => {
        if (!alive) return;
        setC(r);
        setErr(null);
        setAnswer("");
        onChange?.({ id: r.id, answer: "" });
      })
      .catch((e) => alive && setErr(errorMessage(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => {
    setC(null);
    setTick((t) => t + 1);
  }, []);
  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  return (
    <Field label="Opíšte znaky z obrázka" error={err}>
      <div className="flex items-center gap-2">
        <div className="flex h-14 w-40 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-black/35">
          {c ? (
            <img alt="CAPTCHA" className="h-full w-full object-contain [image-rendering:pixelated]" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.svg)}`} />
          ) : (
            <span className="text-[10px] text-(--color-text-dim)">{err ? "chyba" : "…"}</span>
          )}
        </div>
        <button type="button" onClick={refresh} disabled={disabled} aria-label="Nový obrázok" className="rounded-sm border border-white/10 p-2 text-(--color-text-muted) hover:text-(--color-text) disabled:opacity-50">
          <RefreshCw size={14} />
        </button>
      </div>
      <TextInput
        value={answer}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={8}
        disabled={disabled || !c}
        onChange={(e) => {
          setAnswer(e.target.value);
          onChange?.({ id: c?.id, answer: e.target.value });
        }}
        placeholder="Kód"
      />
    </Field>
  );
});

export default Captcha;
