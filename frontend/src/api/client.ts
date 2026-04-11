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

// Attach JWT access token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses: in demo mode, intercept errors and return mock data
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // In demo mode, catch ALL API failures and serve mock data instead
    if (isDemoMode()) {
      const url = error.config?.url ?? "";
      const params = error.config?.params;
      const mockData = getMockResponse(url, params);
      if (mockData !== undefined) {
        return Promise.resolve({ data: mockData, status: 200, statusText: "OK (demo)", headers: {}, config: error.config });
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
