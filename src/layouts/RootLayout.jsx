import { Navigate, Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { useAuth } from "../context/useAuth";
import { BootScreen, MaintenanceScreen, UnavailableScreen } from "../components/guards/Screens";

// Reachable without being signed in.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify-email"];

// URL -> page key used by "Správa stránok" in the admin panel.
function pageKeyFor(pathname) {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/news/")) return "news_details";
  const first = pathname.split("/")[1];
  return { cart: "cart", news: "news", staff: "staff", store: "store", votes: "votes", tickets: "tickets", login: "login" }[first] || null;
}

export default function RootLayout() {
  const { user, site, loading, can } = useAuth();
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.includes(location.pathname);

  let content;
  if (loading || !site) {
    content = <BootScreen />;
  } else if (!user && !isPublic) {
    // Direct URL opens land here too: no session -> login, then back to where they were going.
    content = <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  } else if (user && location.pathname === "/login") {
    content = <Navigate to={location.state?.from || "/"} replace />;
  } else if (site.maintenance.enabled && !can("admin.access") && !isPublic) {
    content = <MaintenanceScreen maintenance={site.maintenance} showLogin={!user} />;
  } else if (site.maintenance.enabled && !user && location.pathname === "/login") {
    content = <Outlet />;
  } else {
    const key = pageKeyFor(location.pathname);
    const st = key && site.pages[key];
    const bypass = can("admin.access");
    // "Login" switched off: still reachable for the team through ?team=1 so nobody can lock themselves out.
    const teamLogin = key === "login" && new URLSearchParams(location.search).has("team");
    if (st && !st.enabled && !bypass && !teamLogin) {
      content = <UnavailableScreen message={st.message} />;
    } else {
      content = <Outlet />;
    }
  }

  return (
    <div className="min-h-screen bg-(--color-bg) flex flex-col isolate">
      <Header />
      <main className="flex-1 pt-16.5">{content}</main>
      <Footer />
    </div>
  );
}
