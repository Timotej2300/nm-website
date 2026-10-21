import { useState } from "react";
import { Badge, ErrorBox, Field, Loading, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime, fromLocalInput, toLocalInput } from "../../../lib/format";
import { Btn, Feedback, Panel, SectionTitle, useAction } from "../common";

function PageRow({ page, onSaved }) {
  const [f, setF] = useState({
    enabled: page.enabled,
    message: page.message || "",
    on: toLocalInput(page.scheduleEnableAt),
    off: toLocalInput(page.scheduleDisableAt),
  });
  const { run, busy, error, message } = useAction();
  const save = async () => {
    const r = await run(
      () => api.put(`/admin/pages/${page.key}`, { enabled: f.enabled, message: f.message || null, scheduleEnableAt: fromLocalInput(f.on), scheduleDisableAt: fromLocalInput(f.off) }),
      "Uložené.",
    );
    if (r.ok) onSaved();
  };
  return (
    <Panel tone={page.effectiveEnabled ? "neutral" : "danger"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[14px] gold-gradient-text">{page.label}</h2>
          <span className="text-[10.5px] text-(--color-text-dim)">{page.path}</span>
          {page.effectiveEnabled ? <Badge tone="green">dostupná</Badge> : <Badge tone="red">nedostupná</Badge>}
        </div>
        <span className="text-[10.5px] text-(--color-text-dim)">Posledná zmena: {page.updatedAt ? `${formatDateTime(page.updatedAt)} · ${page.updatedBy || "—"}` : "—"}</span>
      </div>
      <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Stránka je zapnutá" />
      <Field label="Správa o nedostupnosti"><TextInput value={f.message} maxLength={500} placeholder="Táto stránka je dočasne nedostupná." onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Naplánovať zapnutie"><TextInput type="datetime-local" value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        <Field label="Naplánovať vypnutie"><TextInput type="datetime-local" value={f.off} onChange={(e) => setF({ ...f, off: e.target.value })} /></Field>
      </div>
      <Feedback error={error} message={message} />
      <div><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>
    </Panel>
  );
}

export default function Pages() {
  const { data, error, loading, reload } = useApi("/admin/pages");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <SectionTitle title="Správa stránok" />
      <p className="mb-4 text-[11.5px] text-(--color-text-muted)">Vypnutie sa vynucuje na serveri (API vráti 503). Vypnutá News vypína aj NewsDetails. Prihlásenie a admin zostávajú dostupné; tím sa k vypnutej stránke dostane stále (náhľad). Plánované časy sa používajú iba budúce.</p>
      {data.pages.map((p) => <PageRow key={`${p.key}-${p.updatedAt}`} page={p} onSaved={reload} />)}
    </div>
  );
}
