// Auth-helpers — JWT in sessionStorage

const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

export interface AuthUser {
  user_id: number;
  username: string;
  full_name: string;
  role: "superadmin" | "schemaansvarig" | "personal";
  employee_id: string | null;
}

/**
 * Retrieves the authentication token from sessionStorage.
 *
 * @returns The authentication token if present, or null.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Stores the authentication token in sessionStorage.
 *
 * @param token - The JWT token to store.
 */
export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clears the authentication token and user information from sessionStorage.
 */
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

/**
 * Retrieves the authenticated user profile from sessionStorage.
 *
 * @returns The authenticated AuthUser object, or null if not logged in or invalid.
 */
export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Stores the authenticated user profile in sessionStorage.
 *
 * @param user - The AuthUser object to store.
 */
export function setUser(user: AuthUser): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Checks whether there is an active logged-in session.
 *
 * @returns True if logged in, false otherwise.
 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * Retrieves the role of the currently logged-in user.
 *
 * @returns The role string (superadmin, schemaansvarig, personal), or null.
 */
export function getUserRole(): string | null {
  return getUser()?.role ?? null;
}

/**
 * Retrieves the employee ID associated with the currently logged-in user.
 *
 * @returns The employee ID string, or null.
 */
export function getEmployeeId(): string | null {
  return getUser()?.employee_id ?? null;
}

/**
 * Determines the routing path to redirect the user to after a successful login based on their role.
 *
 * @param role - The user's role (superadmin, schemaansvarig, personal).
 * @param employeeId - The user's employee ID, if any.
 * @returns The path string to redirect the user to.
 */
export function redirectAfterLogin(role: string, employeeId: string | null): string {
  if (role === "superadmin" || role === "schemaansvarig") return "/dashboard";
  if (role === "personal" && employeeId) return `/personal/${employeeId}`;
  return "/dashboard";
}
