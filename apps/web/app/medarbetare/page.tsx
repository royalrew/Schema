"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  ToggleLeft,
  ToggleRight,
  Check,
  Shield,
  Calendar,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import {
  fetchEmployees,
  deleteEmployee,
  fetchUsers,
  createUser,
  getInviteToken,
  updateEmployeeAttributes,
  updateUserRole,
  deleteUser,
  fetchSuggestUsername,
  type UserOut
} from "@/lib/api";
import { MedarbetareModal } from "@/components/MedarbetareModal";
import { AuthGuard } from "@/components/AuthGuard";
import type { Employee } from "@/lib/types";

const CONTRACT_LABEL: Record<string, string> = {
  varierande:   "Varierande",
  dagtid:       "Dagtid",
  kval:         "Kväll",
  helg_fre_man: "Helg fre–mån",
  natt:         "Natt",
  vikarie:      "Vikarie",
};

const GROUPS = ["Alla", "Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  superadmin:      { label: "Superadmin",      bg: "bg-terracotta/15", text: "text-terracotta" },
  schemaansvarig:  { label: "Schemaansvarig",  bg: "bg-amber/15",      text: "text-amber-700" },
  personal:        { label: "Personal",         bg: "bg-sage/15",       text: "text-sage" },
};

/**
 * Renders the MedarbetarePage component, which serves as the primary dashboard
 * for managing staff profiles, system access roles, contracts, and credentials.
 *
 * @returns The rendered MedarbetarePage component.
 */
