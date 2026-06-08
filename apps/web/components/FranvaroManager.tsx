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
          className="flex items-center gap-1.5 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
        >
          <Save size={12} />
          {saving ? "Sparar…" : saved ? "Sparat!" : "Spara"}
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {periods.length === 0 && (
          <p className="px-4 py-5 text-sm text-gray-400 text-center">Ingen frånvaro registrerad.</p>
        )}

        {periods.map(p => {
          const typeInfo = ABSENCE_TYPES.find(t => t.value === p.absence_type) ?? ABSENCE_TYPES[0];
          const start = new Date(p.start_date);
          const end = new Date(p.end_date);
          const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

          return (
            <div key={p.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                {/* Typ */}
                <select
                  value={p.absence_type}
                  onChange={e => updatePeriod(p.id, { absence_type: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                >
                  {ABSENCE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                {/* Datumintervall */}
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="date"
                    value={p.start_date}
                    onChange={e => updatePeriod(p.id, { start_date: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-base md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                  <span className="text-gray-300">–</span>
                  <input
                    type="date"
                    value={p.end_date}
                    min={p.start_date}
                    onChange={e => updatePeriod(p.id, { end_date: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-base md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                </div>

                {/* Dagar + ta bort */}
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${typeInfo.color} ${typeInfo.text}`}>
                  {days} dag{days !== 1 ? "ar" : ""}
                </span>
                <button
                  onClick={() => removePeriod(p.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
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
