import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { clearStoredUserId, getStoredUserId, setStoredUserId } from "../storage";

type UserContextValue = {
  userId: number | null;
  login: (id: number) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(() => getStoredUserId());

  const login = useCallback((id: number) => {
    setStoredUserId(id);
    setUserId(id);
  }, []);

  const logout = useCallback(() => {
    clearStoredUserId();
    setUserId(null);
  }, []);

  return (
    <UserContext.Provider value={{ userId, login, logout }}>{children}</UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
