import { useState } from "react";
import { ErrorBox, Field, Loading, Select, Toggle } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/useAuth";
import { Btn, Feedback, Panel, SectionTitle, useAction } from "../common";

function WebSettings({ initial, onSaved }) {
  const [v, setV] = useState(initial.staffOnRoleRemoved);
  const { run, busy, error, message } = useAction();
  const save = async () => {
    const r = await run(() => api.put("/admin/settings", { staffOnRoleRemoved: v }), "Uložené.");
    if (r.ok) onSaved();
  };
  return (
    <Panel title="Verejný tím">
      <Field label="Keď člen stratí verejnú rolu (ak rola nemá vlastné nastavenie)">
        <Select value={v} onChange={(e) => setV(e.target.value)}>
          <option value="hide">Skryť zo stránky Staff</option>
          <option value="review">Označiť na kontrolu</option>
        </Select>
      </Field>
      <Feedback error={error} message={message} />
      <div><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>
    </Panel>
  );
}

function TicketSettings() {
  const { data, error, loading, reload } = useApi("/admin/ticket-settings");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return <TicketSettingsForm key={JSON.stringify(data.settings)} s={data.settings} />;
}

function TicketSettingsForm({ s }) {
  const [f, setF] = useState(s);
  const { run, busy, error, message } = useAction();
  const save = () => run(() => api.put("/admin/ticket-settings", { playerPriority: f.playerPriority, reopenDays: Number(f.reopenDays), maxOpenPerUser: Number(f.maxOpenPerUser), discordWebhookEnabled: f.discordWebhookEnabled }), "Uložené.");
  return (
    <Panel title="Tickety">
      <Toggle checked={f.playerPriority} onChange={(v) => setF({ ...f, playerPriority: v })} label="Hráč môže pri vytvorení zvoliť prioritu" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hráč môže znovu otvoriť ticket (dní)"><input type="number" min={0} max={365} className="w-full rounded-sm border border-white/10 bg-black/35 px-3 py-2 text-[12px]" value={f.reopenDays} onChange={(e) => setF({ ...f, reopenDays: e.target.value })} /></Field>
        <Field label="Max. otvorených ticketov na hráča"><input type="number" min={1} max={50} className="w-full rounded-sm border border-white/10 bg-black/35 px-3 py-2 text-[12px]" value={f.maxOpenPerUser} onChange={(e) => setF({ ...f, maxOpenPerUser: e.target.value })} /></Field>
      </div>
      <Toggle checked={f.discordWebhookEnabled} onChange={(v) => setF({ ...f, discordWebhookEnabled: v })} label="Discord webhook (iba ID a kategória, nikdy obsah ticketu; vyžaduje DISCORD_WEBHOOK_URL na serveri)" />
      <Feedback error={error} message={message} />
      <div><Btn tone="primary" onClick={save} disabled={busy}><span className="gold-gradient-text">Uložiť</span></Btn></div>
    </Panel>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi("/admin/settings");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div>
      <SectionTitle title="Nastavenia webu" />
      <WebSettings key={data.settings.staffOnRoleRemoved} initial={data.settings} onSaved={reload} />
      {can("tickets.manage_settings") && <TicketSettings />}
      <p className="text-[10.5px] text-(--color-text-dim)">Obchod a hlasovanie sa nastavujú vo vlastných sekciách. Tajné hodnoty (databáza, SMTP, kľúče) sa nastavujú iba v premenných prostredia na Verceli.</p>
    </div>
  );
}
