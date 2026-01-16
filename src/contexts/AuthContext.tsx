import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type UserRole = "admin" | "user";

export interface User {
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

// Allowed users for demo (any password accepted)
const ALLOWED_USERS: Record<string, { role: UserRole }> = {
  "admin@mycompany.com": { role: "admin" },
  "user@mycompany.com": { role: "user" },
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // No auto-login - data loads in background while user is on login screen
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((email: string, _password: string): { success: boolean; error?: string } => {
    const normalizedEmail = email.toLowerCase().trim();
    const userConfig = ALLOWED_USERS[normalizedEmail];

    if (!userConfig) {
      return { success: false, error: "Use admin@mycompany.com or user@mycompany.com" };
    }

    // Any password accepted for demo
    const newUser: User = {
      email: normalizedEmail,
      role: userConfig.role,
    };

    setUser(newUser);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