export default function MedarbetarePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("Alla");
  const [modal, setModal] = useState<"add" | Employee | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
  
  // States för inline roll- och attributredigering
  const [saveStatus, setSaveStatus] = useState<Record<string, "saving" | "saved" | "error" | null>>({});
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ empName: string; userId: number; empId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, usrs] = await Promise.all([
        fetchEmployees(""),
        fetchUsers().catch(() => []),
      ]);
      setEmployees(all);
      setUsers(usrs);
    } catch {
      // Tyst fel
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAttributeChange = async (
    empId: string,
    changes: { contract_type?: string; is_dagansvarig?: boolean; is_planerare?: boolean }
  ) => {
    setSaveStatus(prev => ({ ...prev, [empId]: "saving" }));
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
      setEmployees(prev => prev.map(e => e.id === empId ? updated : e));
      setSaveStatus(prev => ({ ...prev, [empId]: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: null })), 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [empId]: "error" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: null })), 4000);
    }
  };

  const handleRoleChange = async (empId: string, userId: number, newRole: string) => {
    setSaveStatus(prev => ({ ...prev, [empId]: "saving" }));
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
      setSaveStatus(prev => ({ ...prev, [empId]: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: null })), 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [empId]: "error" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: null })), 4000);
    }
  };

  const handleSystemRoleChange = async (emp: Employee, user: UserOut | undefined, newRole: string) => {
    if (newRole === "none") {
      if (user) {
        setConfirmDeleteUser({ empName: emp.name, userId: user.id, empId: emp.id });
      }
      return;
    }
    if (!user) {
      setSaveStatus(prev => ({ ...prev, [emp.id]: "saving" }));
      try {
        const username = await fetchSuggestUsername(emp.name);
        const created = await createUser({ username, full_name: emp.name, role: newRole, employee_id: emp.id });
        const invite = await getInviteToken(created.id);
        const url = `${window.location.origin}/invite/${invite.invite_token}`;
        await navigator.clipboard.writeText(url).catch(() => null);
        setInviteStatus(`Konto skapat! Inbjudningslänk för ${emp.name} har kopierats till urklipp.`);
        setTimeout(() => setInviteStatus(null), 5000);
        await load();
        setSaveStatus(prev => ({ ...prev, [emp.id]: "saved" }));
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [emp.id]: null })), 2000);
      } catch {
        setSaveStatus(prev => ({ ...prev, [emp.id]: "error" }));
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [emp.id]: null })), 4000);
      }
    } else {
      await handleRoleChange(emp.id, user.id, newRole);
    }
  };

  const executeDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    const { empId, userId } = confirmDeleteUser;
    setConfirmDeleteUser(null);
    setSaveStatus(prev => ({ ...prev, [empId]: "saving" }));
    try {
      await deleteUser(userId);
      await load();
      setSaveStatus(prev => ({ ...prev, [empId]: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: null })), 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [empId]: "error" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [empId]: null })), 4000);
    }
  };

  function makeUsername(name: string): string {
    return name
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9.]/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "");
  }

  async function handleCreateUser(emp: Employee) {
    setInviteStatus(`Skapar inlogg för ${emp.name}...`);
    try {
      const username = makeUsername(emp.name);
      const created = await createUser({
        username,
        full_name: emp.name,
        role: "personal",
        employee_id: emp.id,
      });
      const invite = await getInviteToken(created.id);
      const url = `${window.location.origin}/invite/${invite.invite_token}`;
      await navigator.clipboard.writeText(url);
      setInviteStatus(`Konto skapat! Inbjudningslänk för ${emp.name} har kopierats till urklipp.`);
      setTimeout(() => setInviteStatus(null), 5000);
      load();
    } catch (e: unknown) {
      setInviteStatus(e instanceof Error ? e.message : "Kunde inte skapa inlogg");
      setTimeout(() => setInviteStatus(null), 4000);
    }
  }

  async function handleCopyInvite(empId: string, userId: number, name: string) {
    try {
      const invite = await getInviteToken(userId);
      const url = `${window.location.origin}/invite/${invite.invite_token}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(empId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setInviteStatus(`Kunde inte kopiera länk för ${name}`);
      setTimeout(() => setInviteStatus(null), 3000);
    }
  }

  const filtered = employees
    .filter(e => groupFilter === "Alla" || e.group === groupFilter)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  // Gruppera för visning
  const byGroup: Record<string, Employee[]> = {};
  for (const e of filtered) {
    if (!byGroup[e.group]) byGroup[e.group] = [];
    byGroup[e.group].push(e);
  }

  async function handleDelete(emp: Employee) {
    setDeleting(emp.id);
    setConfirmDelete(null);
    try {
      await deleteEmployee(emp.id);
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AuthGuard requiredRole="admin">
      <div className="min-h-screen bg-paper pb-12">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Tillbacka</Link>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <h1 className="text-lg font-bold text-gray-900">Personal & Behörigheter</h1>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{employees.length} st</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl transition text-gray-500 cursor-pointer"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Uppdatera
              </button>
              <button
                onClick={() => setModal("add")}
                className="flex items-center gap-2 bg-terracotta hover:bg-clay text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <Plus size={15} /> Lägg till medarbetare
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6 space-y-4">
          {inviteStatus && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm">
              {inviteStatus}
            </div>
          )}

          {/* Info-ruta */}
          <div className="bg-sage/10 border border-sage/20 rounded-2xl p-4 text-xs text-gray-600 leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-gray-900 mb-1.5">
              <Sparkles size={14} className="text-terracotta" />
              Tre systemroller
            </div>
            <ul className="space-y-1">
              <li><span className="font-semibold text-terracotta">Superadmin</span> — Fulla rättigheter: schema, konton, attestering, alla grupper.</li>
              <li><span className="font-semibold text-amber-700">Schemaansvarig</span> — Hanterar schemat, kör autoschema och gör manuella justeringar för sin grupp.</li>
              <li><span className="font-semibold text-sage">Personal</span> — Kan endast logga in för att se sitt eget arbetsschema samt lägga in önskemål och veton.</li>
            </ul>
            <p className="mt-2 text-[10px] text-gray-400">Genom att byta roll eller slå på toggles sparas ändringarna direkt på servern.</p>
          </div>

          {/* Sök + filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Sök på namn…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {GROUPS.map(g => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    groupFilter === g ? "bg-terracotta text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Lista grupperade i tabeller */}
          {loading && employees.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Laddar…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Inga medarbetare hittades.</div>
          ) : (
            Object.entries(byGroup).sort().map(([grp, emps]) => (
              <div key={grp} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">{grp}</span>
                  <span className="text-xs text-gray-400 font-medium">{emps.length} person{emps.length !== 1 ? "er" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] uppercase font-bold text-gray-400">
                        <th className="py-3 px-5">Medarbetare</th>
                        <th className="py-3 px-5">Kontrakt</th>
                        <th className="py-3 px-5">Systemroll</th>
                        <th className="py-3 px-5 text-center">Dagansvarig</th>
                        <th className="py-3 px-5 text-center">Planerare</th>
                        <th className="py-3 px-5">Inloggning</th>
                        <th className="py-3 px-5 text-right">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs md:text-sm">
                      {emps.map(emp => {
                        const user = users.find(u => u.employee_id === emp.id);
                        const status = saveStatus[emp.id];
                        const roleConf = user ? ROLE_LABELS[user.role] : null;

                        return (
                          <tr key={emp.id} className="hover:bg-gray-50/40 transition-colors">
                            {/* Namn & Kalenderlänk */}
                            <td className="py-3.5 px-5">
                              <Link
                                href={`/personal/${emp.id}`}
                                className="font-semibold text-gray-900 hover:text-terracotta hover:underline transition-colors flex items-center gap-1.5"
                                title="Öppna personlig kalender"
                              >
                                <Calendar size={13} className="text-gray-400" />
                                {emp.name}
                              </Link>
                              {user && (
                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{user.username}</p>
                              )}
                            </td>

                            {/* Kontrakt & % */}
                            <td className="py-3.5 px-5 text-gray-600">
                              <p className="font-medium">
                                {CONTRACT_LABEL[emp.contract_type] ?? emp.contract_type}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {emp.percentage ? `${Math.round(emp.percentage * 100)} %` : "100 %"}
                              </p>
                            </td>

                            {/* Systemroll */}
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={user ? user.role : "none"}
                                  onChange={e => handleSystemRoleChange(emp, user, e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-terracotta/40 bg-white font-medium text-gray-700 cursor-pointer"
                                >
                                  <option value="none">— Inget konto —</option>
                                  <option value="personal">Personal</option>
                                  <option value="schemaansvarig">Schemaansvarig</option>
                                  <option value="superadmin">Superadmin</option>
                                </select>
                                {roleConf && (
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${roleConf.bg} ${roleConf.text}`}>
                                    {roleConf.label}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Dagansvarig */}
                            <td className="py-3.5 px-5 text-center">
                              {emp.contract_type === "kval" || emp.contract_type === "natt" ? (
                                <div className="inline-block opacity-25 cursor-not-allowed" title="Kan ej tilldelas kvälls- eller nattkontrakt">
                                  <ToggleLeft size={22} className="text-gray-300 mx-auto" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAttributeChange(emp.id, { is_dagansvarig: !emp.is_dagansvarig })}
                                  className="inline-block cursor-pointer focus:outline-none"
                                  title={emp.is_dagansvarig ? "Ta bort dagansvar" : "Gör till dagansvarig"}
                                >
                                  {emp.is_dagansvarig ? (
                                    <ToggleRight size={22} className="text-terracotta mx-auto" />
                                  ) : (
                                    <ToggleLeft size={22} className="text-gray-300 mx-auto" />
                                  )}
                                </button>
                              )}
                            </td>

                            {/* Planerare */}
                            <td className="py-3.5 px-5 text-center">
                              {emp.contract_type === "vikarie" ? (
                                <div className="inline-block opacity-25 cursor-not-allowed" title="Kan ej tilldelas vikarier">
                                  <ToggleLeft size={22} className="text-gray-300 mx-auto" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAttributeChange(emp.id, { is_planerare: !emp.is_planerare })}
                                  className="inline-block cursor-pointer focus:outline-none"
                                  title={emp.is_planerare ? "Ta bort planeringsroll" : "Gör till planeringsansvarig"}
                                >
                                  {emp.is_planerare ? (
                                    <ToggleRight size={22} className="text-terracotta mx-auto" />
                                  ) : (
                                    <ToggleLeft size={22} className="text-gray-300 mx-auto" />
                                  )}
                                </button>
                              )}
                            </td>

                            {/* Inloggning / Länk */}
                            <td className="py-3.5 px-5">
                              {user ? (
                                user.invite_accepted ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                    <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                                    Aktivt
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleCopyInvite(emp.id, user.id, emp.name)}
                                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition ${
                                      copiedId === emp.id
                                        ? "bg-green-600 border-green-600 text-white"
                                        : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                    }`}
                                  >
                                    {copiedId === emp.id ? "Kopierad!" : "Kopiera länk"}
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={() => handleCreateUser(emp)}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition"
                                >
                                  Skapa inlogg
                                </button>
                              )}
                            </td>

                            {/* Åtgärder & Status */}
                            <td className="py-3.5 px-5">
                              <div className="flex items-center justify-end gap-1.5">
                                {status === "saving" && <RefreshCw size={11} className="text-gray-400 animate-spin" />}
                                {status === "saved" && (
                                  <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                                    Sparat
                                  </span>
                                )}
                                {status === "error" && (
                                  <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                    Fel
                                  </span>
                                )}

                                <div className="w-px h-3 bg-gray-200 mx-1" />

                                <button
                                  onClick={() => setModal(emp)}
                                  className="p-1.5 text-gray-400 hover:text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors cursor-pointer"
                                  title="Redigera fullständig profil"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(emp)}
                                  disabled={deleting === emp.id}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Ta bort medarbetare"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Lägg till / Redigera profil */}
        {modal && modal !== "add" && typeof modal === "object" && (
          <MedarbetareModal
            employee={modal}
            user={users.find(u => u.employee_id === modal.id)}
            onSave={(updated, inviteUrl, inviteName) => {
              setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
              if (inviteUrl) {
                setInviteStatus(`Konto skapat! Inbjudningslänk för ${inviteName} har kopierats till urklipp.`);
                navigator.clipboard.writeText(inviteUrl).catch(() => null);
                setTimeout(() => setInviteStatus(null), 7000);
              }
              setModal(null);
              load();
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "add" && (
          <MedarbetareModal
            employee={null}
            onSave={(added, inviteUrl, inviteName) => {
              setEmployees(prev => [...prev, added]);
              if (inviteUrl) {
                setInviteStatus(`Konto skapat! Inbjudningslänk för ${inviteName} har kopierats till urklipp.`);
                navigator.clipboard.writeText(inviteUrl).catch(() => null);
                setTimeout(() => setInviteStatus(null), 7000);
              }
              setModal(null);
              load();
            }}
            onClose={() => setModal(null)}
          />
        )}

        {/* Bekräfta borttagning av medarbetare */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-base font-bold text-gray-900 mb-2">Ta bort medarbetare?</h3>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                <strong>{confirmDelete.name}</strong> tas bort permanent från systemet. Det går inte att ångra. Schemalagda pass påverkas inte.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Ta bort
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bekräfta borttagning av konto (Inget konto) */}
        {confirmDeleteUser && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-base font-bold text-gray-900 mb-2">Ta bort konto?</h3>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                Vill du ta bort inloggningskontot för <strong>{confirmDeleteUser.empName}</strong>? 
                De kommer inte längre att kunna logga in. Medarbetarprofilen och schemat påverkas inte.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeleteUser(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  onClick={executeDeleteUser}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Ta bort konto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
