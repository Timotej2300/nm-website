import { useState } from "react";
import { Badge, ConfirmDialog, ErrorBox, Field, Loading, TextArea, TextInput, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { formatDateTime, fromLocalInput, toLocalInput } from "../../../lib/format";
import { useAuth } from "../../../context/useAuth";
import { Btn, Feedback, Panel, SectionTitle, useAction } from "../common";

function Form({ m, canEdit, onSaved }) {
  const [f, setF] = useState({ enabled: m.enabled, title: m.title, message: m.message, returnAt: toLocalInput(m.returnAt), showCountdown: m.showCountdown });
  const [confirm, setConfirm] = useState(false);
  const { run, busy, error, message } = useAction();
  const body = (confirmed) => ({ enabled: f.enabled, title: f.title, message: f.message, returnAt: fromLocalInput(f.returnAt), showCountdown: f.showCountdown, confirm: confirmed });
  const submit = async (confirmed = false) => {
    const r = await run(() => api.put("/admin/maintenance", body(confirmed)), f.enabled ? "Údržba je zapnutá." : "Údržba je vypnutá.");
    if (r.ok) onSaved();
  };
  const onSave = () => (f.enabled && !m.enabled ? setConfirm(true) : submit(false));
  return (
    <Panel tone={m.enabled ? "warning" : "neutral"}>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={m.enabled ? "red" : "green"}>{m.enabled ? "ÚDRŽBA ZAPNUTÁ" : "web beží normálne"}</Badge>
        {m.enabled && <span className="text-[11px] text-(--color-text-muted)">od {formatDateTime(m.activatedAt)}{m.activatedBy ? ` · ${m.activatedBy}` : ""}</span>}
      </div>
      <Toggle checked={f.enabled} disabled={!canEdit} onChange={(v) => setF({ ...f, enabled: v })} label="Maintenance Mode (všetky verejné stránky zobrazia údržbu)" />
      <Field label="Nadpis"><TextInput value={f.title} maxLength={120} disabled={!canEdit} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Text"><TextArea rows={3} value={f.message} maxLength={1000} disabled={!canEdit} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plánovaný návrat"><TextInput type="datetime-local" value={f.returnAt} disabled={!canEdit} onChange={(e) => setF({ ...f, returnAt: e.target.value })} /></Field>
        <div className="flex items-end"><Toggle checked={f.showCountdown} disabled={!canEdit} onChange={(v) => setF({ ...f, showCountdown: v })} label="Zobraziť odpočet" /></div>
      </div>
      <p className="text-[10.5px] text-(--color-text-dim)">Tím s prístupom do administrácie vidí web normálne, prihlásenie ostáva dostupné a údržbu môžete kedykoľvek vypnúť.</p>
      <Feedback error={error} message={message} />
      {canEdit && <div><Btn tone="primary" onClick={onSave} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>}
      <ConfirmDialog open={confirm} title="Zapnúť údržbu?" text="Všetci hráči okamžite uvidia stránku údržby. Tím s prístupom do administrácie ju neuvidí." confirmLabel="Zapnúť údržbu" onConfirm={() => { setConfirm(false); submit(true); }} onCancel={() => setConfirm(false)} />
    </Panel>
  );
}

export default function Maintenance() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi("/admin/maintenance");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <SectionTitle title="Maintenance Mode" />
      <Form key={JSON.stringify(data.maintenance)} m={data.maintenance} canEdit={can("maintenance.manage")} onSaved={reload} />
    </div>
  );
}
