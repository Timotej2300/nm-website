import { useState, useCallback, useMemo } from "react";
import { AuthContext } from "./auth-context";
import { avatarUrl } from "../data/votes";

// No backend exists yet — this simulates the round trip a real Microsoft
// OAuth (MSAL) redirect would make. Swap the body of `signInWithMicrosoft`
// for the real `@azure/msal-browser` popup/redirect flow once an Azure App
// Registration (client ID) exists; nothing else in the app needs to change.
const SIMULATED_DELAY = 1100;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username, avatar } | null
  const [status, setStatus] = useState("idle"); // idle | connecting | error

  const signInWithMicrosoft = useCallback(() => {
    setStatus("connecting");
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUser = {
          username: "Steve_BD",
          avatar: avatarUrl("Steve_BD", 64),
        };
        setUser(mockUser);
        setStatus("idle");
        resolve(mockUser);
      }, SIMULATED_DELAY);
    });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setStatus("idle");
  }, []);

  const value = useMemo(
    () => ({ user, status, signInWithMicrosoft, signOut }),
    [user, status, signInWithMicrosoft, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}