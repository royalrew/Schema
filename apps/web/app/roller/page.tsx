"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, Check, AlertCircle, RefreshCw, UserCheck, ToggleLeft, ToggleRight, Sparkles, Search, Info, X } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import {
  fetchEmployees, fetchUsers, updateUserRole,
  updateEmployeeAttributes, createUser, getInviteToken,
  deleteUser, fetchSuggestUsername, type UserOut
} from "@/lib/api";
import type { Employee, ContractType, Group } from "@/lib/types";

const CONTRACTS: { value: ContractType; label: string }[] = [
  { value: "varierande",   label: "Varierande" },
  { value: "dagtid",       label: "Dagtid" },
  { value: "kval",         label: "Kväll" },
  { value: "helg_fre_son", label: "Helg fre–sön" },
  { value: "helg_lor_man", label: "Helg lör–mån" },
  { value: "natt",         label: "Natt" },
  { value: "vikarie",      label: "Vikarie" },
];

const GROUPS = ["Alla", "Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  superadmin:      { label: "Superadmin",      bg: "bg-terracotta/15", text: "text-terracotta" },
  schemaansvarig:  { label: "Schemaansvarig",  bg: "bg-amber/15",      text: "text-amber-700" },
  personal:        { label: "Personal",         bg: "bg-sage/15",       text: "text-sage" },
};

