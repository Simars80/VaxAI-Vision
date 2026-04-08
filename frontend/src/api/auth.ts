import { apiClient } from "./client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_demo?: boolean;
}

export async function login(data: LoginRequest): Promise<AuthTokens> {
  const res = await apiClient.post<AuthTokens>("/auth/login", data);
  return res.data;
}

export async function demoLogin(): Promise<AuthTokens> {
  const res = await apiClient.post<AuthTokens>("/auth/demo-login");
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout").catch(() => {});
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("is_demo");
}
