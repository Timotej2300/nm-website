import { useState } from "react";
import { Badge, ConfirmDialog, ErrorBox, Field, Loading, Notice, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { Btn, Feedback, Panel, SectionTitle, Table, Td, useAction } from "../common";

function SiteForm({ site, onDone, onCancel }) {
  const [f, setF] = useState(site ? { ...site } : { key: "", name: "", href: "https://", enabled: true, sortOrder: 100 });
  const { run, busy, error } = useAction();
  const save = async () => {
    const body = { name: f.name, href: f.href, enabled: f.enabled, sortOrder: Number(f.sortOrder) || 0 };
    const r = await run(() => (site ? api.patch(`/admin/votes/sites/${site.key}`, body) : api.post("/admin/votes/sites", { ...body, key: f.key })));
    if (r.ok) onDone();
  };
  return (
    <Panel title={site ? `Upraviť: ${site.name}` : "Nová hlasovacia služba"} tone="primary">
      <div className="grid gap-3 sm:grid-cols-2">
        {!site && <Field label="Kľúč"><TextInput value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></Field>}
        <Field label="Názov"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Odkaz (https://…)"><TextInput value={f.href} onChange={(e) => setF({ ...f, href: e.target.value })} /></Field>
        <Field label="Poradie"><TextInput type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      </div>
      <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Zobrazená na stránke Vote" />
      <Feedback error={error} />
      <div className="flex gap-2"><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn><Btn onClick={onCancel}>Zrušiť</Btn></div>
    </Panel>
  );
}

function Rewards({ initial, onSaved }) {
  const [rows, setRows] = useState(initial.rewards.map((r) => ({ ...r })));
  const [goal, setGoal] = useState(initial.weeklyGoal);
  const { run, busy, error, message } = useAction();
  const upd = (i, p) => setRows((s) => s.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const save = async () => {
    const r = await run(() => api.put("/admin/votes/rewards", { rewards: rows.map((x) => ({ votes: Number(x.votes), label: x.label, reward: x.reward })), weeklyGoal: Number(goal) || 0 }), "Uložené.");
    if (r.ok) onSaved();
  };
  return (
    <Panel title="Odmeny a týždenný cieľ">
      {rows.map((r, i) => (
        <div key={i} className="grid items-end gap-3 sm:grid-cols-[100px_1fr_2fr_auto]">
          <Field label="Hlasov"><TextInput type="number" min="1" value={r.votes} onChange={(e) => upd(i, { votes: e.target.value })} /></Field>
          <Field label="Názov"><TextInput value={r.label} onChange={(e) => upd(i, { label: e.target.value })} /></Field>
          <Field label="Odmena"><TextInput value={r.reward} onChange={(e) => upd(i, { reward: e.target.value })} /></Field>
          <Btn tone="danger" onClick={() => setRows((s) => s.filter((_, j) => j !== i))}>×</Btn>
        </div>
      ))}
      <div><Btn onClick={() => setRows((s) => [...s, { votes: 10, label: "", reward: "" }])}>+ Pridať odmenu</Btn></div>
      <Field label="Týždenný cieľ hlasov (0 = skryť)"><TextInput type="number" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} className="max-w-48" /></Field>
      <Feedback error={error} message={message} />
      <div><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>
    </Panel>
  );
}

export default function Votes() {
  const { data, error, loading, reload } = useApi("/admin/votes");
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const { run, busy, error: aerr, message } = useAction();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const remove = async () => { const s = del; setDel(null); const r = await run(() => api.del(`/admin/votes/sites/${s.key}`), "Služba zmazaná."); if (r.ok) reload(); };
  return (
    <div>
      <SectionTitle title="Votes Management"><Btn tone="primary" onClick={() => setEditing("new")}><span className="gold-gradient-text">Nová služba</span></Btn></SectionTitle>
      <Notice tone={data.listenerConfigured ? "info" : "warning"}>
        {data.note} Zaznamenaných hlasov: {data.recorded.total}{data.recorded.lastVote ? ` (posledný ${formatDateTime(data.recorded.lastVote)})` : ""}. Príjem hlasov z pluginu: {data.listenerConfigured ? "kľúč nastavený" : "PLUGIN_API_SECRET nie je nastavený"}.
      </Notice>
      <div className="mt-4" />
      <Feedback error={aerr} message={message} />
      {editing && <SiteForm key={editing === "new" ? "n" : editing.key} site={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Panel title="Hlasovacie služby">
        <Table head={["Názov", "Odkaz", "Stav", ""]}>
          {data.sites.map((s) => (
            <tr key={s.key}>
              <Td><span className="text-(--color-text)">{s.name}</span><br /><span className="text-[10px] text-(--color-text-dim)">{s.key}</span></Td>
              <Td className="max-w-64 truncate">{s.href}</Td>
              <Td>{s.enabled ? <Badge tone="green">zapnutá</Badge> : <Badge>vypnutá</Badge>}</Td>
              <Td className="whitespace-nowrap"><Btn onClick={() => setEditing(s)}>Upraviť</Btn> <Btn tone="danger" disabled={busy} onClick={() => setDel(s)}>Zmazať</Btn></Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Rewards key={JSON.stringify([data.rewards, data.weeklyGoal])} initial={data} onSaved={reload} />
      <ConfirmDialog open={Boolean(del)} title="Zmazať službu?" text={`„${del?.name}“ zmizne zo stránky Vote.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}
