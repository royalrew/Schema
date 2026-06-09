"use client";
import { useState, useCallback } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import type { Employee } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

const ABSENCE_TYPES = [
  { value: "sem",  label: "Semester",               color: "bg-orange-400",  text: "text-white" },
  { value: "FL",   label: "Föräldraledighet",        color: "bg-orange-300",  text: "text-white" },
  { value: "TJL",  label: "Tjänstledighet",          color: "bg-amber-400",   text: "text-white" },
  { value: "VAB",  label: "Vård av barn (VAB)",      color: "bg-sky-400",     text: "text-white" },
  { value: "KOM",  label: "Kompledig",               color: "bg-teal-400",    text: "text-white" },
  { value: "STU",  label: "Studieledighet",          color: "bg-indigo-400",  text: "text-white" },
  { value: "UTB",  label: "Utbildning",              color: "bg-violet-500",  text: "text-white" },
  { value: "sjuk", label: "Sjukskrivning (långtid)", color: "bg-red-500",     text: "text-white" },
];

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
}

interface Props {
  employee: Employee;
  onUpdate: (emp: Employee) => void;
}

function toperiods(absences: Employee["absences"]): Period[] {
  if (!absences?.length) return [];
  const sorted = [...absences].sort((a, b) =>
    (a.date as unknown as string).localeCompare(b.date as unknown as string)
  );
  const periods: Period[] = [];
  let cur: Period | null = null;

  for (const a of sorted) {
    const dateStr = a.date as unknown as string;
    const atype = a.absence_type as unknown as string;
    if (cur && cur.absence_type === atype) {
      const prevDate: Date = new Date(cur.end_date);
      const nextDate: Date = new Date(dateStr);
      nextDate.setDate(nextDate.getDate() - 1);
      if (prevDate.toISOString().slice(0, 10) === nextDate.toISOString().slice(0, 10)
        || prevDate.toISOString().slice(0, 10) === dateStr) {
        cur.end_date = dateStr;
        continue;
      }
    }
    if (cur) periods.push(cur);
    cur = { id: dateStr, start_date: dateStr, end_date: dateStr, absence_type: atype };
  }
  if (cur) periods.push(cur);
  return periods;
}

/**
 * Renders the FranvaroManager component, allowing management of
 * employee absences (vacation, parental leave, sick leave, etc.).
 *
 * @param props - The component properties.
 * @param props.employee - The employee object containing current absences.
 * @param props.onUpdate - Callback triggered when the absences are updated.
 * @returns The rendered FranvaroManager component.
 */
export function FranvaroManager({ employee, onUpdate }: Props) {
  const [periods, setPeriods] = useState<Period[]>(() =>
    toperiods(employee.absences as Employee["absences"])
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addPeriod() {
    const today = new Date().toISOString().slice(0, 10);
    setPeriods(prev => [...prev, {
      id: crypto.randomUUID(),
      start_date: today,
      end_date: today,
      absence_type: "sem",
    }]);
    setSaved(false);
  }

  function removePeriod(id: string) {
    setPeriods(prev => prev.filter(p => p.id !== id));
    setSaved(false);
  }

  function updatePeriod(id: string, patch: Partial<Period>) {
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    setSaved(false);
  }

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/employees/${employee.id}/absences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods }),
      });
      if (res.ok) {
        const updated: Employee = await res.json();
        onUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [employee.id, periods, onUpdate]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Frånvaro</h3>
          <p className="text-xs text-gray-400 mt-0.5">Semester, föräldraledighet och längre frånvaro</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
        >
          <Save size={12} />
          {saving ? "Sparar…" : saved ? "Sparat!" : "Spara"}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {periods.length === 0 && (
          <p className="px-4 py-5 text-sm text-gray-400 text-center">Ingen frånvaro registrerad.</p>
        )}

        {periods.map(p => {
          const typeInfo = ABSENCE_TYPES.find(t => t.value === p.absence_type) ?? ABSENCE_TYPES[0];
          const start = new Date(p.start_date);
          const end = new Date(p.end_date);
          const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

          return (
            <div key={p.id} className="px-4 py-3 space-y-2 border-b border-gray-100 last:border-b-0 bg-white">
              {/* Header: Typ dropdown till vänster, Dagar och Radera till höger */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <select
                    value={p.absence_type}
                    onChange={e => updatePeriod(p.id, { absence_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white font-medium text-gray-700"
                  >
                    {ABSENCE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${typeInfo.color} ${typeInfo.text}`}>
                    {days} dag{days !== 1 ? "ar" : ""}
                  </span>
                  <button
                    onClick={() => removePeriod(p.id)}
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                    title="Ta bort"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Datumintervall: Från och med till vänster, Till och med till höger */}
              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Från och med</p>
                  <input
                    type="date"
                    value={p.start_date}
                    onChange={e => updatePeriod(p.id, { start_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">Till och med</p>
                  <input
                    type="date"
                    value={p.end_date}
                    min={p.start_date}
                    onChange={e => updatePeriod(p.id, { end_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={addPeriod}
          className="flex items-center gap-1.5 text-sm text-terracotta hover:text-clay font-medium"
        >
          <Plus size={14} /> Lägg till frånvaro
        </button>
      </div>
    </div>
  );
}
