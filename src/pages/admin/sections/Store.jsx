import { useState } from "react";
import { Badge, ConfirmDialog, EmptyState, ErrorBox, Field, Loading, Notice, Select, TextArea, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { Btn, Feedback, Pager, Panel, SectionTitle, Table, Td, useAction } from "../common";

const CATS = { rank: "Rank", crate: "Crate", currency: "Mena" };

function ProductForm({ p, onDone, onCancel }) {
  const [f, setF] = useState(p ? { key: p.key, category: p.category, name: p.name, price: p.price, available: p.available, sortOrder: p.sortOrder, data: JSON.stringify(p.data, null, 2) } : { key: "", category: "rank", name: "", price: 0, available: true, sortOrder: 100, data: "{}" });
  const { run, busy, error } = useAction();
  const [jsonErr, setJsonErr] = useState(null);
  const save = async () => {
    let data;
    try { data = JSON.parse(f.data || "{}"); if (typeof data !== "object" || Array.isArray(data) || !data) throw new Error(); } catch { setJsonErr("Dáta musia byť platný JSON objekt."); return; }
    setJsonErr(null);
    const body = { category: f.category, name: f.name, price: Number(f.price), available: f.available, sortOrder: Number(f.sortOrder) || 0, data };
    const r = await run(() => (p ? api.patch(`/admin/store/products/${p.id}`, body) : api.post("/admin/store/products", { ...body, key: f.key })));
    if (r.ok) onDone();
  };
  return (
    <Panel title={p ? `Upraviť: ${p.name}` : "Nový produkt"} tone="primary">
      <div className="grid gap-3 sm:grid-cols-2">
        {!p && <Field label="Kľúč" hint="malé písmená, číslice, - a _"><TextInput value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></Field>}
        <Field label="Kategória"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Názov"><TextInput value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Cena"><TextInput type="number" min="0" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Poradie"><TextInput type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
        <Field label="Ďalšie údaje (JSON: výhody, farby, obrázok…)" className="sm:col-span-2"><TextArea rows={8} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className="font-mono" /></Field>
      </div>
      <Toggle checked={f.available} onChange={(v) => setF({ ...f, available: v })} label="Dostupný v obchode" />
      <Feedback error={jsonErr || error} />
      <div className="flex gap-2"><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn><Btn onClick={onCancel}>Zrušiť</Btn></div>
    </Panel>
  );
}

function Products() {
  const { data, error, loading, reload } = useApi("/admin/store/products");
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const { run, busy, error: aerr, message } = useAction();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const remove = async () => { const p = del; setDel(null); const r = await run(() => api.del(`/admin/store/products/${p.id}`), "Produkt zmazaný."); if (r.ok) reload(); };
  const toggle = async (p) => {
    const r = await run(() => api.patch(`/admin/store/products/${p.id}`, { category: p.category, name: p.name, price: p.price, available: !p.available, sortOrder: p.sortOrder, data: p.data }), "Uložené.");
    if (r.ok) reload();
  };
  return (
    <>
      <SectionTitle title="Store Management"><Btn tone="primary" onClick={() => setEditing("new")}><span className="gold-gradient-text">Nový produkt</span></Btn></SectionTitle>
      <Feedback error={aerr} message={message} />
      {editing && <ProductForm key={editing === "new" ? "n" : editing.id} p={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Panel title="Produkty">
        {data.items.length === 0 ? <EmptyState title="Žiadne produkty" /> : (
          <Table head={["Produkt", "Kategória", "Cena", "Stav", ""]}>
            {data.items.map((p) => (
              <tr key={p.id}>
                <Td><span className="text-(--color-text)">{p.name}</span><br /><span className="text-[10px] text-(--color-text-dim)">{p.key}</span></Td>
                <Td>{CATS[p.category]}</Td>
                <Td>{p.price}</Td>
                <Td>{p.available ? <Badge tone="green">dostupný</Badge> : <Badge>skrytý</Badge>}</Td>
                <Td className="whitespace-nowrap"><Btn onClick={() => setEditing(p)}>Upraviť</Btn> <Btn disabled={busy} onClick={() => toggle(p)}>{p.available ? "Skryť" : "Zobraziť"}</Btn> <Btn tone="danger" disabled={busy} onClick={() => setDel(p)}>Zmazať</Btn></Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <ConfirmDialog open={Boolean(del)} title="Zmazať produkt?" text={`„${del?.name}“ zmizne z obchodu.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}

function StoreSettings({ status, onSaved }) {
  const [f, setF] = useState({ symbol: status.currencySymbol, target: status.monthlyGoal?.target ?? 0 });
  const { run, busy, error, message } = useAction();
  const save = async () => {
    const r = await run(() => api.put("/admin/store/settings", { currencySymbol: f.symbol, monthlyGoalTarget: Number(f.target) || 0 }), "Uložené.");
    if (r.ok) onSaved();
  };
  return (
    <Panel title="Nastavenia obchodu">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Symbol meny"><TextInput value={f.symbol} maxLength={4} onChange={(e) => setF({ ...f, symbol: e.target.value })} /></Field>
        <Field label="Mesačný cieľ (0 = skryť)" hint="Postup sa počíta iba zo skutočne zaplatených objednávok."><TextInput type="number" min="0" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
      </div>
      <Feedback error={error} message={message} />
      <div><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>
    </Panel>
  );
}

function Orders() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi(`/admin/store/orders?page=${page}&size=20`);
  return (
    <Panel title="Objednávky">
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && data.items.length === 0 && <p className="text-[11.5px] text-(--color-text-dim)">Zatiaľ žiadne objednávky.</p>}
      {data && data.items.length > 0 && (
        <>
          <Table head={["#", "Hráč", "Suma", "Stav", "Brána", "Vytvorená"]}>
            {data.items.map((o) => <tr key={o.id}><Td>{o.id}</Td><Td>{o.player}</Td><Td>{o.total} {o.currency}</Td><Td>{o.status}</Td><Td>{o.provider || "—"}</Td><Td>{formatDateTime(o.createdAt)}</Td></tr>)}
          </Table>
          <Pager page={page} size={20} total={data.total} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

export default function Store() {
  const { data, error, loading, reload } = useApi("/admin/store/status");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <Notice tone="warning">{data.note} Objednávky: {data.orders} (zaplatené {data.paid}, čakajúce {data.pending}). Platobná brána: {data.paymentProvider || "nenapojená"}.</Notice>
      <div className="mt-4" />
      <Products />
      <StoreSettings key={data.currencySymbol + (data.monthlyGoal?.target ?? 0)} status={data} onSaved={reload} />
      <Orders />
    </div>
  );
}