export default function RollerPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("Alla");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ empName: string; userId: number; empId: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, "saving" | "saved" | "error" | null>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [allEmps, allUsers] = await Promise.all([
        fetchEmployees(""),
        fetchUsers().catch(() => []),
      ]);
      setEmployees(allEmps);
      setUsers(allUsers);
    } catch {
      setErrorMessage("Kunde inte hämta data från servern.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getEmployeeUser = (empId: string) => users.find(u => u.employee_id === empId);

  const handleRoleChange = async (empId: string, userId: number, newRole: string) => {
    setSaveStatus(p => ({ ...p, [empId]: "saving" }));
    setErrorMessage(null);
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers(p => p.map(u => u.id === userId ? updated : u));
      setSaveStatus(p => ({ ...p, [empId]: "saved" }));
      setTimeout(() => setSaveStatus(p => ({ ...p, [empId]: null })), 2000);
    } catch (err: unknown) {
      setSaveStatus(p => ({ ...p, [empId]: "error" }));
      setErrorMessage(err instanceof Error ? err.message : "Kunde inte spara rolländringen.");
      setTimeout(() => setSaveStatus(p => ({ ...p, [empId]: null })), 4000);
    }
  };

  const handleSystemRoleChange = async (emp: Employee, user: UserOut | undefined, newRole: string) => {
    if (newRole === "none") {
      if (user) setConfirmDeleteUser({ empName: emp.name, userId: user.id, empId: emp.id });
      return;
    }
    if (!user) {
      setSaveStatus(p => ({ ...p, [emp.id]: "saving" }));
      setErrorMessage(null);
      try {
        // Hämta ett ledigt användarnamn baserat på namnet
        const username = await fetchSuggestUsername(emp.name);
        const created = await createUser({ username, full_name: emp.name, role: newRole, employee_id: emp.id });
        const invite = await getInviteToken(created.id);
        const url = `${window.location.origin}/invite/${invite.invite_token}`;
        try { await navigator.clipboard.writeText(url); setCopiedInvite(true); } catch { setCopiedInvite(false); }
        await loadData();
        setSaveStatus(p => ({ ...p, [emp.id]: "saved" }));
        setInviteUrl(url);
        setInviteName(emp.name);
        setTimeout(() => setSaveStatus(p => ({ ...p, [emp.id]: null })), 2000);
      } catch (err: unknown) {
        setSaveStatus(p => ({ ...p, [emp.id]: "error" }));
        setErrorMessage(err instanceof Error ? err.message : "Kunde inte skapa konto.");
        setTimeout(() => setSaveStatus(p => ({ ...p, [emp.id]: null })), 4000);
      }
    } else {
      await handleRoleChange(emp.id, user.id, newRole);
    }
  };

  const executeDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    const { empId, userId, empName } = confirmDeleteUser;
    setConfirmDeleteUser(null);
    setSaveStatus(p => ({ ...p, [empId]: "saving" }));
    try {
      await deleteUser(userId);
      await loadData();
      setSaveStatus(p => ({ ...p, [empId]: "saved" }));
      setTimeout(() => setSaveStatus(p => ({ ...p, [empId]: null })), 2000);
    } catch (err: unknown) {
      setSaveStatus(p => ({ ...p, [empId]: "error" }));
      setErrorMessage(err instanceof Error ? err.message : `Kunde inte ta bort kontot för ${empName}.`);
      setTimeout(() => setSaveStatus(p => ({ ...p, [empId]: null })), 4000);
    }
  };

  const handleAttributeChange = async (empId: string, changes: { contract_type?: string; is_dagansvarig?: boolean; is_planerare?: boolean }) => {
    setSaveStatus(p => ({ ...p, [empId]: "saving" }));
    setErrorMessage(null);
    try {
      const emp = employees.find(e => e.id === empId);
      if (emp && changes.contract_type) {
        if ((changes.contract_type === "kval" || changes.contract_type === "natt") && emp.is_dagansvarig) {
          changes.is_dagansvarig = false;
        }
        if (changes.contract_type === "vikarie" && emp.is_planerare) {
          changes.is_planerare = false;
        }
      }
      const updated = await updateEmployeeAttributes(empId, changes);
      setEmployees(p => p.map(e => e.id === empId ? updated : e));
      setSaveStatus(p => ({ ...p, [empId]: "saved" }));
      setTimeout(() => setSaveStatus(p => ({ ...p, [empId]: null })), 2000);
    } catch (err: unknown) {
      setSaveStatus(p => ({ ...p, [empId]: "error" }));
      setErrorMessage(err instanceof Error ? err.message : "Kunde inte spara ändringen.");
      setTimeout(() => setSaveStatus(p => ({ ...p, [empId]: null })), 4000);
    }
  };

  const filtered = employees
    .filter(e => groupFilter === "Alla" || e.group === groupFilter)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AuthGuard requiredRole="admin">
      <div className="min-h-screen bg-paper">

        {/* Header */}
        <div className="bg-white/70 backdrop-blur-sm border-b border-ink/8 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-ink-soft hover:text-ink text-sm transition-colors">← Dashboard</Link>
              <div className="w-px h-4 bg-ink/10" />
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-terracotta" />
                <h1 className="text-lg font-bold text-ink">Roller & Behörigheter</h1>
                <span className="text-xs text-ink-soft bg-cream px-2 py-0.5 rounded-full font-semibold">{employees.length} medarbetare</span>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-ink/10 hover:bg-cream rounded-xl transition text-ink-soft cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Uppdatera
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6 space-y-5">

          {/* Felmeddelande */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info-ruta */}
          <div className="bg-sage/10 border border-sage/25 rounded-2xl p-4 text-sm text-ink-soft leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-ink mb-1.5">
              <Sparkles size={15} className="text-terracotta" />
              Tre systemroller
            </div>
            <ul className="space-y-1 text-xs">
              <li><span className="font-semibold text-terracotta">Superadmin</span> — allt: schema, konton, attestering, alla grupper.</li>
              <li><span className="font-semibold text-amber-700">Schemaansvarig</span> — kör autoschema, redigerar, ser sin grupp. Kan inte skapa konton.</li>
              <li><span className="font-semibold text-sage">Personal</span> — ser bara sin egna sida och lägger önskeschema.</li>
            </ul>
            <p className="mt-2 text-xs text-ink-soft/70">Välj "Inget konto" i rullgardinslistan för att ta bort åtkomst. Välj en roll för att skapa konto — inbjudningslänk genereras automatiskt.</p>
          </div>

          {/* Sök + gruppfilter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50" />
              <input
                type="text"
                placeholder="Sök på namn…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-ink/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {GROUPS.map(g => (
                <button key={g} onClick={() => setGroupFilter(g)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    groupFilter === g ? "bg-terracotta text-white" : "bg-white border border-ink/10 text-ink-soft hover:bg-cream"
                  }`}
                >{g}</button>
              ))}
            </div>
          </div>

          {/* Tabell */}
          <div className="bg-white rounded-2xl border border-ink/8 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-ink-soft/50">
                <RefreshCw size={28} className="animate-spin mb-3" />
                <p className="text-sm">Hämtar medarbetare och konton…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-ink-soft/40">
                <Info size={36} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Inga medarbetare matchar filtret.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ink/8 bg-cream/60">
                    <th className="py-3 px-4 text-[10px] font-bold text-ink-soft uppercase tracking-wide">Medarbetare</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-ink-soft uppercase tracking-wide">Systemroll</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-ink-soft uppercase tracking-wide text-center">Dagansvarig</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-ink-soft uppercase tracking-wide text-center">Planerare</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-ink-soft uppercase tracking-wide">Kontrakt</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-ink-soft uppercase tracking-wide text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {filtered.map(emp => {
                    const user = getEmployeeUser(emp.id);
                    const status = saveStatus[emp.id];
                    const roleConf = user ? ROLE_LABELS[user.role] : null;

                    return (
                      <tr key={emp.id} className="hover:bg-cream/40 transition-colors">
                        {/* Namn */}
                        <td className="py-3 px-4">
                          <p className="font-semibold text-sm text-ink">{emp.name}</p>
                          <p className="text-[10px] text-ink-soft mt-0.5">{emp.group}</p>
                          {user && (
                            <p className="text-[10px] text-ink-soft/60 font-mono mt-0.5">{user.username}</p>
                          )}
                        </td>

                        {/* Roll */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={user ? user.role : "none"}
                              onChange={e => handleSystemRoleChange(emp, user, e.target.value)}
                              className={`text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-terracotta/40 font-medium transition cursor-pointer ${
                                user ? "bg-white border-ink/10 text-ink" : "bg-terracotta/5 border-terracotta/20 text-terracotta"
                              }`}
                            >
                              <option value="none">— Inget konto —</option>
                              <option value="personal">Personal</option>
                              <option value="schemaansvarig">Schemaansvarig</option>
                              <option value="superadmin">Superadmin</option>
                            </select>

                            {/* Rollbadge */}
                            {roleConf && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleConf.bg} ${roleConf.text}`}>
                                {roleConf.label}
                              </span>
                            )}

                            {/* Invite-knapp om ej accepterad */}
                            {user && !user.invite_accepted && (
                              <button
                                onClick={async () => {
                                  try {
                                    const invite = await getInviteToken(user.id);
                                    const url = `${window.location.origin}/invite/${invite.invite_token}`;
                                    await navigator.clipboard.writeText(url).catch(() => null);
                                    setCopiedInvite(true);
                                    setInviteUrl(url);
                                    setInviteName(emp.name);
                                  } catch (err: unknown) {
                                    setErrorMessage(err instanceof Error ? err.message : "Kunde inte hämta länk.");
                                  }
                                }}
                                className="px-2.5 py-1 bg-amber/10 hover:bg-amber/20 border border-amber/30 text-[10px] font-semibold text-amber-800 rounded-lg cursor-pointer transition shrink-0"
                              >
                                Inbjudningslänk
                              </button>
                            )}
                            {user && user.invite_accepted && (
                              <span className="text-[10px] text-sage font-semibold flex items-center gap-0.5">
                                <Check size={10} /> Aktivt
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Dagansvarig */}
                        <td className="py-3 px-4 text-center">
                          {emp.contract_type === "kval" || emp.contract_type === "natt" ? (
                            <div className="inline-block opacity-30 cursor-not-allowed" title="Kan inte väljas för kvälls- eller nattkontrakt.">
                              <ToggleLeft size={26} className="text-ink/20" />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAttributeChange(emp.id, { is_dagansvarig: !emp.is_dagansvarig })}
                              className="inline-block cursor-pointer"
                              title={emp.is_dagansvarig ? "Dagansvarig — klicka för att ta bort" : "Klicka för att göra dagansvarig"}
                            >
                              {emp.is_dagansvarig
                                ? <ToggleRight size={26} className="text-terracotta" />
                                : <ToggleLeft size={26} className="text-ink/20" />
                              }
                            </button>
                          )}
                        </td>

                        {/* Planerare */}
                        <td className="py-3 px-4 text-center">
                          {emp.contract_type === "vikarie" ? (
                            <div className="inline-block opacity-30 cursor-not-allowed" title="Kan inte väljas för vikarier.">
                              <ToggleLeft size={26} className="text-ink/20" />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAttributeChange(emp.id, { is_planerare: !emp.is_planerare })}
                              className="inline-block cursor-pointer"
                              title={emp.is_planerare ? "Planeringsansvarig — klicka för att ta bort" : "Klicka för att göra planeringsansvarig"}
                            >
                              {emp.is_planerare
                                ? <ToggleRight size={26} className="text-terracotta" />
                                : <ToggleLeft size={26} className="text-ink/20" />
                              }
                            </button>
                          )}
                        </td>

                        {/* Kontrakt */}
                        <td className="py-3 px-4">
                          <select
                            value={emp.contract_type}
                            onChange={e => handleAttributeChange(emp.id, { contract_type: e.target.value })}
                            className="text-xs bg-cream/50 border border-ink/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-terracotta/40 text-ink cursor-pointer"
                          >
                            {CONTRACTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-right">
                          {status === "saving" && <RefreshCw size={14} className="text-ink-soft/40 animate-spin ml-auto" />}
                          {status === "saved" && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <Check size={8} /> Sparat
                            </span>
                          )}
                          {status === "error" && (
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Fel</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Modal: Inbjudningslänk ── */}
        {inviteUrl && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl border border-ink/8 shadow-2xl w-full max-w-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-terracotta/10 rounded-full flex items-center justify-center">
                    <UserCheck className="text-terracotta" size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">Konto skapat!</h3>
                    <p className="text-xs text-ink-soft">Inbjudningslänk för {inviteName}</p>
                  </div>
                </div>
                <button onClick={() => { setInviteUrl(null); setInviteName(null); }} className="text-ink-soft hover:text-ink p-1">
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-ink-soft mb-4 leading-relaxed">
                Skicka denna länk till medarbetaren — de öppnar den och väljer sitt lösenord.
              </p>

              <div className="bg-cream border border-ink/10 p-3 rounded-xl flex items-center gap-2 mb-4">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 bg-transparent text-xs outline-none text-ink font-mono"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteUrl);
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2000);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    copiedInvite ? "bg-sage text-white" : "bg-terracotta hover:bg-clay text-white"
                  }`}
                >
                  {copiedInvite ? "Kopierad!" : "Kopiera"}
                </button>
              </div>

              <button
                onClick={() => { setInviteUrl(null); setInviteName(null); }}
                className="w-full bg-cream hover:bg-ink/5 text-ink py-2.5 rounded-xl text-sm font-medium transition cursor-pointer"
              >
                Stäng
              </button>
            </div>
          </div>
        )}

        {/* ── Modal: Bekräfta radering ── */}
        {confirmDeleteUser && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl border border-ink/8 shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-base font-bold text-ink mb-2">Ta bort konto?</h3>
              <p className="text-sm text-ink-soft mb-5 leading-relaxed">
                <strong>{confirmDeleteUser.empName}</strong> kan inte längre logga in. Deras schemalagda pass och profil påverkas inte.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteUser(null)}
                  className="flex-1 border border-ink/10 text-ink-soft py-2.5 rounded-xl text-sm font-medium hover:bg-cream transition cursor-pointer">
                  Avbryt
                </button>
                <button onClick={executeDeleteUser}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer">
                  Ta bort
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
