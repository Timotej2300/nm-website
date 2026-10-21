import { useEffect, useState } from "react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { Badge, EmptyState, ErrorBox, Field, Loading, Notice, Select, TextArea, TextInput } from "../components/ui/Form";
import { useApi } from "../hooks/useApi";
import { useSeo } from "../hooks/useSeo";
import { api, errorMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";

const STATUS = { OPEN: "Otvorený", IN_PROGRESS: "Rieši sa", WAITING_FOR_PLAYER: "Čaká na vás", WAITING_FOR_STAFF: "Čaká na tím", RESOLVED: "Vyriešený", CLOSED: "Uzavretý" };
const TONE = { OPEN: "blue", IN_PROGRESS: "gold", WAITING_FOR_PLAYER: "pink", WAITING_FOR_STAFF: "gold", RESOLVED: "green", CLOSED: "neutral" };
const PRIO = { low: "Nízka", normal: "Normálna", high: "Vysoká" };

function NewTicket({ onCreated, onCancel }) {
  const { data, error, loading } = useApi("/tickets/categories");
  const [f, setF] = useState({ category: "", subject: "", body: "", priority: "normal", who: "any", staffId: "" });
  const [staff, setStaff] = useState([]);
  const [state, setState] = useState({ busy: false, error: null });

  useEffect(() => {
    if (!f.category) return;
    let alive = true;
    api.get(`/tickets/staff-options?category=${encodeURIComponent(f.category)}`).then((r) => alive && setStaff(r.staff)).catch(() => alive && setStaff([]));
    return () => { alive = false; };
  }, [f.category]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: null });
    try {
      const r = await api.post("/tickets", {
        subject: f.subject, category: f.category, body: f.body,
        ...(data.playerPriority ? { priority: f.priority } : {}),
        requestedStaffUserId: f.who === "pick" && f.staffId ? Number(f.staffId) : null,
      });
      onCreated(r.id);
    } catch (err) {
      setState({ busy: false, error: errorMessage(err) });
    }
  };
  const set = (p) => setF((s) => ({ ...s, ...p }));
  return (
    <PixelBox tone="primary" className="mb-6" header={<span className="gradient-text uppercase">Nový ticket</span>} contentClassName="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Kategória">
          <Select value={f.category} onChange={(e) => set({ category: e.target.value, staffId: "", who: "any" })} required>
            <option value="">— vyberte —</option>
            {data.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Komu je ticket určený?">
          <Select value={f.who} onChange={(e) => set({ who: e.target.value })} disabled={!f.category}>
            <option value="any">Ktokoľvek z tímu</option>
            <option value="pick" disabled={staff.length === 0}>Konkrétny člen tímu{staff.length === 0 && f.category ? " (nikto nie je dostupný)" : ""}</option>
          </Select>
        </Field>
        {f.who === "pick" && (
          <Field label="Člen tímu">
            <Select value={f.staffId} onChange={(e) => set({ staffId: e.target.value })} required>
              <option value="">— vyberte —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.title ? ` (${s.title})` : ""}</option>)}
            </Select>
          </Field>
        )}
        {data.playerPriority && (
          <Field label="Priorita"><Select value={f.priority} onChange={(e) => set({ priority: e.target.value })}>{Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        )}
        <Field label="Predmet"><TextInput value={f.subject} onChange={(e) => set({ subject: e.target.value })} maxLength={150} required /></Field>
        <Field label="Opis problému"><TextArea rows={6} value={f.body} onChange={(e) => set({ body: e.target.value })} maxLength={5000} required /></Field>
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        <div className="flex gap-2">
          <PixelButton type="submit" tone="primary" size="sm" disabled={state.busy || !f.category || !f.subject.trim() || !f.body.trim()}><span className="gold-gradient-text">{state.busy ? "Odosielam…" : "Vytvoriť ticket"}</span></PixelButton>
          <PixelButton type="button" size="sm" onClick={onCancel}>Zrušiť</PixelButton>
        </div>
      </form>
    </PixelBox>
  );
}

