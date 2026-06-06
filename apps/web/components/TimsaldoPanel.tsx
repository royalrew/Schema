"use client";
import { useState, useEffect, useCallback } from "react";
import { getDaysInMonth } from "date-fns";
import { Pencil, Check, X } from "lucide-react";
import { fetchGroupBalances, saveBalance, type BalanceEntry } from "@/lib/api";
import type { Employee, ScheduleDay } from "@/lib/types";

const WEEKLY_HOURS: Record<string, number> = {
  dagtid: 40, varierande: 37, kval: 30,
  helg_fre_son: 26, helg_lor_man: 26, natt: 34.33,
  vikarie: 0,
};

function shiftHours(sd: ScheduleDay): number {
  if (!sd.shift || sd.shift.is_unbooked) return 0;
  return sd.shift.segments.reduce((s, seg) =>
    s + (new Date(seg.end_time).getTime() - new Date(seg.start_time).getTime()) / 3_600_000, 0);
}

function SaldoColor({ value }: { value: number }) {
  const abs = Math.abs(value);
  const color = abs <= 1 ? "text-green-600" : abs <= 8 ? "text-amber-600" : "text-red-600";
  return <span className={`font-bold font-mono ${color}`}>{value >= 0 ? "+" : ""}{value.toFixed(1)}h</span>;
}

interface Props {
  employees: Employee[];
  scheduleIndex: Map<string, Map<string, ScheduleDay>>;
  year: number;
  month: number;
  group: string;
}

export function TimsaldoPanel({ employees, scheduleIndex, year, month, group }: Props) {
  const [balances, setBalances] = useState<Record<string, BalanceEntry>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    fetchGroupBalances(group, year, month).then(entries => {
      const map: Record<string, BalanceEntry> = {};
      for (const e of entries) map[e.employee_id] = e;
      setBalances(map);
    });
  }, [group, year, month]);

  const startEdit = useCallback((emp: Employee) => {
    const bal = balances[emp.id]?.opening_balance_h ?? 0;
    setEditVal(bal.toString());
    setEditNote(balances[emp.id]?.note ?? "");
    setEditing(emp.id);
  }, [balances]);

  const saveEdit = useCallback(async (empId: string) => {
    const val = parseFloat(editVal.replace(",", ".")) || 0;
    const entry: BalanceEntry = { employee_id: empId, year, month, opening_balance_h: val, note: editNote || null };
    await saveBalance(entry);
    setBalances(prev => ({ ...prev, [empId]: entry }));
    setEditing(null);
  }, [editVal, editNote, year, month]);

  if (employees.length === 0) return null;

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const weeks = daysInMonth / 7;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Timsaldo — {month}/{year}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Ingångssaldo hämtas manuellt från Medvind. Medvind är den officiella källan för lön.
          </p>
        </div>
      </div>

      {/* Kolumnrubriker */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-4 py-1.5 border-b border-gray-100 bg-gray-50/60">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Namn</span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right w-20">Medvind-saldo</span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right w-20">Planerat</span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right w-20">Totalt</span>
        <span className="w-6" />
      </div>

      <div className="divide-y divide-gray-50">
        {employees.map(emp => {
          const target = (WEEKLY_HOURS[emp.contract_type] ?? 37) * weeks * (emp.percentage ?? 1.0);
          const empSchedule = scheduleIndex.get(emp.id) ?? new Map<string, ScheduleDay>();
          const actual = Array.from(empSchedule.values()).reduce((s, sd) => s + shiftHours(sd), 0);
          const planned = actual - target;
          const opening = balances[emp.id]?.opening_balance_h ?? 0;
          const total = opening + planned;
          const barPct = Math.min((actual / target) * 100, 120);
          const isEditing = editing === emp.id;

          return (
            <div key={emp.id} className="px-4 py-3">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">
                {/* Namn */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{emp.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${Math.abs(planned) <= 4 ? "bg-green-400" : Math.abs(planned) <= 8 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${Math.min(barPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">{actual.toFixed(0)}h / {target.toFixed(0)}h</span>
                  </div>
                </div>

                {/* Medvind-saldo (redigerbart) */}
                <div className="w-20 text-right">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      className="w-full border border-terracotta/40 rounded px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-terracotta/40"
                      autoFocus
                    />
                  ) : (
                    <SaldoColor value={opening} />
                  )}
                </div>

                {/* Planerat denna period */}
                <div className="w-20 text-right">
                  <SaldoColor value={planned} />
                </div>

                {/* Totalt */}
                <div className="w-20 text-right">
                  <SaldoColor value={total} />
                </div>

                {/* Redigera-knappar */}
                <div className="w-6 flex items-center justify-center">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button onClick={() => saveEdit(emp.id)} className="text-green-500 hover:text-green-700">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(emp)} className="text-gray-300 hover:text-blue-500 transition-colors" title="Ange saldo från Medvind">
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Notering (visas när redigering pågår) */}
              {isEditing && (
                <input
                  type="text"
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  placeholder="Notering, t.ex. 'Hämtat från Medvind 2026-06-01'"
                  className="mt-1.5 w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-terracotta/40"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/60">
        <p className="text-[10px] text-gray-400">
          ⚠ Dessa siffror är planeringsunderlag. <strong>Medvind är den officiella källan för löneberäkning.</strong>
        </p>
      </div>
    </div>
  );
}
