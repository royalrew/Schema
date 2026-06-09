"use client";
import { useState, useCallback, useEffect } from "react";
import { format, getDaysInMonth, getDay } from "date-fns";
import { sv } from "date-fns/locale";
import { Loader2, Play, ChevronLeft, ChevronRight, LayoutGrid, Calendar, Settings, Printer, FileSpreadsheet, Users, ClipboardList, Trash2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { DayCell } from "./DayCell";
import { CalendarView } from "./CalendarView";
import { TimsaldoPanel } from "./TimsaldoPanel";
import { GranskningsPanel } from "./GranskningsPanel";
import { ValidationPanel } from "./ValidationPanel";
import { PhaseBar } from "./PhaseBar";
import { AIModal } from "./AIModal";
import { BeslutsloggPanel } from "./BeslutsloggPanel";
import { generateSchedule, fetchEmployees, fetchSchedule, fetchPeriodInfo, fetchValidation, advancePhase, updateWishes, setApt, setWishDeadline, fetchShiftConfigs, updateScheduleDay, clearSchedule, type UpdateScheduleDayData } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ScheduleDayEditor, type ShiftPreset } from "./ScheduleDayEditor";
import type { Employee, ScheduleDay, ValidationResult, ValidationError, Phase } from "@/lib/types";

