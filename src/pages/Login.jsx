import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import Captcha from "../components/auth/Captcha";
import { Field, Notice, TextInput } from "../components/ui/Form";
import { useAuth } from "../context/useAuth";
import { errorMessage } from "../lib/api";
import bdZoneLogo from "../assets/Logo/bd-zone-two.png";
import { useSeo } from "../hooks/useSeo";

export default function Login() {
  useSeo({ title: "Prihlásenie", path: "/login", noindex: true });

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const captchaRef = useRef(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [captcha, setCaptcha] = useState({ id: "", answer: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login({ identifier: identifier.trim(), password, remember, captchaId: captcha.id, captchaAnswer: captcha.answer });
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPassword("");
      captchaRef.current?.refresh(); // a CAPTCHA is single-use
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-80">
        <img src={bdZoneLogo} alt="BDZONE" className="w-full  " />
      </div>

      <PixelBox tone="primary" className="mt-6 w-full" contentClassName="px-6! py-8!">
        <form onSubmit={submit} className="flex flex-col gap-4 text-left" noValidate>
          <div className="text-center">
            <h1 className="text-[18px] gold-gradient-text">Prihlásenie</h1>
            <p className="mt-2 text-[11.5px] leading-relaxed text-(--color-text-muted)">
              Prihláste sa Minecraft nickom a heslom z herného servera, alebo e‑mailom a webovým heslom.
            </p>
          </div>

          <Field label="Email alebo Minecraft nick">
            <TextInput value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoCapitalize="off" spellCheck={false} maxLength={254} required />
          </Field>

          <Field label="Heslo">
            <div className="relative">
              <TextInput type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={256} className="pr-10" required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Skryť heslo" : "Zobraziť heslo"} aria-pressed={show} className="absolute inset-y-0 right-0 px-3 text-(--color-text-muted) hover:text-(--color-text)">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Captcha ref={captchaRef} onChange={setCaptcha} disabled={busy} />

          <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-(--color-text-muted)">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-(--color-primary)" />
            Zapamätať si ma
          </label>

          {error && <Notice tone="danger">{error}</Notice>}

          <PixelButton type="submit" tone="primary" className="w-full py-4!" disabled={busy || !identifier || !password || !captcha.answer} aria-busy={busy}>
            <span className="gold-gradient-text">{busy ? "Prihlasujem…" : "Prihlásiť sa"}</span>
          </PixelButton>

          <div className="flex flex-col items-center gap-2 text-[11px] text-(--color-text-muted)">
            <Link to="/forgot-password" className="hover:text-(--color-text) hover:underline">Zabudli ste heslo k e‑mailovému účtu?</Link>
            <p className="flex items-center gap-1.5 text-[10px] text-(--color-text-dim)">
              <ShieldCheck size={12} />
              Registrácia na webe nie je možná — účet vzniká na Minecraft serveri.
            </p>
          </div>
        </form>
      </PixelBox>
    </section>
  );
}
