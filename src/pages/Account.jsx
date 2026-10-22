import { useState } from "react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { Badge, ErrorBox, Field, Loading, Notice, TextInput } from "../components/ui/Form";
import { useAuth } from "../context/useAuth";
import { useApi } from "../hooks/useApi";
import { useSeo } from "../hooks/useSeo";
import { api, errorMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";

function useSubmit() {
  const [s, setS] = useState({ busy: false, error: null, ok: null });
  const run = async (fn, okText) => {
    setS({ busy: true, error: null, ok: null });
    try {
      const r = await fn();
      setS({ busy: false, error: null, ok: typeof okText === "function" ? okText(r) : okText });
      return true;
    } catch (e) {
      setS({ busy: false, error: errorMessage(e), ok: null });
      return false;
    }
  };
  return [s, run];
}

const Box = ({ title, children }) => (
  <PixelBox tone="neutral" className="mb-5" contentClassName="flex flex-col gap-4" header={<span className="gradient-text uppercase">{title}</span>}>
    {children}
  </PixelBox>
);
const Msg = ({ s }) => (s.error ? <Notice tone="danger">{s.error}</Notice> : s.ok ? <Notice tone="success">{s.ok}</Notice> : null);
const Save = ({ busy, children }) => (
  <div><PixelButton type="submit" tone="primary" size="sm" disabled={busy}><span className="gold-gradient-text">{busy ? "Moment…" : children}</span></PixelButton></div>
);

function LinkAccount({ account, onDone }) {
  const [code, setCode] = useState("");
  const [s, run] = useSubmit();
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => api.post("/account/link", { code }), "Účet je prepojený s Minecraft identitou (UUID).")) { setCode(""); onDone(); }
  };
  return (
    <Box title="Prepojenie s Minecraft účtom">
      {account.uuidLinked ? (
        <p className="text-[12px] text-(--color-text-muted)"><Badge tone="green">prepojené</Badge> UUID: <span className="text-(--color-text)">{account.uuid}</span></p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-[11.5px] leading-relaxed text-(--color-text-muted)">V hre napíšte <b className="text-(--color-text)">/weblink</b> — dostanete jednorazový kód s krátkou platnosťou. Zadajte ho sem; účet sa naviaže na váš stabilný Minecraft UUID.</p>
          <Field label="Kód z hry"><TextInput value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" maxLength={32} /></Field>
          <Msg s={s} />
          <Save busy={s.busy || !code.trim()}>Prepojiť</Save>
        </form>
      )}
    </Box>
  );
}

function EmailBox({ account, mailConfigured, setupWithoutPassword }) {
  const [f, setF] = useState({ email: "", current: "", web: "" });
  const [s, run] = useSubmit();
  const submit = async (e) => {
    e.preventDefault();
    await run(() => api.post("/account/email", { email: f.email.trim(), ...(f.current ? { currentPassword: f.current } : {}), ...(f.web ? { webPassword: f.web } : {}) }), (r) => r.message);
    setF({ ...f, current: "", web: "" });
  };
  return (
    <Box title="E‑mail a webové heslo">
      <p className="text-[11.5px] text-(--color-text-muted)">
        {account.email ? <>Aktuálny e‑mail: <b className="text-(--color-text)">{account.email}</b> {account.emailVerified ? <Badge tone="green">overený</Badge> : <Badge tone="gold">neoverený</Badge>}</> : "E‑mail zatiaľ nie je prepojený."}
      </p>
      {!mailConfigured ? (
        <Notice tone="warning">Odosielanie e‑mailov nie je na serveri nastavené, preto teraz nemožno e‑mail prepojiť ani zmeniť.</Notice>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Nový e‑mail"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={254} /></Field>
          {!account.hasWebPassword && (
            <Field label="Webové heslo (iné ako do Minecraftu)" hint="Min. 10 znakov. Použijete ho pri prihlásení e‑mailom."><TextInput type="password" value={f.web} onChange={(e) => setF({ ...f, web: e.target.value })} autoComplete="new-password" maxLength={256} /></Field>
          )}
          {!setupWithoutPassword && (
            <Field label="Aktuálne heslo (potvrdenie)"><TextInput type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" maxLength={256} /></Field>
          )}
          <Msg s={s} />
          <Save busy={s.busy || !f.email || (!setupWithoutPassword && !f.current) || (!account.hasWebPassword && !f.web)}>Poslať overovací e‑mail</Save>
        </form>
      )}
    </Box>
  );
}

function PasswordBox({ account }) {
  const [f, setF] = useState({ current: "", next: "", next2: "" });
  const [s, run] = useSubmit();
  if (!account.hasWebPassword || !account.emailVerified) return null;
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.next2) return run(async () => { throw new Error("Nové heslá sa nezhodujú."); });
    if (await run(() => api.post("/account/web-password", { currentPassword: f.current, newPassword: f.next }), "Heslo zmenené, ostatné relácie boli odhlásené.")) setF({ current: "", next: "", next2: "" });
  };
  return (
    <Box title="Zmena webového hesla">
      <p className="text-[11px] text-(--color-text-dim)">Mení sa iba webové heslo. Heslo do Minecraftu (AuthMe) sa tu nikdy nemení.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Aktuálne heslo"><TextInput type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" maxLength={256} /></Field>
        <Field label="Nové heslo"><TextInput type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" maxLength={256} /></Field>
        <Field label="Nové heslo znova"><TextInput type="password" value={f.next2} onChange={(e) => setF({ ...f, next2: e.target.value })} autoComplete="new-password" maxLength={256} /></Field>
        <Msg s={s} />
        <Save busy={s.busy || !f.current || !f.next}>Zmeniť heslo</Save>
      </form>
    </Box>
  );
}

function Sessions() {
  const { logout } = useAuth();
  const { data, error, loading, reload } = useApi("/account/sessions");
  const [s, run] = useSubmit();
  const all = async () => {
    if (await run(() => api.post("/auth/logout-all"), "Odhlásené všade.")) { await logout().catch(() => {}); }
  };
  return (
    <Box title="Aktívne relácie">
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <ul className="flex flex-col gap-2 text-[11.5px] text-(--color-text-muted)">
          {data.sessions.map((x) => (
            <li key={x.id} className="rounded-sm bg-white/5 p-2.5">
              {x.current && <Badge tone="green">táto relácia</Badge>} {x.remember && <Badge tone="blue">zapamätaná</Badge>}
              <div className="mt-1">Prihlásenie: {formatDateTime(x.createdAt)} · posledná aktivita: {formatDateTime(x.lastSeenAt)}</div>
              <div className="truncate text-[10px] text-(--color-text-dim)">{x.userAgent || "—"}</div>
            </li>
          ))}
        </ul>
      )}
      <Msg s={s} />
      <div><PixelButton tone="danger" size="sm" disabled={s.busy} onClick={all}>Odhlásiť zo všetkých zariadení</PixelButton></div>
    </Box>
  );
}

export default function Account() {
  useSeo({ title: "Účet", path: "/account", noindex: true });
  const { data, error, loading, reload } = useApi("/account");
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-[20px] gold-gradient-text">Môj účet</h1>
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <>
          <Box title={data.user.name}>
            <p className="text-[11.5px] text-(--color-text-muted)">Roly: {data.user.roles.map((r) => r.name).join(", ") || "—"}</p>
          </Box>
          <LinkAccount account={data.user} onDone={reload} />
          <EmailBox account={data.user} mailConfigured={data.mailConfigured} setupWithoutPassword={data.setupWithoutPassword} />
          <PasswordBox account={data.user} />
          <Sessions />
        </>
      )}
    </section>
  );
}