function Conversation({ id, onBack }) {
  const { data, error, loading, reload } = useApi(`/tickets/${id}`);
  const [reply, setReply] = useState("");
  const [state, setState] = useState({ busy: false, error: null });
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const t = data.ticket;
  const act = async (fn, after) => {
    setState({ busy: true, error: null });
    try { await fn(); after?.(); setState({ busy: false, error: null }); reload(); } catch (e) { setState({ busy: false, error: errorMessage(e) }); }
  };
  return (
    <div>
      <PixelButton size="sm" onClick={onBack} className="mb-4">← Moje tickety</PixelButton>
      <PixelBox tone="neutral" className="mb-5" contentClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] gold-gradient-text">#{t.id} {t.subject}</h2>
          <Badge tone={TONE[t.status]}>{STATUS[t.status]}</Badge>
        </div>
        <p className="text-[11px] text-(--color-text-muted)">Kategória: {t.category} · Rieši: {t.assignedTo || (t.requestedStaff ? "čaká sa na vybraného člena" : "zatiaľ nikto — ktokoľvek z tímu")} · Vytvorený {formatDateTime(t.createdAt)}</p>
      </PixelBox>
      <div className="flex flex-col gap-3">
        {t.messages.map((m) => (
          <div key={m.id} className={`rounded-sm p-3 text-[12px] ${m.authorType === "staff" ? "bg-(--color-primary)/10" : "bg-white/5"}`}>
            <div className="mb-1 text-[10.5px] text-(--color-text-dim)">{m.authorType === "staff" ? `${m.authorName || "Tím"} (tím)` : m.authorType === "player" ? "Vy" : "Systém"} · {formatDateTime(m.createdAt)}</div>
            <p className="whitespace-pre-wrap text-(--color-text)">{m.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {t.canReply && (
          <>
            <TextArea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} placeholder="Vaša odpoveď…" />
            <div className="flex gap-2">
              <PixelButton tone="primary" size="sm" disabled={state.busy || !reply.trim()} onClick={() => act(() => api.post(`/tickets/${id}/reply`, { body: reply }), () => setReply(""))}><span className="gold-gradient-text">Odoslať</span></PixelButton>
              {t.canClose && <PixelButton size="sm" disabled={state.busy} onClick={() => act(() => api.post(`/tickets/${id}/close`))}>Uzavrieť ticket</PixelButton>}
            </div>
          </>
        )}
        {t.canReopen && <div><PixelButton size="sm" disabled={state.busy} onClick={() => act(() => api.post(`/tickets/${id}/reopen`))}>Znovu otvoriť</PixelButton></div>}
        {!t.canReply && !t.canReopen && <p className="text-[11px] text-(--color-text-dim)">Ticket je uzavretý.</p>}
        {state.error && <Notice tone="danger">{state.error}</Notice>}
      </div>
    </div>
  );
}

export default function Tickets() {
  useSeo({ title: "Tickety", path: "/tickets", noindex: true });
  const { data, error, loading, reload } = useApi("/tickets");
  const notes = useApi("/notifications");
  const [view, setView] = useState({ mode: "list" }); // list | new | ticket

  const markRead = async () => { try { await api.post("/notifications/read", {}); } catch { /* ignore */ } notes.reload(); };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] gold-gradient-text">Tickety</h1>
        {view.mode === "list" && <PixelButton tone="primary" size="sm" onClick={() => setView({ mode: "new" })}><span className="gold-gradient-text">Nový ticket</span></PixelButton>}
      </div>

      {view.mode === "new" && <NewTicket onCancel={() => setView({ mode: "list" })} onCreated={(id) => { reload(); setView({ mode: "ticket", id }); }} />}
      {view.mode === "ticket" && <Conversation id={view.id} onBack={() => { reload(); notes.reload(); setView({ mode: "list" }); }} />}

      {view.mode === "list" && (
        <>
          {notes.data?.unread > 0 && (
            <PixelBox tone="primary" className="mb-5" contentClassName="flex flex-col gap-2">
              <div className="flex items-center justify-between"><span className="text-[12px] text-(--color-text)">Nové oznámenia ({notes.data.unread})</span><PixelButton size="sm" onClick={markRead}>Označiť ako prečítané</PixelButton></div>
              {notes.data.items.filter((n) => !n.readAt).map((n) => (
                <button key={n.id} type="button" className="text-left text-[11.5px] text-(--color-text-muted) hover:text-(--color-text)" onClick={() => setView({ mode: "ticket", id: n.ticketId })}>• {n.message}</button>
              ))}
            </PixelBox>
          )}
          {loading && <Loading />}
          {error && <ErrorBox message={error} onRetry={reload} />}
          {data && data.tickets.length === 0 && <EmptyState title="Zatiaľ nemáte žiadne tickety" text="Ak potrebujete pomoc od tímu, vytvorte nový ticket." />}
          {data && data.tickets.length > 0 && (
            <div className="flex flex-col gap-3">
              {data.tickets.map((t) => (
                <button key={t.id} type="button" onClick={() => setView({ mode: "ticket", id: t.id })} className="text-left">
                  <PixelBox tone="neutral" contentClassName="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] text-(--color-text)">#{t.id} {t.subject}</div>
                      <div className="mt-1 text-[10.5px] text-(--color-text-dim)">{t.category} · {t.assignedTo ? `rieši ${t.assignedTo}` : "nepriradený"} · {formatDateTime(t.lastReplyAt || t.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">{t.unread > 0 && <Badge tone="pink">{t.unread} nové</Badge>}<Badge tone={TONE[t.status]}>{STATUS[t.status]}</Badge></div>
                  </PixelBox>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
