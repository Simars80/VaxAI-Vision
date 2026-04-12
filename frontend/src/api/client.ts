import axios from "axios";
import { getMockResponse } from "./mockData";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

/** True when the user entered via ?demo=true URL param (no backend needed) */
export function isDemoMode(): boolean {
  return localStorage.getItem("is_demo") === "true";
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: in demo mode, short-circuit with mock data ─────────
// This prevents network requests entirely — no failed fetches, no loading delays.
apiClient.interceptors.request.use((config) => {
  // Attach JWT access token
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // In demo mode, intercept ALL GET requests and return mock data immediately
  if (isDemoMode()) {
    const url = config.url ?? "";
    const mockData = getMockResponse(url, config.params);
    if (mockData !== undefined) {
      // Create an adapter that returns mock data without hitting the network
      config.adapter = () =>
        Promise.resolve({
          data: mockData,
          status: 200,
          statusText: "OK (demo)",
          headers: {},
          config,
        });
    }
  }

  return config;
});

// ── Response interceptor: catch any remaining failures in demo mode ──────────
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // In demo mode, catch ALL API failures and serve mock data as fallback
    if (isDemoMode()) {
      const url = error.config?.url ?? "";
      const params = error.config?.params;
      const mockData = getMockResponse(url, params);
      if (mockData !== undefined) {
        return Promise.resolve({
          data: mockData,
          status: 200,
          statusText: "OK (demo fallback)",
          headers: {},
          config: error.config,
        });
      }
    }

    // Normal mode: 401 → clear tokens and redirect
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
