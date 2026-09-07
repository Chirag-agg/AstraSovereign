import { createContext, useContext, useState, type ReactNode } from "react";

export interface WorkbenchUser {
  name: string;
  email: string;
  role: string;
  department: string;
  initials: string;
}

const DEMO_USER: WorkbenchUser = {
  name: "Process Engineer",
  email: "engineer@workbench.local",
  role: "Process Engineer",
  department: "Refinery Operations",
  initials: "PE",
};

interface AuthContextValue {
  user: WorkbenchUser | null;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WorkbenchUser | null>(() => {
    return sessionStorage.getItem("wb-authed") ? DEMO_USER : null;
  });
  const [signingIn, setSigningIn] = useState(false);

  const signIn = async () => {
    setSigningIn(true);
    await new Promise((r) => setTimeout(r, 1100));
    sessionStorage.setItem("wb-authed", "1");
    setUser(DEMO_USER);
    setSigningIn(false);
  };

  const signOut = () => {
    sessionStorage.removeItem("wb-authed");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
