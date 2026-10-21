import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, EmptyState, ErrorBox, Field, Loading, Select, TextArea, TextInput, Toggle, ConfirmDialog } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { useAuth } from "../../../context/useAuth";
import { Btn, Feedback, Pager, Panel, SectionTitle, Table, Td, qs, useAction } from "../common";

export const STATUS_LABEL = { OPEN: "Otvorený", IN_PROGRESS: "Rieši sa", WAITING_FOR_PLAYER: "Čaká na hráča", WAITING_FOR_STAFF: "Čaká na tím", RESOLVED: "Vyriešený", CLOSED: "Uzavretý" };
const STATUS_TONE = { OPEN: "blue", IN_PROGRESS: "gold", WAITING_FOR_PLAYER: "pink", WAITING_FOR_STAFF: "gold", RESOLVED: "green", CLOSED: "neutral" };
const PRIORITY = { low: "nízka", normal: "normálna", high: "vysoká" };
export const StatusBadge = ({ s }) => <Badge tone={STATUS_TONE[s] || "neutral"}>{STATUS_LABEL[s] || s}</Badge>;

/* ───────── queue ───────── */
export function TicketQueue() {
  const [f, setF] = useState({ status: "active", category: "", assignee: "", priority: "", q: "", page: 1 });
  const { data, error, loading, reload } = useApi(`/admin/tickets${qs({ ...f, size: 25 })}`);
  const set = (p) => setF((s) => ({ ...s, page: 1, ...p }));
  return (
    <div>
      <SectionTitle title="Tickets Management">
        <Link to="/admin/ticket-categories"><Btn>Kategórie</Btn></Link>
      </SectionTitle>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Stav">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="active">Aktívne</option>
              <option value="">Všetky</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Kategória">
            <Select value={f.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Všetky</option>
              {(data?.categories || []).map((c) => <option key={c.cat_key || c.key} value={c.cat_key || c.key}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Priradenie">
            <Select value={f.assignee} onChange={(e) => set({ assignee: e.target.value })}>
              <option value="">Všetky</option>
              <option value="me">Moje</option>
              <option value="none">Nepriradené</option>
            </Select>
          </Field>
          <Field label="Priorita">
            <Select value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="">Všetky</option>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Hľadať (#ID, predmet, hráč)"><TextInput value={f.q} onChange={(e) => set({ q: e.target.value })} /></Field>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {data && data.items.length === 0 && <EmptyState title="Žiadne tickety" text="Pre zvolený filter tu nič nie je." />}
        {data && data.items.length > 0 && (
          <>
            <Table head={["#", "Predmet", "Hráč", "Kategória", "Stav", "Priorita", "Rieši", "Aktualizovaný"]}>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <Td>{t.id}</Td>
                  <Td><Link className="text-(--color-text) hover:underline" to={`/admin/tickets/${t.id}`}>{t.subject}</Link></Td>
                  <Td>{t.player}</Td>
                  <Td>{t.category}</Td>
                  <Td><StatusBadge s={t.status} /></Td>
                  <Td>{PRIORITY[t.priority] || t.priority}</Td>
                  <Td>{t.assignedTo || <span className="text-(--color-text-dim)">nikto</span>}</Td>
                  <Td className="whitespace-nowrap">{formatDateTime(t.updatedAt)}</Td>
                </tr>
              ))}
            </Table>
            <Pager page={data.page} size={data.size} total={data.total} onPage={(page) => setF((s) => ({ ...s, page }))} />
          </>
        )}
      </Panel>
    </div>
  );
}

/* ───────── detail ───────── */
export function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(`/admin/tickets/${id}`);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const { run, busy, error: aerr, message } = useAction();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const t = data.ticket;
  const ab = t.abilities;
  const act = async (fn, ok) => { const r = await run(fn, ok); if (r.ok) reload(); return r; };
  const sendReply = async () => { const r = await act(() => api.post(`/admin/tickets/${id}/reply`, { body: reply }), "Odpoveď odoslaná."); if (r.ok) setReply(""); };
  const sendNote = async () => { const r = await act(() => api.post(`/admin/tickets/${id}/note`, { body: note }), "Interná poznámka uložená."); if (r.ok) setNote(""); };
  return (
    <div>
      <SectionTitle title={`Ticket #${t.id}: ${t.subject}`}><Link to="/admin/tickets"><Btn>← Späť</Btn></Link></SectionTitle>
      <Feedback error={aerr} message={message} />
      <Panel>
        <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-(--color-text-muted)">
          <StatusBadge s={t.status} />
          <span>Hráč: <b className="text-(--color-text)">{t.player.name}</b></span>
          <span>Kategória: {t.category}</span>
          <span>Priorita: {PRIORITY[t.priority] || t.priority}</span>
          <span>Rieši: {t.assignedTo ? t.assignedTo.name : "nikto"}</span>
          <span>Vytvorený: {formatDateTime(t.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {ab.claim && <Btn tone="primary" disabled={busy} onClick={() => act(() => api.post(`/admin/tickets/${id}/claim`, {}), "Ticket prevzatý.")}>Prevziať</Btn>}
          {ab.changeStatus && (
            <Field label="Zmeniť stav">
              <Select value={t.status} disabled={busy} onChange={(e) => act(() => api.post(`/admin/tickets/${id}/status`, { status: e.target.value }), "Stav zmenený.")}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          )}
          {ab.assign && (
            <div className="flex items-end gap-2">
              <Field label="Priradiť">
                <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">— vyberte —</option>
                  <option value="none">Zrušiť priradenie</option>
                  {t.handlers.map((h) => <option key={h.id} value={h.id}>{h.name}{h.title ? ` (${h.title})` : ""}</option>)}
                </Select>
              </Field>
              <Btn disabled={busy || !assignTo} onClick={() => act(() => api.post(`/admin/tickets/${id}/assign`, { userId: assignTo === "none" ? null : Number(assignTo) }), "Priradenie uložené.")}>Uložiť</Btn>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Konverzácia">
        {t.messages.map((m) => (
          <div key={m.id} className={`rounded-sm p-3 text-[12px] ${m.authorType === "staff" ? "bg-(--color-primary)/10" : m.authorType === "system" ? "bg-white/5 italic" : "bg-white/5"}`}>
            <div className="mb-1 text-[10.5px] text-(--color-text-dim)">{m.authorName || "systém"} · {m.authorType === "staff" ? "tím" : m.authorType === "player" ? "hráč" : "systém"} · {formatDateTime(m.createdAt)}</div>
            <p className="whitespace-pre-wrap text-(--color-text)">{m.body}</p>
          </div>
        ))}
        {ab.reply ? (
          <>
            <TextArea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} placeholder="Odpoveď hráčovi (hráč ju uvidí)…" />
            <div><Btn tone="primary" disabled={busy || !reply.trim()} onClick={sendReply}><span className="gold-gradient-text">Odoslať odpoveď</span></Btn></div>
          </>
        ) : (
          <p className="text-[11px] text-(--color-text-dim)">Na tento ticket nemôžete odpovedať (je uzavretý, patrí inému členovi tímu alebo nemáte oprávnenie).</p>
        )}
      </Panel>

      {ab.notes && (
        <Panel title="Interné poznámky (hráč ich nevidí)" tone="warning">
          {t.notes.length === 0 && <p className="text-[11.5px] text-(--color-text-dim)">Zatiaľ žiadne poznámky.</p>}
          {t.notes.map((n) => (
            <div key={n.id} className="rounded-sm bg-white/5 p-3 text-[12px]">
              <div className="mb-1 text-[10.5px] text-(--color-text-dim)">{n.authorName} · {formatDateTime(n.createdAt)}</div>
              <p className="whitespace-pre-wrap text-(--color-text)">{n.body}</p>
            </div>
          ))}
          <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} placeholder="Interná poznámka…" />
          <div><Btn disabled={busy || !note.trim()} onClick={sendNote}>Pridať poznámku</Btn></div>
        </Panel>
      )}

      <Panel title="História">
        <Table head={["Čas", "Zmena", "Kto"]}>
          {t.history.map((h, i) => (
            <tr key={`s${i}`}><Td className="whitespace-nowrap">{formatDateTime(h.createdAt)}</Td><Td>Stav: {h.fromStatus ? `${STATUS_LABEL[h.fromStatus] || h.fromStatus} → ` : ""}{STATUS_LABEL[h.toStatus] || h.toStatus}</Td><Td>{h.changedBy || "systém"}</Td></tr>
          ))}
          {t.assignments.map((a, i) => (
            <tr key={`a${i}`}><Td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</Td><Td>Priradenie: {a.fromName || "nikto"} → {a.toName || "nikto"}{a.reason ? ` (${a.reason})` : ""}</Td><Td>{a.changedBy || "systém"}</Td></tr>
          ))}
        </Table>
      </Panel>
      <span className="hidden">{user?.name}</span>
    </div>
  );
}

/* ───────── categories ───────── */
function CategoryForm({ cat, roles, onDone, onCancel }) {
  const [f, setF] = useState(cat ? { key: cat.cat_key || cat.key, label: cat.label, description: cat.description || "", sortOrder: cat.sort_order ?? cat.sortOrder ?? 100, enabled: cat.enabled, roles: cat.roles } : { key: "", label: "", description: "", sortOrder: 100, enabled: true, roles: [] });
  const { run, busy, error } = useAction();
  const toggleRole = (k) => setF((s) => ({ ...s, roles: s.roles.includes(k) ? s.roles.filter((x) => x !== k) : [...s.roles, k] }));
  const save = async () => {
    const body = { label: f.label, description: f.description || null, sortOrder: Number(f.sortOrder) || 0, enabled: f.enabled, roles: f.roles };
    const r = await run(() => (cat ? api.patch(`/admin/ticket-categories/${cat.id}`, body) : api.post("/admin/ticket-categories", { ...body, key: f.key })));
    if (r.ok) onDone();
  };
  return (
    <Panel title={cat ? "Upraviť kategóriu" : "Nová kategória"} tone="primary">
      <div className="grid gap-3 sm:grid-cols-2">
        {!cat && <Field label="Kľúč" hint="malé písmená, číslice, _"><TextInput value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></Field>}
        <Field label="Názov"><TextInput value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} maxLength={80} /></Field>
        <Field label="Poradie"><TextInput type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
        <Field label="Popis" className="sm:col-span-2"><TextInput value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={255} /></Field>
      </div>
      <div>
        <p className="mb-2 text-[10.5px] tracking-[0.06em] text-(--color-text-muted) uppercase">Roly, ktoré riešia túto kategóriu</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">{roles.map((r) => <Toggle key={r.key} checked={f.roles.includes(r.key)} onChange={() => toggleRole(r.key)} label={r.name} />)}</div>
      </div>
      <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Kategória je zapnutá (hráči ju môžu vybrať)" />
      <Feedback error={error} />
      <div className="flex gap-2"><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn><Btn onClick={onCancel}>Zrušiť</Btn></div>
    </Panel>
  );
}

export function TicketCategories() {
  const { data, error, loading, reload } = useApi("/admin/ticket-categories");
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const { run, busy, error: aerr, message } = useAction();
  const nav = useNavigate();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const remove = async () => {
    const c = del; setDel(null);
    const r = await run(() => api.del(`/admin/ticket-categories/${c.id}`), "Kategória zmazaná.");
    if (r.ok) reload();
  };
  return (
    <div>
      <SectionTitle title="Kategórie ticketov">
        <Btn onClick={() => nav("/admin/tickets")}>← Tickety</Btn>
        <Btn tone="primary" onClick={() => setEditing("new")}><span className="gold-gradient-text">Nová kategória</span></Btn>
      </SectionTitle>
      <Feedback error={aerr} message={message} />
      {editing && <CategoryForm key={editing === "new" ? "n" : editing.id} cat={editing === "new" ? null : editing} roles={data.roles} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Panel>
        <Table head={["Názov", "Roly", "Tickety", "Stav", ""]}>
          {data.categories.map((c) => (
            <tr key={c.id}>
              <Td><span className="text-(--color-text)">{c.label}</span><br /><span className="text-[10px] text-(--color-text-dim)">{c.cat_key || c.key}</span></Td>
              <Td>{c.roles.length ? c.roles.map((r) => data.roles.find((x) => x.key === r)?.name || r).join(", ") : <span className="text-(--color-text-dim)">len vedenie</span>}</Td>
              <Td>{c.tickets}</Td>
              <Td>{c.enabled ? <Badge tone="green">zapnutá</Badge> : <Badge>vypnutá</Badge>}</Td>
              <Td className="whitespace-nowrap"><Btn onClick={() => setEditing(c)}>Upraviť</Btn> <Btn tone="danger" disabled={busy} onClick={() => setDel(c)}>Zmazať</Btn></Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <ConfirmDialog open={Boolean(del)} title="Zmazať kategóriu?" text="Možné iba ak v kategórii nie sú žiadne tickety; inak ju vypnite." onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}
