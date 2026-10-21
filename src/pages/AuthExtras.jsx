import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import Captcha from "../components/auth/Captcha";
import { Field, Notice, TextInput } from "../components/ui/Form";
import { api, errorMessage } from "../lib/api";
import { useSeo } from "../hooks/useSeo";
import bdZoneLogo from "../assets/Logo/bd-zone-two.png";

function Shell({ title, children }) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-60"><img src={bdZoneLogo} alt="BDZONE" className="w-full" /></div>
      <PixelBox tone="primary" className="mt-6 w-full" contentClassName="flex flex-col gap-4 px-6! py-8! text-left">
        <h1 className="text-center text-[17px] gold-gradient-text">{title}</h1>
        {children}
        <Link to="/login" className="text-center text-[11px] text-(--color-text-muted) hover:text-(--color-text) hover:underline">← Späť na prihlásenie</Link>
      </PixelBox>
    </section>
  );
}

export function ForgotPassword() {
  useSeo({ title: "Obnova hesla", path: "/forgot-password", noindex: true });
  const ref = useRef(null);
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState({ id: "", answer: "" });
  const [state, setState] = useState({ busy: false, error: null, done: false });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null, done: false });
    try {
      await api.post("/auth/forgot", { email: email.trim(), captchaId: captcha.id, captchaAnswer: captcha.answer });
      setState({ busy: false, error: null, done: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), done: false });
    } finally {
      ref.current?.refresh();
    }
  };
  return (
    <Shell title="Obnova hesla">
      {state.done ? (
        <Notice tone="success">Ak existuje overený e‑mailový účet s touto adresou, poslali sme naň odkaz na nastavenie nového hesla. Odkaz platí krátko a dá sa použiť iba raz.</Notice>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="text-[11.5px] leading-relaxed text-(--color-text-muted)">Týka sa iba webového hesla k e‑mailovému prihláseniu. Heslo z Minecraft servera sa tu nemení.</p>
          <Field label="E‑mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></Field>
          <Captcha ref={ref} onChange={setCaptcha} disabled={state.busy} />
          {state.error && <Notice tone="danger">{state.error}</Notice>}
          <PixelButton type="submit" tone="primary" disabled={state.busy || !email || !captcha.answer}><span className="gold-gradient-text">{state.busy ? "Odosielam…" : "Poslať odkaz"}</span></PixelButton>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  useSeo({ title: "Nové heslo", path: "/reset-password", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [state, setState] = useState({ busy: false, error: null, done: false });
  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setState({ busy: false, error: "Heslá sa nezhodujú.", done: false });
    setState({ busy: true, error: null, done: false });
    try {
      await api.post("/auth/reset", { token, password: pw });
      setState({ busy: false, error: null, done: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), done: false });
    }
  };
  return (
    <Shell title="Nové heslo">
      {!token ? (
        <Notice tone="danger">Odkaz je neplatný. Vyžiadajte si nový.</Notice>
      ) : state.done ? (
        <Notice tone="success">Heslo bolo zmenené. Všetky staré relácie boli odhlásené — môžete sa prihlásiť.</Notice>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Nové heslo" hint="Minimálne 10 znakov."><TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" maxLength={256} required /></Field>
          <Field label="Nové heslo znova"><TextInput type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" maxLength={256} required /></Field>
          {state.error && <Notice tone="danger">{state.error}</Notice>}
          <PixelButton type="submit" tone="primary" disabled={state.busy || !pw || !pw2}><span className="gold-gradient-text">{state.busy ? "Ukladám…" : "Nastaviť heslo"}</span></PixelButton>
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmail() {
  useSeo({ title: "Overenie e‑mailu", path: "/verify-email", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState({ status: token ? "working" : "bad", error: null });
  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.post("/auth/verify-email", { token })
      .then(() => alive && setState({ status: "ok", error: null }))
      .catch((e) => alive && setState({ status: "bad", error: errorMessage(e) }));
    return () => { alive = false; };
  }, [token]);
  return (
    <Shell title="Overenie e‑mailu">
      {state.status === "working" && <p className="text-center text-[12px] text-(--color-text-muted)">Overujem…</p>}
      {state.status === "ok" && <Notice tone="success">E‑mail bol overený. Teraz sa môžete prihlásiť e‑mailom a webovým heslom.</Notice>}
      {state.status === "bad" && <Notice tone="danger">{state.error || "Odkaz je neplatný alebo vypršal."}</Notice>}
    </Shell>
  );
}
