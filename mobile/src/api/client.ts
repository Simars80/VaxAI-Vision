import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.vaxaivision.com/api/v1";

// ── Offline request queue ─────────────────────────────────────────────────────
export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body: string;
  createdAt: number;
  retries: number;
}

const OFFLINE_QUEUE_KEY = "vaxai_offline_queue";

export async function getOfflineQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(queue: QueuedRequest[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueRequest(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    endpoint,
    method,
    body: JSON.stringify(body),
    createdAt: Date.now(),
    retries: 0,
  });
  await saveOfflineQueue(queue);
}

// ── Token storage ─────────────────────────────────────────────────────────────
export const TOKEN_KEYS = {
  ACCESS: "vaxai_access_token",
  REFRESH: "vaxai_refresh_token",
  IS_DEMO: "vaxai_is_demo",
} as const;

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
  } catch {
    return null;
  }
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, access);
  await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refresh);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
  await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
  await SecureStore.deleteItemAsync(TOKEN_KEYS.IS_DEMO);
}

// ── Axios instance ────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 and network errors ──────────────────────
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error) => {
    // 401: clear tokens (auth store will detect and redirect to login)
    if (error.response?.status === 401) {
      await clearTokens();
    }
    return Promise.reject(error);
  },
);

// ── Helper: make a request with offline fallback queueing ────────────────────
export async function requestWithOfflineFallback<T>(
  config: AxiosRequestConfig & {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
  },
): Promise<T | null> {
  try {
    const res = await apiClient.request<T>(config);
    return res.data;
  } catch (err: unknown) {
    const isNetworkError =
      axios.isAxiosError(err) &&
      (err.code === "ECONNABORTED" || err.code === "ERR_NETWORK" || !err.response);

    if (isNetworkError) {
      await enqueueRequest(config.url, config.method, config.data);
      return null; // Caller should handle null = queued
    }
    throw err;
  }
}
