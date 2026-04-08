import { create } from "zustand";
import { login as apiLogin, logout as apiLogout, demoLogin as apiDemoLogin } from "@/api/auth";

interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  email: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isDemo: false,
  email: null,
  loading: false,
  error: null,

  init: () => {
    const token = localStorage.getItem("access_token");
    const isDemo = localStorage.getItem("is_demo") === "true";
    if (token) {
      set({ isAuthenticated: true, isDemo });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const tokens = await apiLogin({ email, password });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      localStorage.removeItem("is_demo");
      set({ isAuthenticated: true, isDemo: false, email, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Check credentials.";
      set({ loading: false, error: message });
    }
  },

  demoLogin: async () => {
    set({ loading: true, error: null });
    try {
      const tokens = await apiDemoLogin();
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      localStorage.setItem("is_demo", "true");
      set({ isAuthenticated: true, isDemo: true, email: "demo@vaxaivision.com", loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Demo login failed. Please try again.";
      set({ loading: false, error: message });
    }
  },

  logout: async () => {
    await apiLogout();
    set({ isAuthenticated: false, isDemo: false, email: null });
  },
}));
