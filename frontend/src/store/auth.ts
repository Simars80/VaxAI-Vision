import { create } from "zustand";
import { login as apiLogin, logout as apiLogout, demoLogin as apiDemoLogin } from "@/api/auth";

// ── Synchronous auth detection — runs BEFORE first render ─────────────────
// Fixes the race condition where ProtectedRoute redirects to /login
// before useEffect-based init() can set isAuthenticated = true.
function detectInitialAuth(): { isAuthenticated: boolean; isDemo: boolean; email: string | null } {
  if (typeof window === "undefined") {
    return { isAuthenticated: false, isDemo: false, email: null };
  }

  // 1. Check ?demo=true URL param (highest priority)
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "true") {
    localStorage.setItem("access_token", "demo-token-url");
    localStorage.setItem("refresh_token", "demo-refresh-url");
    localStorage.setItem("is_demo", "true");
    // Clean the URL so ?demo=true doesn't linger
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    window.history.replaceState({}, "", url.pathname + url.search);
    return { isAuthenticated: true, isDemo: true, email: "partnerships@vaxaivision.com" };
  }

  // 2. Check existing tokens in localStorage
  const token = localStorage.getItem("access_token");
  const isDemo = localStorage.getItem("is_demo") === "true";
  if (token) {
    return { isAuthenticated: true, isDemo, email: isDemo ? "partnerships@vaxaivision.com" : null };
  }

  return { isAuthenticated: false, isDemo: false, email: null };
}

const _initialAuth = detectInitialAuth();

interface AuthState {
  isAuthenticated: boolean;
  isDemo: boolean;
  email: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  /** Instant demo login via URL param — no API call required */
  urlDemoLogin: () => void;
  logout: () => Promise<void>;
  /** @deprecated — auth detection now runs synchronously at module load */
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Pre-computed initial auth state (synchronous — no race condition)
  isAuthenticated: _initialAuth.isAuthenticated,
  isDemo: _initialAuth.isDemo,
  email: _initialAuth.email,
  loading: false,
  error: null,

  init: () => {
    // Kept for backward compat / HMR — detection already happened above
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true") {
      localStorage.setItem("access_token", "demo-token-url");
      localStorage.setItem("refresh_token", "demo-refresh-url");
      localStorage.setItem("is_demo", "true");
      set({ isAuthenticated: true, isDemo: true, email: "partnerships@vaxaivision.com" });
      const url = new URL(window.location.href);
      url.searchParams.delete("demo");
      window.history.replaceState({}, "", url.pathname + url.search);
      return;
    }
    const token = localStorage.getItem("access_token");
    const isDemo = localStorage.getItem("is_demo") === "true";
    if (token) {
      set({ isAuthenticated: true, isDemo, email: isDemo ? "partnerships@vaxaivision.com" : null });
    }
  },

  urlDemoLogin: () => {
    localStorage.setItem("access_token", "demo-token-url");
    localStorage.setItem("refresh_token", "demo-refresh-url");
    localStorage.setItem("is_demo", "true");
    set({ isAuthenticated: true, isDemo: true, email: "partnerships@vaxaivision.com", loading: false });
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
      set({ isAuthenticated: true, isDemo: true, email: "partnerships@vaxaivision.com", loading: false });
    } catch (err: unknown) {
      // If API fails, fall back to URL-based demo login (no backend needed)
      localStorage.setItem("access_token", "demo-token-fallback");
      localStorage.setItem("refresh_token", "demo-refresh-fallback");
      localStorage.setItem("is_demo", "true");
      set({ isAuthenticated: true, isDemo: true, email: "partnerships@vaxaivision.com", loading: false });
    }
  },

  logout: async () => {
    await apiLogout();
    set({ isAuthenticated: false, isDemo: false, email: null });
  },
}));
