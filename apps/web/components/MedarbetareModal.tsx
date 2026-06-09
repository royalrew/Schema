"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";
import {
  saveEmployee,
  createUser,
  deleteUser,
  updateUserRole,
  getInviteToken,
  fetchSuggestUsername,
  type UserOut
} from "@/lib/api";
import type { Employee } from "@/lib/types";

const GROUPS = ["Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

const CONTRACT_TYPES = [
  { value: "varierande",   label: "Varierande (37h/v)" },
  { value: "dagtid",       label: "Dagtid (40h/v, mån–fre)" },
  { value: "kval",         label: "Kväll (30h/v)" },
  { value: "helg_fre_man", label: "Helg fre–mån (26h/v)" },
  { value: "natt",         label: "Natt (34,33h/v)" },
  { value: "vikarie",      label: "Vikarie (Vid behov)" },
];

interface Props {
  employee?: Employee | null;  // null = ny medarbetare
  user?: UserOut | null;       // matchande användare
  onSave: (emp: Employee, inviteUrl?: string | null, inviteName?: string | null) => void;
  onClose: () => void;
}

function generateId(): string {
  return "EMP_" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Renders the MedarbetareModal component, which handles adding or editing
 * an employee profile, including their contract type, scheduling constraints,
 * and system role access/credentials.
 *
 * @param props - The component properties.
 * @param props.employee - The employee object to edit, or null to add a new employee.
 * @param props.user - The associated user account object, if any.
 * @param props.onSave - Callback triggered when the employee and account are saved.
 * @param props.onClose - Callback triggered to close the modal.
 * @returns The rendered MedarbetareModal component.
 */
export function MedarbetareModal({ employee, user, onSave, onClose }: Props) {
  const isNew = !employee;
  const [name, setName] = useState(employee?.name ?? "");
  const [group, setGroup] = useState(employee?.group ?? "Norra");
  const [contractType, setContractType] = useState(employee?.contract_type ?? "varierande");
  const [isDagansvarig, setIsDagansvarig] = useState(employee?.is_dagansvarig ?? false);
  const [isPlanerare, setIsPlanerare] = useState(employee?.is_planerare ?? false);
  const [percentage, setPercentage] = useState(employee?.percentage ? employee.percentage * 100 : 100);
  const [targetDays, setTargetDays] = useState<number | "">(employee?.target_days_per_month ?? "");
  const [targetEvenings, setTargetEvenings] = useState<number | "">(employee?.target_evenings_per_month ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDagansvarigDisabled = contractType === "kval" || contractType === "natt";

  async function handleSave() {
    if (!name.trim()) { setError("Namn krävs"); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveEmployee({
        id: employee?.id ?? generateId(),
        name: name.trim(),
        group: group as Employee["group"],
        contract_type: contractType as Employee["contract_type"],
        is_dagansvarig: isDagansvarigDisabled ? false : isDagansvarig,
        is_planerare: contractType === "vikarie" ? false : isPlanerare,
        percentage: percentage / 100,
        target_days_per_month: contractType === "varierande" && targetDays !== "" ? Number(targetDays) : null,
        target_evenings_per_month: contractType === "varierande" && targetEvenings !== "" ? Number(targetEvenings) : null,
      } as Parameters<typeof saveEmployee>[0]);

      // Hantera användarkonto och systemroll
      let finalInviteUrl: string | null = null;
      if (user) {
        if (role === "none") {
          // Radera konto
          await deleteUser(user.id);
        } else if (role !== user.role) {
          // Uppdatera roll
          await updateUserRole(user.id, role);
        }
      } else {
        if (role !== "none") {
          // Skapa nytt konto
          const username = await fetchSuggestUsername(name.trim());
          const created = await createUser({
            username,
            full_name: name.trim(),
            role,
            employee_id: saved.id
          });
          const invite = await getInviteToken(created.id);
          finalInviteUrl = `${window.location.origin}/invite/${invite.invite_token}`;
        }
      }

      onSave(saved, finalInviteUrl, name.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {isNew ? "Lägg till medarbetare" : `Redigera — ${employee!.name}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form Body - scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Namn
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="För- och efternamn"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Grupp
              </label>
              <select
                value={group}
                onChange={e => setGroup(e.target.value as Employee["group"])}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
              >
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Tjänstgöringsgrad (%)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={percentage}
                onChange={e => setPercentage(Number(e.target.value))}
                placeholder="T.ex. 50, 75, 100"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Anställningsform
            </label>
            <select
              value={contractType}
              onChange={e => setContractType(e.target.value as Employee["contract_type"])}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
            >
              {CONTRACT_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {contractType === "varierande" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Önskade dagar/mån (mjuk)
                </label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={targetDays}
                  onChange={e => setTargetDays(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Mål antal dagar"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Önskade kvällar/mån (mjuk)
                </label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={targetEvenings}
                  onChange={e => setTargetEvenings(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Mål antal kvällar"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
                />
              </div>
            </div>
          )}

          {/* Systemroll */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Systemroll (Inloggning)
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white text-gray-700"
            >
              <option value="none">— Inget konto / Ingen inloggning —</option>
              <option value="personal">Personal (Endast se egna turer)</option>
              <option value="schemaansvarig">Schemaansvarig (Administrera gruppschema)</option>
              <option value="superadmin">Superadmin (Alla rättigheter)</option>
            </select>
          </div>

          {/* Kontostatus & inbjudan */}
          {user && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-600">Kontostatus:</span>
                {user.invite_accepted ? (
                  <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded-full">Aktivt konto ({user.username})</span>
                ) : (
                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">Väntar på inloggning</span>
                )}
              </div>

              {!user.invite_accepted && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const invite = await getInviteToken(user.id);
                      const url = `${window.location.origin}/invite/${invite.invite_token}`;
                      await navigator.clipboard.writeText(url).catch(() => null);
                      alert("Inbjudningslänk kopierad till urklipp!");
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : "Kunde inte hämta länk");
                    }
                  }}
                  className="w-full py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold rounded-lg text-center transition cursor-pointer"
                >
                  Kopiera inbjudningslänk
                </button>
              )}

              {user.invite_accepted && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const invite = await getInviteToken(user.id);
                      const url = `${window.location.origin}/invite/${invite.invite_token}`;
                      await navigator.clipboard.writeText(url).catch(() => null);
                      alert("Återställningslänk för lösenord kopierad till urklipp!");
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : "Kunde inte hämta länk");
                    }
                  }}
                  className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-semibold rounded-lg text-center transition cursor-pointer"
                >
                  Generera återställningslänk
                </button>
              )}
            </div>
          )}

          {/* Dagansvarig */}
          <label className={`flex items-start gap-3 p-3 rounded-xl border border-gray-200 transition-colors ${
            isDagansvarigDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:bg-gray-50"
          }`}>
            <input
              type="checkbox"
              checked={isDagansvarigDisabled ? false : isDagansvarig}
              disabled={isDagansvarigDisabled}
              onChange={e => setIsDagansvarig(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-terracotta focus:ring-terracotta/40 accent-terracotta disabled:opacity-50"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Dagansvarig</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isDagansvarigDisabled 
                  ? "Kan inte väljas för kvälls- eller nattkontrakt."
                  : "Jobbar alltid dag (06:45 eller 07:00) — aldrig kväll eller natt"
                }
              </p>
            </div>
          </label>

          {/* Planeringsansvarig */}
          <label className={`flex items-start gap-3 p-3 rounded-xl border border-gray-200 transition-colors ${
            contractType === "vikarie" ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:bg-gray-50"
          }`}>
            <input
              type="checkbox"
              checked={contractType === "vikarie" ? false : isPlanerare}
              disabled={contractType === "vikarie"}
              onChange={e => setIsPlanerare(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-terracotta focus:ring-terracotta/40 accent-terracotta disabled:opacity-50"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Planeringsansvarig</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {contractType === "vikarie"
                  ? "Kan inte väljas för vikarier."
                  : "Har prioritet på planeringstid vid överkapacitet i schemat."
                }
              </p>
            </div>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Knappar */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Save size={14} />
            {saving ? "Sparar…" : isNew ? "Lägg till" : "Spara ändringar"}
          </button>
        </div>
      </div>
    </div>
  );
}
