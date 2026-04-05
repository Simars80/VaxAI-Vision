import { create } from "zustand";
import { login as apiLogin, logout as apiLogout } from "@/api/auth";

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  email: null,
  loading: false,
  error: null,

  init: () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      set({ isAuthenticated: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const tokens = await apiLogin({ email, password });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      set({ isAuthenticated: true, email, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Check credentials.";
      set({ loading: false, error: message });
    }
  },

  logout: async () => {
    await apiLogout();
    set({ isAuthenticated: false, email: null });
  },
}));
