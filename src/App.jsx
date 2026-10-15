import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { CartProvider } from "./context/CartProvider";
import { AuthProvider } from "./context/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  );
}