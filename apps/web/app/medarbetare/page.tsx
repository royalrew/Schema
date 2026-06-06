"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import Link from "next/link";
import { fetchEmployees, deleteEmployee, fetchUsers, createUser, getInviteToken, type UserOut } from "@/lib/api";
import { MedarbetareModal } from "@/components/MedarbetareModal";
import { AuthGuard } from "@/components/AuthGuard";
import type { Employee } from "@/lib/types";

const CONTRACT_LABEL: Record<string, string> = {
  varierande:   "Varierande",
  dagtid:       "Dagtid",
  kval:         "Kväll",
  helg_fre_son: "Helg fre–sön",
  helg_lor_man: "Helg lör–mån",
  natt:         "Natt",
  vikarie:      "Vikarie",
};

const GROUPS = ["Alla", "Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

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

  useEffect(() => { load(); }, [load]);

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
      <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Tillbaka</Link>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              <h1 className="text-lg font-bold text-gray-900">Medarbetare</h1>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{employees.length} st</span>
            </div>
          </div>
          <button
            onClick={() => setModal("add")}
            className="flex items-center gap-2 bg-terracotta hover:bg-clay text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={15} /> Lägg till medarbetare
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {inviteStatus && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm">
            {inviteStatus}
          </div>
        )}
        {/* Sök + filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Sök på namn…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {GROUPS.map(g => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  groupFilter === g ? "bg-terracotta text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laddar…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Inga medarbetare hittades.</div>
        ) : (
          Object.entries(byGroup).sort().map(([grp, emps]) => (
            <div key={grp} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{grp}</span>
                <span className="text-xs text-gray-400">{emps.length} person{emps.length !== 1 ? "er" : ""}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {emps.map(emp => {
                  const user = users.find(u => u.employee_id === emp.id);
                  return (
                    <div key={emp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-xs text-gray-400">
                          {CONTRACT_LABEL[emp.contract_type] ?? emp.contract_type}
                          {emp.percentage && emp.percentage < 1.0 ? ` (${Math.round(emp.percentage * 100)} %)` : ""}
                        </p>
                      </div>

                      {/* Inlogg-status och inbjudan */}
                      <div className="shrink-0 flex items-center gap-2">
                        {user ? (
                          user.invite_accepted ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              Aktivt inlogg
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCopyInvite(emp.id, user.id, emp.name)}
                              className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition ${
                                copiedId === emp.id
                                  ? "bg-green-600 text-white"
                                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                              }`}
                            >
                              {copiedId === emp.id ? "Kopierad!" : "Kopiera länk"}
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleCreateUser(emp)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition"
                          >
                            Skapa inlogg
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                        <button
                          onClick={() => setModal(emp)}
                          className="p-2 text-gray-400 hover:text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors"
                          title="Redigera"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(emp)}
                          disabled={deleting === emp.id}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Ta bort"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: lägg till / redigera */}
      {modal && modal !== "add" && typeof modal === "object" && (
        <MedarbetareModal
          employee={modal}
          onSave={updated => {
            setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "add" && (
        <MedarbetareModal
          employee={null}
          onSave={added => {
            setEmployees(prev => [...prev, added]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Bekräfta borttagning */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Ta bort medarbetare?</h3>
            <p className="text-sm text-gray-600 mb-5">
              <strong>{confirmDelete.name}</strong> tas bort permanent. Schemalagda pass påverkas inte.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
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
