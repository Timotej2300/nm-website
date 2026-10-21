import { useState } from "react";
import { Badge, ConfirmDialog, ErrorBox, Field, Loading, Notice, Select, TextArea, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { Btn, Feedback, Panel, SectionTitle, Table, Td, useAction } from "../common";

const GROUPS = {
  admin: "Administrácia", users: "Používatelia", staff: "Staff", tickets: "Tickety", pages: "Stránky",
  maintenance: "Údržba", news: "Novinky", store: "Obchod", votes: "Hlasovanie", settings: "Nastavenia", audit: "Audit", security: "Bezpečnosť",
};

function RoleForm({ role, isNew, catalog, staffCategories, onDone, onCancel }) {
  const readOnly = role.editable === false;
  const [f, setF] = useState({
    key: role.key || "",
    name: role.name || "",
    description: role.description || "",
    priority: role.priority ?? 100,
    permissions: new Set(role.permissions || []),
    isPublicStaff: Boolean(role.isPublicStaff),
    staffCategoryKey: role.staffCategoryKey || "",
    staffTitle: role.staffTitle || "",
    onRemove: role.onRemove || "hide",
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const { run, busy, error, message } = useAction();
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const toggle = (k) => {
    const n = new Set(f.permissions);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    set({ permissions: n });
  };
  const grouped = {};
  for (const k of Object.keys(catalog)) {
    if (k === "roles.manage") continue;
    (grouped[k.split(".")[0]] ||= []).push(k);
  }
  const body = () => ({
    name: f.name,
    description: f.description || null,
    priority: Number(f.priority),
    permissions: [...f.permissions].filter((p) => p !== "roles.manage"),
    isPublicStaff: f.isPublicStaff,
    staffCategoryKey: f.isPublicStaff ? f.staffCategoryKey || null : null,
    staffTitle: f.isPublicStaff ? f.staffTitle || null : null,
    onRemove: f.onRemove,
  });
  const save = async () => {
    const r = await run(() => (isNew ? api.post("/admin/roles", { key: f.key, ...body() }) : api.patch(`/admin/roles/${role.key}`, body())), "Rola uložená.");
    if (r.ok) onDone();
  };
  const remove = async () => {
    setConfirmDel(false);
    const r = await run(() => api.del(`/admin/roles/${role.key}`));
    if (r.ok) onDone();
  };
  return (
    <Panel title={isNew ? "Nová rola" : `Rola ${role.name}`} tone="primary">
      {readOnly && <Notice tone="warning">Rola Owner je len na čítanie. Vlastník vždy drží všetky oprávnenia.</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        {isNew && <Field label="Kľúč" hint="malé písmená, číslice a _"><TextInput value={f.key} onChange={(e) => set({ key: e.target.value })} maxLength={31} /></Field>}
        <Field label="Názov"><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} disabled={readOnly} maxLength={60} /></Field>
        <Field label="Priorita" hint="Vyššia = mocnejšia. Systémovým rolám sa nemení."><TextInput type="number" min={0} max={999} value={f.priority} onChange={(e) => set({ priority: e.target.value })} disabled={readOnly || role.isSystem} /></Field>
        <Field label="Popis"><TextArea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} disabled={readOnly} maxLength={255} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(grouped).map(([g, keys]) => (
          <div key={g} className="flex flex-col gap-1.5">
            <h4 className="text-[10.5px] tracking-[0.08em] text-(--color-primary) uppercase">{GROUPS[g] || g}</h4>
            {keys.map((k) => (
              <Toggle key={k} checked={f.permissions.has(k)} disabled={readOnly || busy} onChange={() => toggle(k)} label={<span title={k}>{catalog[k]}</span>} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
        <Toggle checked={f.isPublicStaff} disabled={readOnly} onChange={(v) => set({ isPublicStaff: v })} label="Verejná staff rola (držitelia sa automaticky zobrazia na stránke Staff)" />
        {f.isPublicStaff && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Kategória Staff">
              <Select value={f.staffCategoryKey} onChange={(e) => set({ staffCategoryKey: e.target.value })} disabled={readOnly}>
                <option value="">—</option>
                {staffCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Zobrazený názov pozície"><TextInput value={f.staffTitle} onChange={(e) => set({ staffTitle: e.target.value })} disabled={readOnly} maxLength={80} /></Field>
            <Field label="Po odobratí roly">
              <Select value={f.onRemove} onChange={(e) => set({ onRemove: e.target.value })} disabled={readOnly}>
                <option value="hide">Skryť profil</option>
                <option value="review">Označiť na kontrolu</option>
              </Select>
            </Field>
          </div>
        )}
      </div>
      <Feedback error={error} message={message} />
      <div className="flex flex-wrap gap-2">
        {!readOnly && <Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn>}
        {!isNew && !role.isSystem && !readOnly && <Btn tone="danger" onClick={() => setConfirmDel(true)} disabled={busy}>Zmazať rolu</Btn>}
        <Btn onClick={onCancel}>Zavrieť</Btn>
      </div>
      <ConfirmDialog open={confirmDel} title="Zmazať rolu?" text={`Rola ${role.name} bude odobraná všetkým (${role.users}) používateľom. Ich účty sa nezmažú.`} confirmLabel="Zmazať" onConfirm={remove} onCancel={() => setConfirmDel(false)} />
    </Panel>
  );
}

export default function Roles() {
  const { data, error, loading, reload } = useApi("/admin/roles");
  const [edit, setEdit] = useState(null); // role key | "__new"
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const role = edit && edit !== "__new" ? data.roles.find((r) => r.key === edit) : null;
  const done = () => { setEdit(null); reload(); };
  return (
    <div>
      <SectionTitle title="Roly a oprávnenia">
        {data.canManage && <Btn tone="primary" onClick={() => setEdit("__new")}><span className="gold-gradient-text">Nová rola</span></Btn>}
      </SectionTitle>
      {!data.canManage && <div className="mb-4"><Notice tone="info">Roly môže upravovať iba vlastník (oprávnenie roles.manage). Zobrazenie je na čítanie.</Notice></div>}
      <Panel>
        <Table head={["Rola", "Priorita", "Oprávnenia", "Používatelia", "Staff", ""]}>
          {data.roles.map((r) => (
            <tr key={r.key}>
              <Td><span className="text-(--color-text)">{r.name}</span> {r.isSystem && <Badge>systém</Badge>}</Td>
              <Td>{r.priority}</Td>
              <Td>{r.permissions.length}</Td>
              <Td>{r.users}</Td>
              <Td>{r.isPublicStaff ? <Badge tone="gold">{r.staffTitle || "verejná"}</Badge> : "—"}</Td>
              <Td><Btn onClick={() => setEdit(r.key)}>{data.canManage && r.editable ? "Upraviť" : "Zobraziť"}</Btn></Td>
            </tr>
          ))}
        </Table>
      </Panel>
      {edit === "__new" && <RoleForm key="new" isNew role={{}} catalog={data.permissionCatalog} staffCategories={data.staffCategories} onDone={done} onCancel={() => setEdit(null)} />}
      {role && <RoleForm key={role.key} role={data.canManage ? role : { ...role, editable: false }} catalog={data.permissionCatalog} staffCategories={data.staffCategories} onDone={done} onCancel={() => setEdit(null)} />}
    </div>
  );
}
