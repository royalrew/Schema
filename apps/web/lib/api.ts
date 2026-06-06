import type { Employee, ScheduleDay, GenerateResponse, PeriodInfo, Phase, Bemanningskrav, HourlyRequirement } from "./types";
import { getToken, clearToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  role: string;
  employee_id: string | null;
  full_name: string;
  user_id: number;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Inloggning misslyckades");
  }
  return res.json();
}

export interface UserOut {
  id: number;
  username: string;
  full_name: string;
  role: string;
  employee_id: string | null;
  invite_accepted: boolean;
  last_login: string | null;
}

export async function fetchUsers(): Promise<UserOut[]> {
  const res = await apiFetch(`${BASE}/api/auth/users`);
  if (!res.ok) throw new Error("Kunde inte hämta användare");
  return res.json();
}

export async function createUser(data: { username: string; full_name: string; role: string; employee_id?: string | null }): Promise<UserOut> {
  const res = await apiFetch(`${BASE}/api/auth/users`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Kunde inte skapa användare");
  }
  return res.json();
}

export async function getInviteToken(userId: number): Promise<{ invite_token: string; full_name: string }> {
  const res = await apiFetch(`${BASE}/api/auth/users/${userId}/invite`, { method: "POST" });
  if (!res.ok) throw new Error("Kunde inte generera inbjudningslänk");
  return res.json();
}

export async function acceptInvite(token: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/api/auth/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Ogiltig inbjudningslänk");
  }
  return res.json();
}

export async function deleteUser(userId: number): Promise<void> {
  await apiFetch(`${BASE}/api/auth/users/${userId}`, { method: "DELETE" });
}

export async function updateUserRole(userId: number, role: string): Promise<UserOut> {
  const res = await apiFetch(`${BASE}/api/auth/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Kunde inte uppdatera rollen");
  }
  return res.json();
}

export async function updateEmployeeAttributes(
  employeeId: string,
  attributes: {
    name?: string;
    group_name?: string;
    contract_type?: string;
    is_dagansvarig?: boolean;
    is_planerare?: boolean;
    percentage?: number;
  }
): Promise<Employee> {
  const res = await apiFetch(`${BASE}/api/employees/${encodeURIComponent(employeeId)}/attributes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attributes),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Det gick inte att uppdatera medarbetarattribut");
  }
  return res.json();
}

// ── RAG-dokument ──────────────────────────────────────────────────────────────

export interface RagDocument {
  id: number;
  filename: string;
  title: string;
  content_type: string;
  file_size_kb: number;
  is_attested: boolean;
  uploaded_at: string;
  uploaded_by: string;
}

export async function fetchRagDocuments(): Promise<RagDocument[]> {
  const res = await apiFetch(`${BASE}/api/rag/documents`);
  if (!res.ok) throw new Error("Kunde inte hämta RAG-dokument");
  return res.json();
}

export async function uploadRagDocument(title: string, file: File): Promise<RagDocument> {
  const token = getToken();
  const form = new FormData();
  form.append("title", title);
  form.append("file", file);
  const res = await fetch(`${BASE}/api/rag/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Kunde inte ladda upp dokumentet");
  }
  return res.json();
}

export async function toggleAttestRagDocument(docId: number): Promise<RagDocument> {
  const res = await apiFetch(`${BASE}/api/rag/documents/${docId}/attest`, { method: "PATCH" });
  if (!res.ok) throw new Error("Kunde inte ändra attestering");
  return res.json();
}

export async function deleteRagDocument(docId: number): Promise<void> {
  await apiFetch(`${BASE}/api/rag/documents/${docId}`, { method: "DELETE" });
}

export async function fetchSuggestUsername(name: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/suggest-username?name=${encodeURIComponent(name)}`);
  if (!res.ok) return name.toLowerCase().replace(/\s+/g, ".");
  const data = await res.json();
  return data.username ?? name.toLowerCase().replace(/\s+/g, ".");
}

