"use client";
import { useState, useCallback } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import type { Employee } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const CONSTRAINT_TYPES = [
  { value: "prefer_off", label: "Föredrar ledig", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "avoid",      label: "Undviker",       color: "bg-red-100 text-red-800 border-red-200" },
  { value: "prefer_work",label: "Föredrar jobba", color: "bg-green-100 text-green-800 border-green-200" },
];

const PARITY_OPTIONS = [
  { value: "all",  label: "Alla veckor" },
  { value: "odd",  label: "Udda veckor" },
  { value: "even", label: "Jämna veckor" },
];

export interface SoftConstraint {
  id: string;
  constraint_type: string;
  weekdays: number[];
  week_parity: string;
  note: string;
}

interface Props {
  employee: Employee;
  onUpdate?: (emp: Employee) => void;
}

function newConstraint(): SoftConstraint {
  return {
    id: crypto.randomUUID(),
    constraint_type: "prefer_off",
    weekdays: [],
    week_parity: "all",
    note: "",
  };
}

/**
 * Renders the Personkort (personnel card) component, which manages
 * recurring soft constraints (life patterns) for a specific employee.
 *
 * @param props - The component properties.
 * @param props.employee - The employee object.
 * @param props.onUpdate - Callback triggered when the employee's soft constraints are updated.
 * @returns The rendered Personkort component.
 */
export function Personkort({ employee, onUpdate }: Props) {
  const existing = (employee as unknown as { soft_constraints?: SoftConstraint[] }).soft_constraints ?? [];
  const [constraints, setConstraints] = useState<SoftConstraint[]>(existing);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/employees/${employee.id}/soft-constraints`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soft_constraints: constraints }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        const updated = await res.json();
        onUpdate?.(updated);
      }
    } finally {
      setSaving(false);
    }
  }, [employee.id, constraints, onUpdate]);

  function addConstraint() {
    setConstraints(prev => [...prev, newConstraint()]);
  }

  function removeConstraint(id: string) {
    setConstraints(prev => prev.filter(c => c.id !== id));
  }

  function updateConstraint(id: string, patch: Partial<SoftConstraint>) {
    setConstraints(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  function toggleDay(id: string, day: number) {
    setConstraints(prev => prev.map(c => {
      if (c.id !== id) return c;
      const days = c.weekdays.includes(day)
        ? c.weekdays.filter(d => d !== day)
        : [...c.weekdays, day].sort();
      return { ...c, weekdays: days };
    }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Personkort — {employee.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Återkommande livsmönster som systemet tar hänsyn till varje månad
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
        >
          <Save size={12} />
          {saving ? "Sparar…" : saved ? "Sparat!" : "Spara"}
        </button>
      </div>

      {/* Constraints */}
      <div className="divide-y divide-gray-100">
        {constraints.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            Inga livsmönster inlagda. Klicka "+ Lägg till" för att börja.
          </p>
        )}

        {constraints.map(c => {
          const typeInfo = CONSTRAINT_TYPES.find(t => t.value === c.constraint_type) ?? CONSTRAINT_TYPES[0];
          return (
            <div key={c.id} className="px-4 py-3 space-y-2 border-b border-gray-100 last:border-b-0 bg-white">
              {/* Header row: Label/Icon and Delete button */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Livsmönster</span>
                <button
                  onClick={() => removeConstraint(c.id)}
                  className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                  title="Ta bort"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Grid for Selects */}
              <div className="grid grid-cols-2 gap-2">
                {/* Typ */}
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Typ</p>
                  <select
                    value={c.constraint_type}
                    onChange={e => updateConstraint(c.id, { constraint_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white text-gray-700"
                  >
                    {CONSTRAINT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Veckor */}
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Vilka veckor</p>
                  <select
                    value={c.week_parity}
                    onChange={e => updateConstraint(c.id, { week_parity: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white text-gray-700"
                  >
                    {PARITY_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notering */}
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Förklaring</p>
                <input
                  type="text"
                  placeholder="t.ex. Barn varannan vecka, Golf lördagar"
                  value={c.note}
                  onChange={e => updateConstraint(c.id, { note: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                />
              </div>

              {/* Dagar */}
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Veckodagar</p>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_NAMES.map((name, idx) => {
                    const selected = c.weekdays.includes(idx);
                    const isWe = idx >= 5;
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleDay(c.id, idx)}
                        className={`py-1 rounded-md text-xs font-medium transition-colors border text-center ${
                          selected
                            ? c.constraint_type === "prefer_off" || c.constraint_type === "avoid"
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-green-500 text-white border-green-500"
                            : isWe
                              ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sammanfattning */}
              {c.weekdays.length > 0 && c.note && (
                <div className={`flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${typeInfo.color}`}>
                  <span className="font-medium">{typeInfo.label}:</span>
                  <span>{c.note}</span>
                  <span className="opacity-60">
                    ({c.weekdays.map(d => DAY_NAMES[d]).join(", ")},
                    {" "}{PARITY_OPTIONS.find(p => p.value === c.week_parity)?.label.toLowerCase()})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lägg till */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={addConstraint}
          className="flex items-center gap-1.5 text-sm text-terracotta hover:text-clay font-medium"
        >
          <Plus size={14} /> Lägg till livsmönster
        </button>
      </div>
    </div>
  );
}
