import { Link } from "react-router-dom";
import PixelBox from "../../../components/ui/PixelBox";
import { Badge, ErrorBox, Loading } from "../../../components/ui/Form";
import { useApi } from "../../../hooks/useApi";
import { formatDateTime } from "../../../lib/format";
import { SectionTitle, Panel } from "../common";

function Tile({ label, value, sub, to, tone = "neutral" }) {
  const inner = (
    <PixelBox tone={tone} className="h-full" contentClassName="flex flex-col gap-1">
      <span className="text-[9.5px] tracking-[0.12em] text-(--color-text-dim) uppercase">{label}</span>
      <span className="text-[22px] gold-gradient-text">{value}</span>
      {sub && <span className="text-[10.5px] text-(--color-text-muted)">{sub}</span>}
    </PixelBox>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { data, error, loading, reload } = useApi("/admin/dashboard");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const d = data;
  return (
    <div>
      <SectionTitle title="Dashboard" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {d.users && <Tile label="Používatelia" value={d.users.total} sub={`${d.users.suspended} pozastavených`} to="/admin/users" />}
        {d.tickets && <Tile label="Otvorené tickety" value={d.tickets.open} sub={`${d.tickets.unassigned} nepridelených`} to="/admin/tickets" tone="info" />}
        {d.staff && <Tile label="Členovia tímu" value={d.staff.visible} sub={`${d.staff.total} celkom, ${d.staff.needsReview} na kontrolu`} to="/admin/staff" />}
        {d.news && <Tile label="Novinky" value={d.news.published} sub={`${d.news.drafts} konceptov`} to="/admin/news" />}
        {d.maintenance && (
          <Tile
            label="Maintenance Mode"
            value={d.maintenance.enabled ? "ZAPNUTÝ" : "Vypnutý"}
            sub={d.maintenance.enabled ? `od ${formatDateTime(d.maintenance.activatedAt)}` : `${d.pagesDisabled?.length || 0} vypnutých stránok`}
            to="/admin/maintenance"
            tone={d.maintenance.enabled ? "warning" : "neutral"}
          />
        )}
      </div>
      {d.pagesDisabled?.length > 0 && (
        <p className="mt-4 text-[11.5px] text-(--color-text-muted)">
          Vypnuté stránky: {d.pagesDisabled.map((p) => <Badge key={p} tone="red">{p}</Badge>)}
        </p>
      )}
      {d.recentAudit && (
        <div className="mt-6">
          <Panel title="Posledné udalosti">
            {d.recentAudit.length === 0 && <p className="text-[11.5px] text-(--color-text-dim)">Zatiaľ žiadne záznamy.</p>}
            {d.recentAudit.map((a, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/5 pt-2 text-[11.5px] first:border-0 first:pt-0">
                <span className="text-(--color-text-muted)">
                  <span className="text-(--color-primary)">{a.actor || "systém"}</span> · {a.summary || a.action}
                </span>
                <span className="text-[10px] text-(--color-text-dim)">{formatDateTime(a.createdAt)}</span>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </div>
  );
}
