import { createBrowserRouter } from "react-router-dom";
import RootLayout from "../layouts/RootLayout";
import Home from "../pages/Home";
import News from "../pages/News";
import Votes from "../pages/Votes";
import Store from "../pages/Store";
import Staff from "../pages/Staff";
import NewsDetails from "../pages/NewsDetails";
import Cart from "../pages/Cart";
import Login from "../pages/Login";
import Tickets from "../pages/Tickets";
import Account from "../pages/Account";
import { ForgotPassword, ResetPassword, VerifyEmail } from "../pages/AuthExtras";
import { adminRoute } from "../pages/admin/routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "news", element: <News /> },
      { path: "news/:slug", element: <NewsDetails /> },
      { path: "votes", element: <Votes /> },
      { path: "store", element: <Store /> },
      { path: "staff", element: <Staff /> },
      { path: "cart", element: <Cart /> },
      { path: "login", element: <Login /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "verify-email", element: <VerifyEmail /> },
      { path: "tickets", element: <Tickets /> },
      { path: "account", element: <Account /> },
      adminRoute,
    ],
  },
]);