"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";
import { saveEmployee } from "@/lib/api";
import type { Employee } from "@/lib/types";

const GROUPS = ["Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

const CONTRACT_TYPES = [
  { value: "varierande",   label: "Varierande (37h/v)" },
  { value: "dagtid",       label: "Dagtid (40h/v, mån–fre)" },
  { value: "kval",         label: "Kväll (30h/v)" },
  { value: "helg_fre_son", label: "Helg fre–sön (26h/v)" },
  { value: "helg_lor_man", label: "Helg lör–mån (26h/v)" },
  { value: "natt",         label: "Natt (34,33h/v)" },
  { value: "vikarie",      label: "Vikarie (Vid behov)" },
];

interface Props {
  employee?: Employee | null;  // null = ny medarbetare
  onSave: (emp: Employee) => void;
  onClose: () => void;
}

function generateId(): string {
  return "EMP_" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function MedarbetareModal({ employee, onSave, onClose }: Props) {
  const isNew = !employee;
  const [name, setName] = useState(employee?.name ?? "");
  const [group, setGroup] = useState(employee?.group ?? "Norra");
  const [contractType, setContractType] = useState(employee?.contract_type ?? "varierande");
  const [isDagansvarig, setIsDagansvarig] = useState(employee?.is_dagansvarig ?? false);
  const [isPlanerare, setIsPlanerare] = useState(employee?.is_planerare ?? false);
  const [percentage, setPercentage] = useState(employee?.percentage ? employee.percentage * 100 : 100);
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
      } as Parameters<typeof saveEmployee>[0]);
      onSave(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isNew ? "Lägg till medarbetare" : `Redigera — ${employee!.name}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Grupp
            </label>
            <select
              value={group}
              onChange={e => setGroup(e.target.value as Employee["group"])}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            >
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Anställningsform
            </label>
            <select
              value={contractType}
              onChange={e => setContractType(e.target.value as Employee["contract_type"])}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            >
              {CONTRACT_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>

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
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
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