export interface BalanceEntry {
  employee_id: string;
  year: number;
  month: number;
  opening_balance_h: number;
  note: string | null;
}

export async function fetchGroupBalances(group: string, year: number, month: number): Promise<BalanceEntry[]> {
  const res = await apiFetch(`${BASE}/api/balances/group/${encodeURIComponent(group)}/${year}/${month}`);
  if (!res.ok) return [];
  return res.json();
}

export async function saveBalance(entry: BalanceEntry): Promise<void> {
  await apiFetch(`${BASE}/api/balances/${entry.employee_id}/${entry.year}/${entry.month}`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });
}

export async function saveEmployee(employee: Partial<Employee> & { id: string; name: string; contract_type: string; group: string; is_dagansvarig?: boolean }): Promise<Employee> {
  const res = await apiFetch(`${BASE}/api/employees`, {
    method: "POST",
    body: JSON.stringify({ ...employee, absences: [], wishes: [], vetos: [], soft_constraints: [], wish_schedule: [] }),
  });
  if (!res.ok) throw new Error("Kunde inte spara medarbetare");
  return res.json();
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/api/employees/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Kunde inte ta bort medarbetare");
}

export async function fetchEmployee(id: string): Promise<Employee> {
  const res = await apiFetch(`${BASE}/api/employees/${id}`);
  if (!res.ok) throw new Error("Kunde inte hämta anställd");
  return res.json();
}

export async function fetchEmployees(group: string): Promise<Employee[]> {
  const res = await apiFetch(`${BASE}/api/employees?group=${encodeURIComponent(group)}`);
  if (!res.ok) throw new Error("Kunde inte hämta personal");
  return res.json();
}

export async function fetchSchedule(
  group: string,
  year: number,
  month: number
): Promise<ScheduleDay[]> {
  const res = await apiFetch(`${BASE}/api/schedule/${encodeURIComponent(group)}/${year}/${month}`);
  if (!res.ok) throw new Error("Kunde inte hämta schema");
  return res.json();
}

export async function fetchPeriodInfo(
  group: string,
  year: number,
  month: number
): Promise<PeriodInfo> {
  const res = await apiFetch(`${BASE}/api/period/${encodeURIComponent(group)}/${year}/${month}`);
  if (!res.ok) return { phase: "wish", has_schedule: false, apt_date: null, decisions: [] };
  return res.json();
}

export async function setApt(
  group: string, year: number, month: number,
  aptDate: string | null,
): Promise<PeriodInfo> {
  const res = await apiFetch(`${BASE}/api/period/${encodeURIComponent(group)}/${year}/${month}/apt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apt_date: aptDate }),
  });
  if (!res.ok) throw new Error("Kunde inte spara APT-datum");
  return res.json();
}

export async function advancePhase(
  group: string,
  year: number,
  month: number,
  phase: Phase
): Promise<PeriodInfo> {
  const res = await fetch(
    `${BASE}/api/period/${encodeURIComponent(group)}/${year}/${month}/phase`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase }),
    }
  );
  if (!res.ok) throw new Error("Kunde inte uppdatera fas");
  return res.json();
}

export interface ShiftConfig {
  shift_type: string;
  start_time: string;
  end_time: string;
  label: string | null;
  group_name: string | null;
}

export async function fetchShiftConfigs(group?: string): Promise<ShiftConfig[]> {
  const url = group ? `${BASE}/api/shift-configs?group=${encodeURIComponent(group)}` : `${BASE}/api/shift-configs`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error("Kunde inte hämta passtider");
  const data = await res.json();
  return data.configs;
}

export interface DayKrav {
  fm: number;
  kval: number;
  natt: number;
  hourly_requirements?: HourlyRequirement[];
}

export interface StaffingTemplate {
  group_name: string;
  per_weekday: DayKrav[];
}

export async function fetchStaffingTemplate(group: string): Promise<StaffingTemplate> {
  const res = await apiFetch(`${BASE}/api/staffing/template/${encodeURIComponent(group)}`);
  if (!res.ok) throw new Error("Kunde inte hämta bemanningskrav");
  return res.json();
}

export async function saveStaffingTemplate(tmpl: StaffingTemplate): Promise<StaffingTemplate> {
  const res = await apiFetch(`${BASE}/api/staffing/template/${encodeURIComponent(tmpl.group_name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tmpl),
  });
  if (!res.ok) throw new Error("Kunde inte spara bemanningskrav");
  return res.json();
}

