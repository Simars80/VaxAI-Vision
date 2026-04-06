import { apiClient } from "./client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function login(data: LoginRequest): Promise<AuthTokens> {
  const res = await apiClient.post<AuthTokens>("/auth/login", data);
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout").catch(() => {});
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}