const GROUPS = ["Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

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
  const [aptTime, setAptTimeState] = useState<string | null>(null);
  const [wishDeadline, setWishDeadlineState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "grid">("calendar");
  const [decisions, setDecisions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"schema" | "timsaldo" | "validering" | "logg">("schema");
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
          setAptTimeState(periodInfo.apt_time ?? null);
          setWishDeadlineState(periodInfo.wish_deadline ?? null);
          setDecisions(periodInfo.decisions ?? []);
          setStats(null);
          // Hämta validering om schemat redan finns i correction-fas
          if (periodInfo.phase === "correction" && sched.length > 0) {
            fetchValidation(group, year, month).then(v => {
              if (!cancelled) setValidation(v);
            }).catch(() => {});
          } else {
            setValidation(null);
          }
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

  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");

  // Reset selectedWeek when month or year changes
  useEffect(() => {
    setSelectedWeek("all");
  }, [year, month]);

  // Calculate weeks in the month (exactly like CalendarView does)
  const firstWd = (getDay(new Date(year, month - 1, 1)) + 6) % 7; // 0=Mån
  const padded: (number | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  function getIsoWeek(d: Date) {
    const t = new Date(d);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const w = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t.getTime() - w.getTime()) / 86400000 - 3 + ((w.getDay() + 6) % 7)) / 7);
  }

  const weeksList = weeks.map((week) => {
    const firstReal = week.find(d => d !== null);
    if (firstReal === undefined) return null;
    const wn = getIsoWeek(new Date(year, month - 1, firstReal));
    const weekDays = week.filter((d): d is number => d !== null);
    return {
      weekNumber: wn,
      days: weekDays,
    };
  }).filter((w): w is { weekNumber: number; days: number[] } => w !== null);

  const activeDays = selectedWeek === "all"
    ? days
    : (weeksList.find(w => w.weekNumber === selectedWeek)?.days ?? days);

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

  // TEMPORÄR (demo) — rensar schemat för vald grupp/månad. Ta bort efter demon.
  const handleClear = useCallback(async () => {
    if (!window.confirm(`Rensa schemat för ${group} ${month}/${year}? Detta tar bort det genererade schemat (önskemålen påverkas inte).`)) return;
    setLoading(true);
    setError(null);
    try {
      const info = await clearSchedule(group, year, month);
      setSchedule([]);
      setValidation(null);
      setStats(null);
      setPhase(info.phase);
      setDecisions(info.decisions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunde inte rensa schemat");
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-ink/8 p-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink bg-white border border-ink/10 hover:border-ink/20 rounded-xl transition-colors mr-1 cursor-pointer"
          >
            <ChevronLeft size={16} /> Tillbaka
          </Link>

          {/* Group selector */}
          <div className="flex gap-1 flex-wrap">
            {GROUPS.map(g => (
              <button
                key={g}
                onClick={() => { setGroup(g); setSchedule([]); setValidation(null); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  group === g
                    ? "bg-terracotta text-white shadow-md shadow-terracotta/10"
                    : "bg-ink/5 text-ink-soft hover:text-ink hover:bg-ink/8"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={prevMonth} className="p-1.5 rounded-lg border border-ink/8 text-ink-soft hover:text-ink hover:bg-ink/5 cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold capitalize w-36 text-center select-none">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg border border-ink/8 text-ink-soft hover:text-ink hover:bg-ink/5 cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl border border-ink/10 overflow-hidden bg-white">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${viewMode === "calendar" ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink hover:bg-ink/5"}`}
            >
              <Calendar size={14} /> Kalender
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-l border-ink/10 transition-colors cursor-pointer ${viewMode === "grid" ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink hover:bg-ink/5"}`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>

          {/* Sista dag för önskeschema */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-ink-soft/70 font-bold uppercase whitespace-nowrap">Sista önskedag:</span>
            <input
              type="date"
              value={wishDeadline ?? ""}
              onChange={async e => {
                const val = e.target.value || null;
                const info = await setWishDeadline(group, year, month, val).catch(() => null);
                if (info) setWishDeadlineState(info.wish_deadline ?? null);
              }}
              className="border border-ink/10 rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-terracotta/40 bg-white"
            />
          </div>

          {/* APT — datum + tid */}
          <div className="flex items-center gap-1 border border-ink/10 rounded-xl overflow-hidden bg-white">
            <span className="text-[10px] text-ink-soft/60 font-bold uppercase px-2.5 bg-ink/[0.02] self-stretch flex items-center border-r border-ink/10">APT</span>
            <input
              type="date"
              value={aptDate ?? ""}
              onChange={async e => {
                const val = e.target.value || null;
                const info = await setApt(group, year, month, val, aptTime).catch(() => null);
                if (info) { setAptDate(info.apt_date ?? null); setAptTimeState(info.apt_time ?? null); }
              }}
              className="px-2.5 py-1.5 text-xs font-mono focus:outline-none bg-transparent"
            />
            <div className="w-px h-4 bg-ink/10" />
            <input
              type="time"
              value={aptTime ?? ""}
              disabled={!aptDate}
              onChange={async e => {
                const val = e.target.value || null;
                const info = await setApt(group, year, month, aptDate, val).catch(() => null);
                if (info) { setAptDate(info.apt_date ?? null); setAptTimeState(info.apt_time ?? null); }
              }}
              className="px-2.5 py-1.5 text-xs font-mono focus:outline-none bg-transparent disabled:opacity-40"
            />
          </div>

          {/* Bemanningskrav */}
          <Link
            href="/schemalagga"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-ink/5 border border-transparent rounded-xl transition-colors"
          >
            <ClipboardList size={14} className="text-terracotta" /> Bemanning
          </Link>

          {/* Medarbetare */}
          <Link
            href="/medarbetare"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-ink/5 border border-transparent rounded-xl transition-colors"
          >
            <Users size={14} className="text-blue-500" /> Personal
          </Link>

          {/* Inställningar */}
          <Link
            href="/installningar"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-ink/5 border border-transparent rounded-xl transition-colors"
          >
            <Settings size={14} className="text-amber-600" /> Passtider
          </Link>

          {/* Export-knappar */}
          {schedule.length > 0 && (
            <div className="flex gap-1">
              <Link
                href={`/schema/print?group=${encodeURIComponent(group)}&year=${year}&month=${month}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-ink-soft hover:text-ink hover:bg-ink/5 border border-ink/8 rounded-xl transition-colors cursor-pointer"
                title="Skriv ut / Spara som PDF"
              >
                <Printer size={14} /> PDF
              </Link>
              <a
                href={`${API_BASE}/api/export/${encodeURIComponent(group)}/${year}/${month}/excel?token=${encodeURIComponent(token)}`}
                download
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-ink-soft hover:text-ink hover:bg-ink/5 border border-ink/8 rounded-xl transition-colors cursor-pointer"
                title="Ladda ner Excel"
              >
                <FileSpreadsheet size={14} /> Excel
              </a>
              <a
                href={`${API_BASE}/api/debug/${encodeURIComponent(group)}/${year}/${month}?token=${encodeURIComponent(token)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-ink-soft hover:text-ink hover:bg-ink/5 border border-ink/8 rounded-xl transition-colors cursor-pointer"
                title="Visa Debug-rapport (JSON)"
              >
                <ClipboardList size={14} /> Debug
              </a>
            </div>
          )}

          {/* AI-varningshantering — bara i korrigeringsläge när soft warnings finns */}
          {phase === "correction" && schedule.length > 0 && (
            <AIModal
              group={group}
              year={year}
              month={month}
              validation={validation}
              onScheduleUpdated={async () => {
                const sched = await fetchSchedule(group, year, month).catch(() => []);
                setSchedule(sched);
                const v = await fetchValidation(group, year, month).catch(() => null);
                setValidation(v);
              }}
            />
          )}

          {/* TEMPORÄR (demo) — Rensa schema. Ta bort efter demon. */}
          <button
            onClick={handleClear}
            disabled={loading}
            title="Tillfällig demo-knapp: rensar schemat för vald grupp/månad"
            className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Rensa (demo)
          </button>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-terracotta/10 cursor-pointer"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Kör autoschema
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-ink/5 text-xs text-ink-soft">
            <span>Pass: <strong className="text-ink font-bold">{stats.total_shifts}</strong></span>
            <span>Hårda fel: <strong className={stats.hard_errors > 0 ? "text-red-650 font-bold" : "text-green-650 font-bold"}>{stats.hard_errors}</strong></span>
            <span>Varningar: <strong className="text-amber-700 font-bold">{stats.soft_warnings}</strong></span>
          </div>
        )}
      </div>

      {/* ── Flikar längst upp ── */}
      <div className="flex border-b border-ink/8 gap-6 mb-6">
        <button
          onClick={() => setActiveTab("schema")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "schema"
              ? "border-terracotta text-terracotta"
              : "border-transparent text-ink-soft hover:text-ink hover:border-ink/15"
          }`}
        >
          <Calendar size={14} />
          Arbetsschema
        </button>
        <button
          onClick={() => setActiveTab("timsaldo")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "timsaldo"
              ? "border-terracotta text-terracotta"
              : "border-transparent text-ink-soft hover:text-ink hover:border-ink/15"
          }`}
        >
          <Clock size={14} />
          Timsaldo & Arbetstid
        </button>
        <button
          onClick={() => setActiveTab("validering")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "validering"
              ? "border-terracotta text-terracotta"
              : "border-transparent text-ink-soft hover:text-ink hover:border-ink/15"
          }`}
        >
          <AlertTriangle size={14} />
          Regelkontroll & Varningar
          {validation && validation.errors.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("logg")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "logg"
              ? "border-terracotta text-terracotta"
              : "border-transparent text-ink-soft hover:text-ink hover:border-ink/15"
          }`}
        >
          <ClipboardList size={14} />
          Beslutslogg & Historik
        </button>
      </div>

      {/* ── Flikinnehåll ── */}
      <div>
        {activeTab === "schema" && (
          <div className="space-y-6 animate-fade-in">
            {/* Fas-indikator */}
            <div>
              <PhaseBar phase={phase} onAdvance={handleAdvancePhase} loading={phaseLoading} />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm flex items-start gap-2 animate-fade-in">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {/* Adaptiv veckoväljare */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-ink/8">
              <span className="text-[10px] text-ink-soft/70 font-bold uppercase tracking-wider pl-1 mr-2 select-none">Visa period:</span>
              <button
                onClick={() => setSelectedWeek("all")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedWeek === "all"
                    ? "bg-terracotta text-white shadow-md shadow-terracotta/10"
                    : "bg-ink/5 text-ink-soft hover:text-ink hover:bg-ink/8"
                }`}
              >
                Hela månaden
              </button>
              {weeksList.map((w) => (
                <button
                  key={w.weekNumber}
                  onClick={() => setSelectedWeek(w.weekNumber)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedWeek === w.weekNumber
                      ? "bg-terracotta text-white shadow-md shadow-terracotta/10"
                      : "bg-ink/5 text-ink-soft hover:text-ink hover:bg-ink/8"
                  }`}
                >
                  Vecka {w.weekNumber}
                </button>
              ))}
            </div>

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
                selectedWeek={selectedWeek}
              />
            )}

            {/* Schedule grid */}
            {viewMode === "grid" && (
              <div className="bg-white rounded-2xl shadow-sm border border-ink/8 overflow-x-auto">
                <table className="border-collapse text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-ink/8">
                      <th className="text-left px-4 py-3 font-bold text-gray-700 sticky left-0 bg-gray-50 min-w-40 z-10">
                        Namn
                      </th>
                      <th className="px-2 py-3 font-bold text-gray-500 border-r border-ink/5 w-8">
                        Typ
                      </th>
                      {activeDays.map(d => (
                        <th
                          key={d}
                          className={`w-8 py-2 font-bold ${
                            isWeekend(d) ? "bg-blue-50 text-blue-600" : "text-gray-500"
                          }`}
                        >
                          <div>{d}</div>
                          <div className="text-[9px] opacity-65 font-medium">{dayLabel(d)}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 font-bold text-gray-700 text-right min-w-12">
                        Timmar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5 text-xs">
                    {groupEmployees.map((emp, idx) => {
                      const empSchedule = scheduleIndex.get(emp.id) ?? new Map();
                      let totalHours = 0;

                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-blue-50/20 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/25"}`}
                        >
                          {/* Name */}
                          <td className="px-4 py-2 font-semibold text-gray-800 sticky left-0 bg-white border-r border-ink/5 z-10">
                            <div>{emp.name}</div>
                            {emp.group !== group && (
                              <div className="text-[9px] text-terracotta font-bold leading-none mt-0.5">
                                Lånad från {emp.group}
                              </div>
                            )}
                          </td>
                          {/* Contract type */}
                          <td className="text-center text-gray-400 font-mono border-r border-ink/5">
                            {CONTRACT_LABEL[emp.contract_type] ?? emp.contract_type}
                          </td>
                          {/* Day cells */}
                          {activeDays.map(d => {
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
                          <td className="px-3 text-right text-gray-600 font-mono">
                            {totalHours > 0 ? totalHours.toFixed(1) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {groupEmployees.length === 0 && (
                      <tr>
                        <td colSpan={activeDays.length + 3} className="text-center py-12 text-gray-400">
                          Inga anställda i {group} — se till att databasen är seedad.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Bemanningsrad: faktisk bemanning per dag */}
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-ink/8">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">
                        Bemanning
                      </td>
                      <td className="border-r border-ink/5" />
                      {activeDays.map(d => {
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
                          <td key={dateStr} className={`w-8 text-center text-[9px] font-bold border border-ink/5 ${color}`}>
                            {total > 0 ? total : "·"}
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-[11px] text-ink-soft bg-white p-4 rounded-2xl border border-ink/8">
              {[
                { label: "06:45 Dag tidig", bg: "bg-blue-800" },
                { label: "DAG Dag", bg: "bg-blue-500" },
                { label: "K Kväll kort", bg: "bg-purple-500" },
                { label: "KL Kväll lång", bg: "bg-purple-700" },
                { label: "N Natt", bg: "bg-slate-800" },
                { label: "SEM Semester", bg: "bg-orange-400" },
                { label: "SJK Sjuk", bg: "bg-red-500" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 mr-2">
                  <span className={`${item.bg} text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase`}>
                    {item.label.split(" ")[0]}
                  </span>
                  <span>{item.label.split(" ").slice(1).join(" ")}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block" />
                <span>Regelbrott</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timsaldo" && (
          <div className="space-y-6 animate-fade-in">
            {schedule.length > 0 ? (
              <TimsaldoPanel
                employees={groupEmployees}
                scheduleIndex={scheduleIndex}
                year={year}
                month={month}
                group={group}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-ink/8 p-12 text-center text-sm text-ink-soft">
                Inget aktivt arbetsschema genererat. Kör autoschema på fliken "Arbetsschema" först.
              </div>
            )}
          </div>
        )}

        {activeTab === "validering" && (
          <div className="space-y-6 animate-fade-in">
            {schedule.length > 0 ? (
              <>
                {validation && (
                  <ValidationPanel validation={validation} />
                )}
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
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-ink/8 p-12 text-center text-sm text-ink-soft">
                Inget aktivt arbetsschema genererat. Det finns inga regler eller bemanningskrav att validera.
              </div>
            )}
          </div>
        )}

        {activeTab === "logg" && (
          <div className="space-y-6 animate-fade-in">
            {schedule.length > 0 ? (
              <BeslutsloggPanel decisions={decisions} />
            ) : (
              <div className="bg-white rounded-2xl border border-ink/8 p-12 text-center text-sm text-ink-soft">
                Inga systembeslut eller schemahistorik loggad för den här perioden än.
              </div>
            )}
          </div>
        )}
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