export async function fetchGroups(): Promise<string[]> {
  const res = await apiFetch(`${BASE}/api/groups`);
  if (!res.ok) throw new Error("Kunde inte hämta grupper");
  return res.json();
}

export async function fetchStaffing(
  group: string,
  year: number,
  month: number
): Promise<Bemanningskrav[]> {
  const res = await apiFetch(`${BASE}/api/staffing/${encodeURIComponent(group)}/${year}/${month}`);
  if (!res.ok) throw new Error("Kunde inte hämta bemanningskrav för månaden");
  return res.json();
}

export async function saveStaffing(kravList: Bemanningskrav[]): Promise<void> {
  const res = await apiFetch(`${BASE}/api/staffing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kravList),
  });
  if (!res.ok) throw new Error("Kunde inte spara bemanningskrav för månaden");
}

export async function saveShiftConfigs(configs: ShiftConfig[]): Promise<void> {
  const res = await apiFetch(`${BASE}/api/shift-configs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configs }),
  });
  if (!res.ok) throw new Error("Kunde inte spara passtider");
}

export interface WishShiftEntry {
  date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string | null;
  note: string;
}

export async function updateWishSchedule(employeeId: string, wishSchedule: WishShiftEntry[]): Promise<void> {
  const res = await apiFetch(`${BASE}/api/employees/${employeeId}/wish-schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wish_schedule: wishSchedule }),
  });
  if (!res.ok) throw new Error("Kunde inte spara önskeschema");
}

export async function updateWishes(employeeId: string, wishes: string[]): Promise<void> {
  const res = await apiFetch(`${BASE}/api/employees/${employeeId}/wishes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wishes }),
  });
  if (!res.ok) throw new Error("Kunde inte spara önskemål");
}

export async function generateSchedule(
  group: string,
  year: number,
  month: number
): Promise<GenerateResponse> {
  const res = await apiFetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group, year, month }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Kunde inte generera schema");
  }
  return res.json();
}

export interface ChatMessageResponse {
  response: string;
  category: string;
  shift_details?: {
    employee_name: string;
    date_str: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    is_unbooked: boolean;
    group_name: string;
    label: string;
  } | null;
}

export async function sendChatMessage(message: string): Promise<ChatMessageResponse> {
  const res = await apiFetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? "Det gick inte att skicka meddelandet");
  }
  return res.json();
}


// ── Demo & B2G Billing ────────────────────────────────────────────────────────

export interface DemoSandboxResponse {
  access_token: string;
  token_type: string;
  username: string;
  expires_at: string;
  group_name: string;
}

export async function createDemoSandbox(): Promise<DemoSandboxResponse> {
  const res = await fetch(`${BASE}/api/demo/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Kunde inte initiera demo-miljön");
  }
  return res.json();
}

export interface OrganizationSettings {
  org_name: string;
  org_number: string | null;
  peppol_id: string | null;
  zz_reference: string | null;
  invoice_email: string | null;
  billing_plan: string;
}

export async function fetchOrganizationSettings(): Promise<OrganizationSettings> {
  const res = await apiFetch(`${BASE}/api/organization/settings`);
  if (!res.ok) throw new Error("Kunde inte hämta faktureringsinställningar");
  return res.json();
}

export async function saveOrganizationSettings(settings: OrganizationSettings): Promise<OrganizationSettings> {
  const res = await apiFetch(`${BASE}/api/organization/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Kunde inte spara faktureringsinställningar");
  }
  return res.json();
}



