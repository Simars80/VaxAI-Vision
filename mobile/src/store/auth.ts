import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  login as apiLogin,
  logout as apiLogout,
  demoLogin as apiDemoLogin,
} from "@/api/auth";
import { TOKEN_KEYS, setTokens, clearTokens } from "@/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  email: string | null;
  loading: boolean;
  error: string | null;
  /** Call on app start to restore session from secure store */
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isDemo: false,
  email: null,
  loading: false,
  error: null,

  /**
   * Restore session from SecureStore on app launch.
   * Call this in the root layout's useEffect.
   */
  init: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
      const isDemo = (await SecureStore.getItemAsync(TOKEN_KEYS.IS_DEMO)) === "true";
      if (token) {
        set({
          isAuthenticated: true,
          isDemo,
          email: isDemo ? "partnerships@vaxaivision.com" : null,
        });
      }
    } catch {
      // SecureStore unavailable (e.g. simulator without keychain) — stay logged out
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const tokens = await apiLogin({ email, password });
      await setTokens(tokens.access_token, tokens.refresh_token);
      await SecureStore.deleteItemAsync(TOKEN_KEYS.IS_DEMO);
      set({ isAuthenticated: true, isDemo: false, email, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Check your credentials.";
      set({ loading: false, error: message });
    }
  },

  demoLogin: async () => {
    set({ loading: true, error: null });
    try {
      const tokens = await apiDemoLogin();
      await setTokens(tokens.access_token, tokens.refresh_token);
      await SecureStore.setItemAsync(TOKEN_KEYS.IS_DEMO, "true");
      set({
        isAuthenticated: true,
        isDemo: true,
        email: "partnerships@vaxaivision.com",
        loading: false,
      });
    } catch {
      // If API unavailable, use offline demo tokens
      await setTokens("demo-token-mobile", "demo-refresh-mobile");
      await SecureStore.setItemAsync(TOKEN_KEYS.IS_DEMO, "true");
      set({
        isAuthenticated: true,
        isDemo: true,
        email: "partnerships@vaxaivision.com",
        loading: false,
      });
    }
  },

  logout: async () => {
    await apiLogout().catch(() => {});
    await clearTokens();
    set({ isAuthenticated: false, isDemo: false, email: null });
  },

  clearError: () => set({ error: null }),
}));
