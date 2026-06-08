"use client";
import { useState, useCallback, useEffect } from "react";
import { format, getDaysInMonth, getDay } from "date-fns";
import { sv } from "date-fns/locale";
import { Loader2, Play, ChevronLeft, ChevronRight, LayoutGrid, Calendar, Settings, Printer, FileSpreadsheet, Users, ClipboardList, Scale } from "lucide-react";
import Link from "next/link";
import { DayCell } from "./DayCell";
import { CalendarView } from "./CalendarView";
import { TimsaldoPanel } from "./TimsaldoPanel";
import { GranskningsPanel } from "./GranskningsPanel";
import { ValidationPanel } from "./ValidationPanel";
import { PhaseBar } from "./PhaseBar";
import { AIModal } from "./AIModal";
import { BeslutsloggPanel } from "./BeslutsloggPanel";
import { generateSchedule, fetchEmployees, fetchSchedule, fetchPeriodInfo, advancePhase, updateWishes, setApt, fetchShiftConfigs, updateScheduleDay, type UpdateScheduleDayData } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ScheduleDayEditor, type ShiftPreset } from "./ScheduleDayEditor";
import type { Employee, ScheduleDay, ValidationResult, ValidationError, Phase } from "@/lib/types";

const GROUPS = ["Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

const CONTRACT_LABEL: Record<string, string> = {
  dagtid: "D",
  varierande: "V",
  kval: "K",
  helg_fre_man: "H",
  natt: "N",
  vikarie: "VIK",
};

interface Props {
  employees: Employee[];
  initialSchedule: ScheduleDay[];
  group: string;
  year: number;
  month: number;
}

export function ScheduleGrid({ employees: allEmployees, initialSchedule, group: initGroup, year: initYear, month: initMonth }: Props) {
  const [group, setGroup] = useState(initGroup);
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [employees, setEmployees] = useState<Employee[]>(allEmployees);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(initialSchedule);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("wish");
  const [aptDate, setAptDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "grid">("calendar");
  const [decisions, setDecisions] = useState<string[]>([]);
  const token = getToken() ?? "";
  const [editingCell, setEditingCell] = useState<{ empId: string; dateStr: string; day: ScheduleDay | null } | null>(null);
  const [presets, setPresets] = useState<ShiftPreset[]>([]);

  // Hämta passtider för gruppen
  useEffect(() => {
    fetchShiftConfigs(group).then(configs => {
      setPresets(configs.map(c => ({
        shift_type: c.shift_type,
        start_time: c.start_time,
        end_time: c.end_time,
        label: c.label ?? c.shift_type,
      })));
    }).catch(() => {});
  }, [group]);

  // Hämta fas + anställda + schema när grupp, år eller månad ändras
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [emps, sched, periodInfo] = await Promise.all([
          fetchEmployees(""),
          fetchSchedule(group, year, month),
          fetchPeriodInfo(group, year, month),
        ]);
        if (!cancelled) {
          setEmployees(emps);
          setSchedule(sched);
          setPhase(periodInfo.phase);
          setAptDate(periodInfo.apt_date ?? null);
          setDecisions(periodInfo.decisions ?? []);
          setValidation(null);
          setStats(null);
        }
      } catch {
        // Tyst fel — tom lista visas
      }
    }
    load();
    return () => { cancelled = true; };
  }, [group, year, month]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function isWeekend(day: number) {
    const d = new Date(year, month - 1, day);
    const wd = getDay(d);
    return wd === 0 || wd === 6;
  }

  function dayLabel(day: number) {
    const d = new Date(year, month - 1, day);
    return format(d, "EE", { locale: sv }).slice(0, 2);
  }

  // Index: employee_id → date → ScheduleDay
  const scheduleIndex = new Map<string, Map<string, ScheduleDay>>();
  for (const sd of schedule) {
    if (!scheduleIndex.has(sd.employee_id)) scheduleIndex.set(sd.employee_id, new Map());
    scheduleIndex.get(sd.employee_id)!.set(sd.date, sd);
  }

  // Index: employee_id → Set<dateStr> för snabb önskemålslookup
  const wishIndex = new Map<string, Set<string>>();
  for (const emp of employees) {
    wishIndex.set(emp.id, new Set(emp.wishes));
  }

  const handleOpenEditor = useCallback((empId: string, dateStr: string, currentDay: ScheduleDay | null) => {
    setEditingCell({ empId, dateStr, day: currentDay });
  }, []);

  const handleSaveManualEdit = useCallback(async (data: UpdateScheduleDayData) => {
    setError(null);
    try {
      const res = await updateScheduleDay(group, year, month, data);
      setSchedule(res.schedule);
      setDecisions(res.decisions);
      setValidation(res.validation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kunde inte spara ändringen";
      setError(msg);
      throw err;
    }
  }, [group, year, month]);

  // Index: date → employee_id → ValidationError[]
  const errorIndex = new Map<string, Map<string, ValidationError[]>>();
  if (validation) {
    for (const e of validation.errors) {
      if (!errorIndex.has(e.date)) errorIndex.set(e.date, new Map());
      if (!errorIndex.get(e.date)!.has(e.employee_id)) errorIndex.get(e.date)!.set(e.employee_id, []);
      errorIndex.get(e.date)!.get(e.employee_id)!.push(e);
    }
  }

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateSchedule(group, year, month);
      setSchedule(result.schedule_days);
      setValidation(result.validation);
      setStats(result.stats);
      setPhase(result.phase);
      setDecisions(result.decisions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setLoading(false);
    }
  }, [group, year, month]);

  const handleAdvancePhase = useCallback(async (next: Phase) => {
    setPhaseLoading(true);
    try {
      const info = await advancePhase(group, year, month, next);
      setPhase(info.phase);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunde inte ändra fas");
    } finally {
      setPhaseLoading(false);
    }
  }, [group, year, month]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: sv });

  // Filter employees for current group (including borrowed staff who have shifts in this group)
  const groupEmployees = employees.filter(e => 
    e.group === group || 
    schedule.some(sd => sd.employee_id === e.id && sd.assigned_group === group)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors mr-1"
          >
            <ChevronLeft size={16} /> Tillbaka
          </Link>

          {/* Group selector */}
          <div className="flex gap-1 flex-wrap">
            {GROUPS.map(g => (
              <button
                key={g}
                onClick={() => { setGroup(g); setSchedule([]); setValidation(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  group === g
                    ? "bg-terracotta text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold capitalize w-36 text-center">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${viewMode === "calendar" ? "bg-terracotta text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <Calendar size={14} /> Kalender
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l border-gray-200 transition-colors ${viewMode === "grid" ? "bg-terracotta text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>

          {/* APT-datum */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">APT:</span>
            <input
              type="date"
              value={aptDate ?? ""}
              onChange={async e => {
                const val = e.target.value || null;
                const info = await setApt(group, year, month, val).catch(() => null);
                if (info) setAptDate(info.apt_date ?? null);
              }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>

          {/* Bemanningskrav */}
          <Link
            href="/schemalagga"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ClipboardList size={14} /> Bemanning
          </Link>

          {/* Medarbetare */}
          <Link
            href="/medarbetare"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Users size={14} /> Personal
          </Link>

          {/* Systembeskrivning */}
          <Link
            href="/systembeskrivning"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Scale size={14} /> Systembeskrivning
          </Link>

          {/* Inställningar */}
          <Link
            href="/installningar"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={14} /> Passtider
          </Link>

          {/* Export-knappar */}
          {schedule.length > 0 && (
            <div className="flex gap-1">
              <Link
                href={`/schema/print?group=${encodeURIComponent(group)}&year=${year}&month=${month}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                title="Skriv ut / Spara som PDF"
              >
                <Printer size={14} /> PDF
              </Link>
              <a
                href={`http://localhost:9000/api/export/${encodeURIComponent(group)}/${year}/${month}/excel?token=${encodeURIComponent(token)}`}
                download
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                title="Ladda ner Excel"
              >
                <FileSpreadsheet size={14} /> Excel
              </a>
              <a
                href={`http://localhost:9000/api/debug/${encodeURIComponent(group)}/${year}/${month}?token=${encodeURIComponent(token)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                title="Visa Debug-rapport (JSON)"
              >
                <ClipboardList size={14} /> Debug
              </a>
            </div>
          )}

          {/* AI-analys — bara i korrigeringsläge */}
          {phase === "correction" && schedule.length > 0 && (
            <AIModal
              group={group}
              year={year}
              month={month}
              onScheduleUpdated={async () => {
                const [sched] = await Promise.all([
                  fetchSchedule(group, year, month).catch(() => []),
                ]);
                setSchedule(sched);
              }}
            />
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Kör autoschema
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Pass: <strong className="text-gray-800">{stats.total_shifts}</strong></span>
            <span>Hårda fel: <strong className={stats.hard_errors > 0 ? "text-red-600" : "text-green-600"}>{stats.hard_errors}</strong></span>
            <span>Varningar: <strong className="text-yellow-600">{stats.soft_warnings}</strong></span>
          </div>
        )}
      </div>

      {/* Fas-indikator */}
      <div className="mb-4">
        <PhaseBar phase={phase} onAdvance={handleAdvancePhase} loading={phaseLoading} />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Validation panel */}
      {validation && (
        <div className="mb-4">
          <ValidationPanel validation={validation} />
        </div>
      )}

      {/* Kalendervy */}
      {viewMode === "calendar" && (
        <CalendarView
          employees={groupEmployees}
          scheduleIndex={scheduleIndex}
          errorIndex={errorIndex}
          wishIndex={wishIndex}
          year={year}
          month={month}
          phase={phase}
          aptDate={aptDate}
          onEditDay={handleOpenEditor}
        />
      )}

      {/* Schedule grid */}
      {viewMode === "grid" && <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 sticky left-0 bg-gray-50 min-w-40 z-10">
                Namn
              </th>
              <th className="px-1 py-2 font-semibold text-gray-500 border-b border-gray-200 w-8">
                Typ
              </th>
              {days.map(d => (
                <th
                  key={d}
                  className={`w-7 py-1 border-b border-gray-200 font-medium ${
                    isWeekend(d) ? "bg-blue-50 text-blue-600" : "text-gray-500"
                  }`}
                >
                  <div>{d}</div>
                  <div className="text-[9px] opacity-60">{dayLabel(d)}</div>
                </th>
              ))}
              <th className="px-2 py-2 font-semibold text-gray-500 border-b border-gray-200 text-right min-w-12">
                Timmar
              </th>
            </tr>
          </thead>
          <tbody>
            {groupEmployees.map((emp, idx) => {
              const empSchedule = scheduleIndex.get(emp.id) ?? new Map();
              let totalHours = 0;

              return (
                <tr
                  key={emp.id}
                  className={`hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}
                >
                  {/* Name */}
                  <td className="px-3 py-1 font-medium text-gray-800 sticky left-0 bg-inherit border-r border-gray-100 z-10">
                    <div>{emp.name}</div>
                    {emp.group !== group && (
                      <div className="text-[9px] text-terracotta font-semibold leading-none mt-0.5">
                        Lånad från {emp.group}
                      </div>
                    )}
                  </td>
                  {/* Contract type */}
                  <td className="text-center text-gray-400 font-mono border-r border-gray-100">
                    {CONTRACT_LABEL[emp.contract_type] ?? emp.contract_type}
                  </td>
                  {/* Day cells */}
                  {days.map(d => {
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const dayData = empSchedule.get(dateStr) ?? {
                      date: dateStr,
                      employee_id: emp.id,
                      shift: null,
                      absence: null,
                    };
                    const cellErrors = errorIndex.get(dateStr)?.get(emp.id) ?? [];
                    if (dayData.shift && !dayData.shift.is_unbooked) {
                      totalHours += dayData.shift.segments.reduce((sum: number, seg: { start_time: string; end_time: string }) => {
                        const start = new Date(seg.start_time);
                        const end = new Date(seg.end_time);
                        return sum + (end.getTime() - start.getTime()) / 3_600_000;
                      }, 0);
                    }
                    const canEdit = phase !== "attested";
                    return (
                      <DayCell
                        key={dateStr}
                        day={dayData}
                        errors={cellErrors}
                        isWeekend={isWeekend(d)}
                        isWished={wishIndex.get(emp.id)?.has(dateStr) ?? false}
                        canEdit={canEdit}
                        onEdit={() => handleOpenEditor(emp.id, dateStr, dayData)}
                      />
                    );
                  })}
                  {/* Hours total */}
                  <td className="px-2 text-right text-gray-600 font-mono">
                    {totalHours > 0 ? totalHours.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
            {groupEmployees.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 3} className="text-center py-8 text-gray-400">
                  Inga anställda i {group} — se till att databasen är seedat.
                </td>
              </tr>
            )}
          </tbody>

          {/* Bemanningsrad: faktisk bemanning per dag */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td className="px-3 py-1 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">
                Bemanning
              </td>
              <td className="border-r border-gray-200" />
              {days.map(d => {
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                let fm = 0, kval = 0;
                for (const emp of groupEmployees) {
                  const sd = scheduleIndex.get(emp.id)?.get(dateStr);
                  if (!sd?.shift || sd.shift.is_unbooked) continue;
                  const t = sd.shift.shift_type;
                  if (t === "dag_tidig" || t === "dag") fm++;
                  if (t === "kval_kort" || t === "kval_lang") kval++;
                }
                const total = fm + kval;
                const color = total === 0 ? "text-gray-300" : total >= 4 ? "text-green-600" : "text-amber-500";
                return (
                  <td key={dateStr} className={`w-7 text-center text-[9px] font-bold border border-gray-100 ${color}`}>
                    {total > 0 ? total : "·"}
                  </td>
                );
              })}
              <td />
            </tr>
          </tfoot>
          <tbody>
          </tbody>
        </table>
      </div>}

      {/* Schemaanalys */}
      {schedule.length > 0 && (
        <GranskningsPanel
          employees={groupEmployees}
          scheduleIndex={scheduleIndex}
          validation={validation}
          year={year}
          month={month}
          group={group}
          onScheduleFixed={async () => {
            const sched = await fetchSchedule(group, year, month).catch(() => []);
            setSchedule(sched);
          }}
        />
      )}

      {/* Timsaldo */}
      {schedule.length > 0 && (
        <TimsaldoPanel
          employees={groupEmployees}
          scheduleIndex={scheduleIndex}
          year={year}
          month={month}
          group={group}
        />
      )}

      {/* Systemets Beslutslogg */}
      {schedule.length > 0 && (
        <div className="mt-6">
          <BeslutsloggPanel decisions={decisions} />
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
        {[
          { label: "06:45 Dag tidig", bg: "bg-blue-800" },
          { label: "DAG Dag", bg: "bg-blue-500" },
          { label: "K Kväll kort", bg: "bg-purple-500" },
          { label: "KL Kväll lång", bg: "bg-purple-700" },
          { label: "N Natt", bg: "bg-slate-800" },
          { label: "SEM Semester", bg: "bg-orange-400" },
          { label: "SJK Sjuk", bg: "bg-red-500" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={`${item.bg} text-white text-[9px] px-1.5 py-0.5 rounded font-bold`}>
              {item.label.split(" ")[0]}
            </span>
            <span>{item.label.split(" ").slice(1).join(" ")}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block" />
          <span>Regelbrott</span>
        </div>
      </div>

      {editingCell && (
        <ScheduleDayEditor
          employeeId={editingCell.empId}
          employeeName={employees.find(e => e.id === editingCell.empId)?.name ?? editingCell.empId}
          dateStr={editingCell.dateStr}
          dateLabel={(() => {
            const parts = editingCell.dateStr.split("-");
            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            return format(dateObj, "EEEE d MMMM", { locale: sv });
          })()}
          presets={presets}
          currentDay={editingCell.day}
          onSave={handleSaveManualEdit}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}
