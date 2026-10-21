import { Badge, ErrorBox, Loading } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { formatDateTime } from "../../../lib/format";
import { Panel, SectionTitle, Table, Td } from "../common";

const Row = ({ label, ok, text, warn }) => (
  <div className="flex items-center justify-between gap-3 border-t border-white/5 py-2 text-[11.5px] text-(--color-text-muted) first:border-0">
    <span>{label}</span>
    <Badge tone={ok ? "green" : warn ? "gold" : "red"}>{text}</Badge>
  </div>
);

export default function System() {
  const { data, error, loading, reload } = useApi("/admin/system");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const c = data.checks;
  const authme = c.authme.mode === "none" ? "nenakonfigurované" : c.authme.mode === "bridge" ? "bridge" : c.authme.reachable ? "pripojené (priame)" : "nedostupné";
  return (
    <div>
      <SectionTitle title="Bezpečnosť a systémový stav" />
      <Panel title={`Prostredie: ${data.environment}`}>
        <Row label="Databáza (web)" ok={c.database} text={c.database ? "OK" : "chyba"} />
        <Row label="APP_SECRET (≥ 32 znakov)" ok={c.appSecret} text={c.appSecret ? "nastavený" : "chýba"} />
        <Row label="SITE_URL" ok={c.siteUrl} warn text={c.siteUrl ? "nastavené" : "predvolené"} />
        <Row label="AuthMe overovanie" ok={c.authme.mode !== "none" && c.authme.reachable !== false} text={authme} />
        <Row label="OWNER_MINECRAFT_UUID" ok={c.ownerUuidConfigured} text={c.ownerUuidConfigured ? "nastavený" : "chýba"} />
        <Row label="Účet vlastníka prepojený (UUID)" ok={c.ownerAccountLinked} warn text={c.ownerAccountLinked ? "áno" : "zatiaľ nie"} />
        <Row label="E-mail (SMTP)" ok={c.mail} warn text={c.mail ? "nastavený" : "nenastavený"} />
        <Row label="Kľúč pre Minecraft plugin" ok={c.pluginSecret} warn text={c.pluginSecret ? "nastavený" : "nenastavený"} />
        <Row label="Discord webhook" ok={c.discordWebhook} warn text={c.discordWebhook ? "nastavený" : "nenastavený"} />
        <Row label="Platobná brána" ok={Boolean(c.paymentProvider)} warn text={c.paymentProvider || "nenapojená"} />
      </Panel>
      <Panel title="Aktivita (reálne údaje)">
        <Row label="Aktívne relácie" ok text={String(data.activeSessions)} />
        <Row label="Úspešné prihlásenia (24 h)" ok text={String(data.logins24h)} />
        <Row label="Neúspešné prihlásenia (24 h)" ok={data.failedLogins24h < 20} warn text={String(data.failedLogins24h)} />
      </Panel>
      <Panel title="Aplikované migrácie">
        <Table head={["Migrácia", "Aplikovaná"]}>
          {data.migrations.map((m) => (
            <tr key={m.name}><Td>{m.name}</Td><Td>{formatDateTime(m.appliedAt)}</Td></tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
