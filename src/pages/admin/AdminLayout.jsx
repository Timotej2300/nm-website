import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

// [path, label, permissions (any of)]
const ITEMS = [
  ["/admin", "Dashboard", ["admin.access"], true],
  ["/admin/users", "Používatelia", ["users.view"]],
  ["/admin/roles", "Roly a oprávnenia", ["roles.manage", "users.view"]],
  ["/admin/staff", "Staff Management", ["staff.manage"]],
  ["/admin/tickets", "Tickets Management", ["tickets.view_assigned", "tickets.view_category", "tickets.view_all"]],
  ["/admin/pages", "Správa stránok", ["pages.manage"]],
  ["/admin/maintenance", "Maintenance Mode", ["maintenance.manage", "pages.manage"]],
  ["/admin/news", "News Management", ["news.manage"]],
  ["/admin/store", "Store Management", ["store.manage"]],
  ["/admin/votes", "Votes Management", ["votes.manage"]],
  ["/admin/settings", "Nastavenia webu", ["settings.manage"]],
  ["/admin/audit", "Audit Log", ["audit.view"]],
  ["/admin/system", "Bezpečnosť a systém", ["security.view"]],
];

export default function AdminLayout() {
  const { can } = useAuth();
  if (!can("admin.access")) return <Navigate to="/" replace />;
  const items = ITEMS.filter(([, , perms]) => perms.some((p) => can(p)));
  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-6 px-4 py-8 lg:flex-row">
      <nav aria-label="Administrácia" className="flex shrink-0 flex-row flex-wrap gap-1.5 lg:w-56 lg:flex-col">
        {items.map(([to, label, , end]) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            className={({ isActive }) =>
              `rounded-sm px-3 py-2 text-[11.5px] tracking-[0.04em] transition-colors ${isActive ? "bg-(--color-primary)/15 text-(--color-primary)" : "text-(--color-text-muted) hover:bg-white/5 hover:text-(--color-text)"}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
