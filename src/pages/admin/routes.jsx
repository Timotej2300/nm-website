import { lazy, Suspense } from "react";
import AdminLayout from "./AdminLayout";
import { Loading } from "../../components/ui/Form";

const Dashboard = lazy(() => import("./sections/Dashboard"));
const Users = lazy(() => import("./sections/Users"));
const Roles = lazy(() => import("./sections/Roles"));
const Staff = lazy(() => import("./sections/Staff"));
const Pages = lazy(() => import("./sections/Pages"));
const Maintenance = lazy(() => import("./sections/Maintenance"));
const Settings = lazy(() => import("./sections/Settings"));
const Audit = lazy(() => import("./sections/Audit"));
const System = lazy(() => import("./sections/System"));
const Store = lazy(() => import("./sections/Store"));
const Votes = lazy(() => import("./sections/Votes"));
const TicketQueue = lazy(() => import("./sections/Tickets").then((m) => ({ default: m.TicketQueue })));
const TicketDetail = lazy(() => import("./sections/Tickets").then((m) => ({ default: m.TicketDetail })));
const TicketCategories = lazy(() => import("./sections/Tickets").then((m) => ({ default: m.TicketCategories })));
const NewsList = lazy(() => import("./sections/News").then((m) => ({ default: m.NewsList })));
const NewsEdit = lazy(() => import("./sections/News").then((m) => ({ default: m.NewsEdit })));

const wrap = (el) => <Suspense fallback={<Loading />}>{el}</Suspense>;

export const adminRoute = {
  path: "admin",
  element: <AdminLayout />,
  children: [
    { index: true, element: wrap(<Dashboard />) },
    { path: "users", element: wrap(<Users />) },
    { path: "roles", element: wrap(<Roles />) },
    { path: "staff", element: wrap(<Staff />) },
    { path: "tickets", element: wrap(<TicketQueue />) },
    { path: "tickets/:id", element: wrap(<TicketDetail />) },
    { path: "ticket-categories", element: wrap(<TicketCategories />) },
    { path: "pages", element: wrap(<Pages />) },
    { path: "maintenance", element: wrap(<Maintenance />) },
    { path: "news", element: wrap(<NewsList />) },
    { path: "news/:id", element: wrap(<NewsEdit />) },
    { path: "store", element: wrap(<Store />) },
    { path: "votes", element: wrap(<Votes />) },
    { path: "settings", element: wrap(<Settings />) },
    { path: "audit", element: wrap(<Audit />) },
    { path: "system", element: wrap(<System />) },
  ],
};
