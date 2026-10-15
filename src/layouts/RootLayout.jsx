import { Outlet } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-(--color-bg) flex flex-col isolate">
      <Header />
      <main className="flex-1 pt-16.5">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}