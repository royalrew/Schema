// Auth-helpers — JWT i localStorage

const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

export interface AuthUser {
  user_id: number;
  username: string;
  full_name: string;
  role: "superadmin" | "schemaansvarig" | "personal";
  employee_id: string | null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getUserRole(): string | null {
  return getUser()?.role ?? null;
}

export function getEmployeeId(): string | null {
  return getUser()?.employee_id ?? null;
}

export function redirectAfterLogin(role: string, employeeId: string | null): string {
  if (role === "superadmin" || role === "schemaansvarig") return "/dashboard";
  if (role === "personal" && employeeId) return `/personal/${employeeId}`;
  return "/dashboard";
}
