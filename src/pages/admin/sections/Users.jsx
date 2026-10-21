import { useState } from "react";
import { Badge, ConfirmDialog, EmptyState, ErrorBox, Field, Loading, Select, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { useAuth } from "../../../context/useAuth";
import { Btn, Feedback, Pager, Panel, SectionTitle, Table, Td, qs, useAction } from "../common";

function RoleEditor({ user, allRoles, onSaved }) {
  const [sel, setSel] = useState(() => new Set(user.roles.map((r) => r.key)));
  const { run, busy, error, message } = useAction();
  const toggle = (k) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const save = async () => {
    const r = await run(() => api.put(`/admin/users/${user.id}/roles`, { roles: [...sel].filter((k) => k !== "user" && k !== "owner") }), "Roly uložené.");
    if (r.ok) onSaved();
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {allRoles.map((r) => (
          <Toggle
            key={r.key}
            checked={sel.has(r.key)}
            disabled={r.key === "owner" || r.key === "user" || busy}
            onChange={() => toggle(r.key)}
            label={`${r.name} (${r.priority})`}
          />
        ))}
      </div>
      <p className="text-[10.5px] text-(--color-text-dim)">Rola Owner sa nedá prideliť ani odobrať cez web. Meniť môžete iba roly nižšie než vaša.</p>
      <Feedback error={error} message={message} />
      <div>
        <Btn tone="primary" onClick={save} disabled={busy}>
          <span className="gold-gradient-text">Uložiť roly</span>
        </Btn>
      </div>
    </div>
  );
}

function UserDetail({ id, allRoles, canManage, onChanged }) {
  const { data, error, loading, reload } = useApi(`/admin/users/${id}`);
  const [confirm, setConfirm] = useState(null);
  const { run, busy, error: aerr, message } = useAction();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const u = data.user;
  const doConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    const r = await run(
      () => (c === "revoke" ? api.post(`/admin/users/${id}/revoke-sessions`) : api.post(`/admin/users/${id}/status`, { status: c })),
      c === "revoke" ? "Relácie zneplatnené." : c === "suspended" ? "Účet pozastavený." : "Účet obnovený.",
    );
    if (r.ok) {
      reload();
      onChanged();
    }
  };
  return (
    <Panel title={`Používateľ ${u.name}`} tone="primary">
      <div className="grid gap-2 text-[11.5px] text-(--color-text-muted) sm:grid-cols-2">
        <span>UUID: <span className="text-(--color-text)">{u.uuid || "—"}</span></span>
        <span>Prepojenie: {u.linked ? <Badge tone="green">prepojený</Badge> : <Badge>neprepojený</Badge>}</span>
        <span>E-mail: {u.emailVerified ? <Badge tone="green">overený</Badge> : <Badge>neoverený</Badge>}</span>
        <span>Stav: <Badge tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "aktívny" : "pozastavený"}</Badge></span>
        <span>Vytvorený: {formatDateTime(u.createdAt)}</span>
        <span>Posledné prihlásenie: {formatDateTime(u.lastLoginAt)}</span>
        <span>Aktívne relácie: {u.activeSessions}</span>
      </div>
      <Feedback error={aerr} message={message} />
      {canManage && (
        <>
          <div className="flex flex-wrap gap-2">
            {u.status === "active" ? (
              <Btn tone="danger" disabled={busy} onClick={() => setConfirm("suspended")}>Pozastaviť účet</Btn>
            ) : (
              <Btn tone="success" disabled={busy} onClick={() => setConfirm("active")}>Obnoviť účet</Btn>
            )}
            <Btn disabled={busy} onClick={() => setConfirm("revoke")}>Zneplatniť relácie</Btn>
          </div>
          <RoleEditor key={u.roles.map((r) => r.key).join()} user={u} allRoles={allRoles} onSaved={() => { reload(); onChanged(); }} />
        </>
      )}
      {!canManage && <p className="text-[11.5px] text-(--color-text-muted)">Roly: {u.roles.map((r) => r.name).join(", ")}</p>}
      <div>
        <h3 className="mb-2 text-[11px] tracking-[0.08em] text-(--color-text-dim) uppercase">Bezpečnostné udalosti</h3>
        {data.events.length === 0 ? (
          <p className="text-[11.5px] text-(--color-text-dim)">Žiadne udalosti (alebo nemáte oprávnenie audit.view).</p>
        ) : (
          data.events.map((e, i) => (
            <div key={i} className="flex justify-between gap-3 border-t border-white/5 py-1.5 text-[11px] text-(--color-text-muted)">
              <span>{e.summary || e.action}</span>
              <span className="shrink-0 text-(--color-text-dim)">{formatDateTime(e.createdAt)}</span>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === "revoke" ? "Zneplatniť relácie?" : confirm === "suspended" ? "Pozastaviť účet?" : "Obnoviť účet?"}
        text={confirm === "suspended" ? "Používateľ bude okamžite odhlásený, nebude sa môcť prihlásiť a jeho tickety sa uvoľnia." : confirm === "revoke" ? "Používateľ bude odhlásený zo všetkých zariadení." : "Používateľ sa bude môcť opäť prihlásiť."}
        tone={confirm === "active" ? "success" : "danger"}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Panel>
  );
}

export default function Users() {
  const { can } = useAuth();
  const [f, setF] = useState({ q: "", role: "", status: "", page: 1 });
  const [selected, setSelected] = useState(null);
  const list = useApi(`/admin/users${qs({ ...f, size: 20 })}`);
  const roles = useApi("/admin/roles");
  const allRoles = roles.data?.roles || [];
  const set = (patch) => setF((s) => ({ ...s, page: 1, ...patch }));
  return (
    <div>
      <SectionTitle title="Používatelia" />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Hľadať (nick / UUID)"><TextInput value={f.q} onChange={(e) => set({ q: e.target.value })} maxLength={32} /></Field>
          <Field label="Rola">
            <Select value={f.role} onChange={(e) => set({ role: e.target.value })}>
              <option value="">Všetky</option>
              {allRoles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Stav">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">Všetky</option>
              <option value="active">Aktívni</option>
              <option value="suspended">Pozastavení</option>
            </Select>
          </Field>
        </div>
        {list.loading && <Loading />}
        {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && <EmptyState title="Žiadni používatelia" text="Pre zadaný filter sa nič nenašlo." />}
        {list.data && list.data.items.length > 0 && (
          <>
            <Table head={["Nick", "UUID", "Prepojenie", "E-mail", "Roly", "Stav", "Vytvorený", ""]}>
              {list.data.items.map((u) => (
                <tr key={u.id}>
                  <Td><span className="text-(--color-text)">{u.name}</span></Td>
                  <Td className="max-w-40 truncate">{u.uuid || "—"}</Td>
                  <Td>{u.linked ? <Badge tone="green">áno</Badge> : <Badge>nie</Badge>}</Td>
                  <Td>{u.emailVerified ? <Badge tone="green">overený</Badge> : <Badge>—</Badge>}</Td>
                  <Td>{u.roles.filter((r) => r.key !== "user").map((r) => r.name).join(", ") || "—"}</Td>
                  <Td><Badge tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "aktívny" : "pozastavený"}</Badge></Td>
                  <Td>{formatDateTime(u.createdAt)}</Td>
                  <Td><Btn onClick={() => setSelected(u.id)}>Detail</Btn></Td>
                </tr>
              ))}
            </Table>
            <Pager page={list.data.page} size={list.data.size} total={list.data.total} onPage={(page) => setF((s) => ({ ...s, page }))} />
          </>
        )}
      </Panel>
      {selected && <UserDetail key={selected} id={selected} allRoles={allRoles} canManage={can("users.manage")} onChanged={list.reload} />}
    </div>
  );
}
