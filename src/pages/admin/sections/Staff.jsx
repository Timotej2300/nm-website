import { useState } from "react";
import { Badge, ConfirmDialog, ErrorBox, Field, Loading, Select, TextArea, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { Btn, Feedback, Panel, SectionTitle, Table, Td, useAction } from "../common";

const EMPTY = { minecraftName: "", minecraftUuid: "", categoryKey: "helper", title: "", bio: "", avatarUrl: "", discord: "", sortOrder: 100, visible: true };

function MemberForm({ member, categories, onDone, onCancel }) {
  const [f, setF] = useState(member ? { ...EMPTY, ...member, minecraftUuid: member.minecraftUuid || "", bio: member.bio || "", avatarUrl: member.avatarUrl || "", discord: member.discord || "" } : EMPTY);
  const { run, busy, error } = useAction();
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const save = async () => {
    const body = { minecraftName: f.minecraftName, minecraftUuid: f.minecraftUuid || null, categoryKey: f.categoryKey, title: f.title, bio: f.bio || null, avatarUrl: f.avatarUrl || null, discord: f.discord || null, sortOrder: Number(f.sortOrder) || 0, visible: f.visible };
    const r = await run(() => (member ? api.patch(`/admin/staff/${member.id}`, body) : api.post("/admin/staff", body)));
    if (r.ok) onDone();
  };
  return (
    <Panel title={member ? `Upraviť: ${member.minecraftName}` : "Pridať člena tímu"} tone="primary">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Minecraft nick"><TextInput value={f.minecraftName} onChange={(e) => set({ minecraftName: e.target.value })} maxLength={16} /></Field>
        <Field label="UUID (voliteľné)" hint="Ak je účet na webe prepojený, doplní sa samo."><TextInput value={f.minecraftUuid} onChange={(e) => set({ minecraftUuid: e.target.value })} /></Field>
        <Field label="Kategória"><Select value={f.categoryKey} onChange={(e) => set({ categoryKey: e.target.value })}>{categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
        <Field label="Zobrazovaný názov pozície"><TextInput value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} /></Field>
        <Field label="Discord (verejný kontakt)"><TextInput value={f.discord} onChange={(e) => set({ discord: e.target.value })} maxLength={64} /></Field>
        <Field label="Poradie"><TextInput type="number" value={f.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} /></Field>
        <Field label="Profilový obrázok (https://… alebo prázdne = Minecraft skin)" className="sm:col-span-2"><TextInput value={f.avatarUrl} onChange={(e) => set({ avatarUrl: e.target.value })} /></Field>
        <Field label="Popis" className="sm:col-span-2"><TextArea rows={3} value={f.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={400} /></Field>
      </div>
      <Toggle checked={f.visible} onChange={(v) => set({ visible: v })} label="Zverejnený na stránke Staff" />
      <Feedback error={error} />
      <div className="flex gap-2">
        <Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn>
        <Btn onClick={onCancel} disabled={busy}>Zrušiť</Btn>
      </div>
    </Panel>
  );
}

function Categories({ categories, onChanged }) {
  const [f, setF] = useState({ key: "", label: "", sortOrder: 100 });
  const [del, setDel] = useState(null);
  const { run, busy, error, message } = useAction();
  const add = async () => {
    const r = await run(() => api.post("/admin/staff/categories", { key: f.key, label: f.label, sortOrder: Number(f.sortOrder) || 0 }), "Kategória pridaná.");
    if (r.ok) { setF({ key: "", label: "", sortOrder: 100 }); onChanged(); }
  };
  const rename = async (c, label) => {
    const r = await run(() => api.patch(`/admin/staff/categories/${c.key}`, { label, sortOrder: c.sortOrder }), "Uložené.");
    if (r.ok) onChanged();
  };
  const remove = async () => {
    const c = del; setDel(null);
    const r = await run(() => api.del(`/admin/staff/categories/${c.key}`), "Kategória zmazaná.");
    if (r.ok) onChanged();
  };
  return (
    <Panel title="Kategórie tímu">
      <Table head={["Kľúč", "Názov", "Členov", ""]}>
        {categories.map((c) => (
          <tr key={c.key}>
            <Td>{c.key}</Td>
            <Td><TextInput defaultValue={c.label} onBlur={(e) => e.target.value !== c.label && rename(c, e.target.value)} className="max-w-56" /></Td>
            <Td>{c.members}</Td>
            <Td><Btn tone="danger" disabled={busy} onClick={() => setDel(c)}>Zmazať</Btn></Td>
          </tr>
        ))}
      </Table>
      <div className="grid items-end gap-3 sm:grid-cols-4">
        <Field label="Kľúč"><TextInput value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></Field>
        <Field label="Názov"><TextInput value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label="Poradie"><TextInput type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
        <Btn tone="primary" onClick={add} disabled={busy}>Pridať kategóriu</Btn>
      </div>
      <Feedback error={error} message={message} />
      <ConfirmDialog open={Boolean(del)} title="Zmazať kategóriu?" text={`Kategória „${del?.label}“ bude zmazaná (možné iba ak je prázdna).`} onConfirm={remove} onCancel={() => setDel(null)} />
    </Panel>
  );
}

export default function Staff() {
  const { data, error, loading, reload } = useApi("/admin/staff");
  const [editing, setEditing] = useState(null); // member | "new"
  const [del, setDel] = useState(null);
  const { run, busy, error: aerr, message } = useAction();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const remove = async () => {
    const m = del; setDel(null);
    const r = await run(() => api.del(`/admin/staff/${m.id}`), `Odstránený zo Staff: ${m.minecraftName} (účet a oprávnenia ostali).`);
    if (r.ok) reload();
  };
  const toggleVisible = async (m) => {
    const r = await run(() => api.patch(`/admin/staff/${m.id}`, { minecraftName: m.minecraftName, minecraftUuid: m.minecraftUuid, categoryKey: m.categoryKey, title: m.title, bio: m.bio, avatarUrl: m.avatarUrl, discord: m.discord, sortOrder: m.sortOrder, visible: !m.visible }), m.visible ? "Člen skrytý." : "Člen zverejnený.");
    if (r.ok) reload();
  };
  return (
    <div>
      <SectionTitle title="Staff Management"><Btn tone="primary" onClick={() => setEditing("new")}><span className="gold-gradient-text">Pridať člena</span></Btn></SectionTitle>
      <p className="mb-4 text-[11.5px] text-(--color-text-muted)">Verejná stránka Staff zobrazuje iba zverejnených členov. Odstránenie zo Staff nemaže účet ani oprávnenia. Členovia pridaní automaticky podľa verejnej roly majú zdroj „rola“.</p>
      <Feedback error={aerr} message={message} />
      {editing && <MemberForm key={editing === "new" ? "new" : editing.id} member={editing === "new" ? null : editing} categories={data.categories} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Panel>
        <Table head={["Nick", "Pozícia", "Kategória", "Zdroj", "Stav", ""]}>
          {data.members.map((m) => (
            <tr key={m.id}>
              <Td><span className="text-(--color-text)">{m.minecraftName}</span></Td>
              <Td>{m.title}</Td>
              <Td>{data.categories.find((c) => c.key === m.categoryKey)?.label || m.categoryKey}</Td>
              <Td><Badge tone={m.source === "role" ? "blue" : "neutral"}>{m.source === "role" ? "rola" : "manuálne"}</Badge></Td>
              <Td>{m.visible ? <Badge tone="green">zverejnený</Badge> : <Badge>skrytý</Badge>} {m.needsReview && <Badge tone="gold">na kontrolu</Badge>}</Td>
              <Td className="whitespace-nowrap">
                <Btn onClick={() => setEditing(m)}>Upraviť</Btn>{" "}
                <Btn disabled={busy} onClick={() => toggleVisible(m)}>{m.visible ? "Skryť" : "Zverejniť"}</Btn>{" "}
                <Btn tone="danger" disabled={busy} onClick={() => setDel(m)}>Odstrániť</Btn>
              </Td>
            </tr>
          ))}
        </Table>
        {data.members.length === 0 && <p className="text-center text-[11.5px] text-(--color-text-dim)">Zatiaľ žiadni členovia tímu.</p>}
      </Panel>
      <Categories categories={data.categories} onChanged={reload} />
      <ConfirmDialog open={Boolean(del)} title="Odstrániť zo Staff?" text={`${del?.minecraftName} zmizne zo stránky Staff. Jeho účet a oprávnenia sa nezmenia.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}
