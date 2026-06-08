"use client";
import { useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import { getDaysInMonth, format } from "date-fns";
import { sv } from "date-fns/locale";
import { AlertTriangle, AlertCircle, CheckCircle2, Info, Clock, Calendar, Users, Wand2, Loader2 } from "lucide-react";
import type { Employee, ScheduleDay, ValidationResult } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

const WEEKLY_HOURS: Record<string, number> = {
  dagtid: 40, varierande: 37, kval: 30,
  helg_fre_man: 26, natt: 34.33,
  vikarie: 0,
};

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

interface Insight {
  id: string;
  level: "error" | "warning" | "info" | "ok";
  category: "bemanning" | "timmar" | "helger" | "regler" | "bra";
  title: string;
  detail: string;
  action?: string;
  fixEndpoint?: string;  // Om satt visas en "Autofix"-knapp
}

interface Props {
  employees: Employee[];
  scheduleIndex: Map<string, Map<string, ScheduleDay>>;
  validation: ValidationResult | null;
  year: number;
  month: number;
  group: string;
  onScheduleFixed?: () => void;
}

function shiftHours(sd: ScheduleDay): number {
  if (!sd.shift || sd.shift.is_unbooked) return 0;
  return sd.shift.segments.reduce((s, seg) =>
    s + (new Date(seg.end_time).getTime() - new Date(seg.start_time).getTime()) / 3_600_000, 0);
}

function dateLabel(dateStr: string, year: number, month: number): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()}/${month}`;
}

export function GranskningsPanel({ employees, scheduleIndex, validation, year, month, group, onScheduleFixed }: Props) {
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<Record<string, string>>({});

  async function runFix(insightId: string, endpoint: string) {
    setFixing(insightId);
    try {
      const token = getToken();
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        setFixResult(prev => ({ ...prev, [insightId]: `✓ ${data.description}` }));
        onScheduleFixed?.();
      } else {
        setFixResult(prev => ({ ...prev, [insightId]: `Fel: ${data.detail}` }));
      }
    } catch {
      setFixResult(prev => ({ ...prev, [insightId]: "Anslutningsfel" }));
    } finally {
      setFixing(null);
    }
  }
  const insights = useMemo((): Insight[] => {
    const result: Insight[] = [];
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const weeks = daysInMonth / 7;
    const allDates = Array.from({ length: daysInMonth }, (_, i) =>
      `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
    );

    // ── Timmar per person ────────────────────────────────────────────────────
    for (const emp of employees) {
      const target = (WEEKLY_HOURS[emp.contract_type] ?? 37) * weeks;
      const empSched = scheduleIndex.get(emp.id) ?? new Map();
      const actual = Array.from(empSched.values()).reduce((s, sd) => s + shiftHours(sd), 0);
      const diff = actual - target;
      const pct = target > 0 ? (actual / target) * 100 : 100;

      if (pct < 70) {
        result.push({
          id: `hours-low-${emp.id}`,
          level: "error",
          category: "timmar",
          title: `${emp.name} — kritisk undertäckning`,
          detail: `${actual.toFixed(0)}h planerat av ${target.toFixed(0)}h (${pct.toFixed(0)}%). Kontraktet uppfylls inte.`,
          action: "Kontrollera att personen har tillräckligt med pass eller att frånvaro är registrerad.",
        });
      } else if (pct < 85) {
        result.push({
          id: `hours-warn-${emp.id}`,
          level: "warning",
          category: "timmar",
          title: `${emp.name} — undertid`,
          detail: `${actual.toFixed(0)}h av ${target.toFixed(0)}h — ${Math.abs(diff).toFixed(0)}h under mål.`,
          action: "Kontrollera om frånvaro saknas eller om fler pass kan läggas in.",
        });
      } else if (pct > 115) {
        result.push({
          id: `hours-over-${emp.id}`,
          level: "warning",
          category: "timmar",
          title: `${emp.name} — övertid`,
          detail: `${actual.toFixed(0)}h planerat — ${diff.toFixed(0)}h över kontraktsmålet ${target.toFixed(0)}h.`,
          action: "Kontrollera om pass kan tas bort eller omfördelas.",
        });
      }
    }

    // ── Helger per VARIERANDE/KVAL ───────────────────────────────────────────
    const helgContracts = new Set(["varierande", "kval"]);
    for (const emp of employees) {
      if (!helgContracts.has(emp.contract_type)) continue;
      const empSched = scheduleIndex.get(emp.id) ?? new Map();
      let helger = 0;
      for (const [dateStr, sd] of empSched) {
        const d = new Date(dateStr);
        if ((d.getDay() === 6 || d.getDay() === 0) && sd.shift && !sd.shift.is_unbooked) helger++;
      }
      if (helger === 0) {
        result.push({
          id: `helg-none-${emp.id}`,
          level: "warning",
          category: "helger",
          title: `${emp.name} — inga helgpass`,
          detail: `${emp.name} har 0 helgpass. Varierande-personal ska ha 2 helger per månad.`,
          action: "Generera om schemat eller lägg till helgpass manuellt.",
        });
      } else if (helger > 2) {
        result.push({
          id: `helg-many-${emp.id}`,
          level: "warning",
          category: "helger",
          title: `${emp.name} — ${helger} helgpass (max 2)`,
          detail: `${emp.name} har ${helger} helgpass denna månad. Regel: max 2 helger per månad.`,
          action: "Ta bort ett helgpass eller regenerera.",
        });
      }
    }

    // ── 06:45-täckning per dag ───────────────────────────────────────────────
    const missingTidig: string[] = [];
    for (const dateStr of allDates) {
      const hasTidig = employees.some(emp => {
        const sd = scheduleIndex.get(emp.id)?.get(dateStr);
        return sd?.shift?.shift_type === "dag_tidig";
      });
      if (!hasTidig) missingTidig.push(dateStr);
    }
    if (missingTidig.length > 0) {
      const examples = missingTidig.slice(0, 3).map(d => dateLabel(d, year, month));
      const rest = missingTidig.length > 3 ? ` (+${missingTidig.length - 3} till)` : "";
      result.push({
        id: "dag-tidig",
        level: "error",
        category: "bemanning",
        title: `06:45-pass saknas på ${missingTidig.length} dag${missingTidig.length > 1 ? "ar" : ""}`,
        detail: `Nattrapporten täcks inte: ${examples.join(", ")}${rest}.`,
        action: "Autofix tilldelar en tillgänglig person DAG_TIDIG på dessa dagar.",
        fixEndpoint: `/api/autocorrect/${encodeURIComponent(group)}/${year}/${month}/dag-tidig`,
      });
    }

    // ── 21:30-täckning ──────────────────────────────────────────────────────
    const missingLang: string[] = [];
    for (const dateStr of allDates) {
      const hasKval = employees.some(emp => {
        const sd = scheduleIndex.get(emp.id)?.get(dateStr);
        return sd?.shift?.shift_type === "kval_kort" || sd?.shift?.shift_type === "kval_lang";
      });
      const hasLang = employees.some(emp => {
        const sd = scheduleIndex.get(emp.id)?.get(dateStr);
        return sd?.shift?.shift_type === "kval_lang";
      });
      if (hasKval && !hasLang) missingLang.push(dateStr);
    }
    if (missingLang.length > 0) {
      const examples = missingLang.slice(0, 3).map(d => dateLabel(d, year, month));
      const rest = missingLang.length > 3 ? ` (+${missingLang.length - 3} till)` : "";
      result.push({
        id: "kval-lang",
        level: "warning",
        category: "bemanning",
        title: `Ingen jobbar till 21:30 på ${missingLang.length} dag${missingLang.length > 1 ? "ar" : ""}`,
        detail: `Kvällen slutar 20:00 istället för 21:30: ${examples.join(", ")}${rest}.`,
        action: "Byt kval_kort → kval_lang för en person dessa dagar om brukarna behöver sen kväll.",
      });
    }

    // ── Soft constraints från personkort ────────────────────────────────────
    for (const emp of employees) {
      const constraints = (emp as unknown as { soft_constraints?: Array<{
        constraint_type: string; weekdays: number[]; week_parity: string; note: string;
      }> }).soft_constraints ?? [];

      for (const sc of constraints) {
        if (sc.constraint_type !== "prefer_off" && sc.constraint_type !== "avoid") continue;
        const empSched = scheduleIndex.get(emp.id) ?? new Map();
        const violations: string[] = [];

        for (const [dateStr, sd] of empSched) {
          if (!sd.shift || sd.shift.is_unbooked) continue;
          const d = new Date(dateStr);
          const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
          const week = parseInt(format(d, "I"));
          if (!sc.weekdays.includes(wd)) continue;
          if (sc.week_parity === "odd" && week % 2 === 0) continue;
          if (sc.week_parity === "even" && week % 2 !== 0) continue;
          violations.push(dateLabel(dateStr, year, month));
        }

        if (violations.length > 0) {
          result.push({
            id: `sc-${emp.id}-${sc.note}`,
            level: "warning",
            category: "regler",
            title: `${emp.name} — livsmönster respekteras ej`,
            detail: `"${sc.note}" — pass inlagda på: ${violations.slice(0, 3).join(", ")}${violations.length > 3 ? ` +${violations.length - 3}` : ""}.`,
            action: "Justera schemat manuellt eller regenerera.",
          });
        }
      }
    }

    // ── Positiva observationer ───────────────────────────────────────────────
    if (missingTidig.length === 0) {
      result.push({
        id: "ok-tidig",
        level: "ok",
        category: "bra",
        title: "06:45-täckning: alla dagar OK",
        detail: "Nattrapporten täcks av en person varje dag i månaden.",
      });
    }
    const allHelgOk = employees
      .filter(e => helgContracts.has(e.contract_type))
      .every(emp => {
        const empSched = scheduleIndex.get(emp.id) ?? new Map();
        let h = 0;
        for (const [dateStr, sd] of empSched) {
          const d = new Date(dateStr);
          if ((d.getDay() === 6 || d.getDay() === 0) && sd.shift && !sd.shift.is_unbooked) h++;
        }
        return h === 2;
      });
    if (allHelgOk && employees.some(e => helgContracts.has(e.contract_type))) {
      result.push({
        id: "ok-helg",
        level: "ok",
        category: "bra",
        title: "Helgfördelning: alla har exakt 2 helger",
        detail: "Varierande- och kvällspersonal har alla 2 helgpass denna månad.",
      });
    }

    return result;
  }, [employees, scheduleIndex, year, month]);

  if (insights.length === 0) return null;

  const errors   = insights.filter(i => i.level === "error");
  const warnings = insights.filter(i => i.level === "warning");
  const oks      = insights.filter(i => i.level === "ok");

  const LEVEL_CONFIG = {
    error:   { icon: AlertCircle,   bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    badge: "bg-red-100 text-red-700" },
    warning: { icon: AlertTriangle, bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-700" },
    info:    { icon: Info,          bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-700" },
    ok:      { icon: CheckCircle2,  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-100 text-green-700" },
  };

  const CATEGORY_ICON: Record<string, React.ElementType> = {
    bemanning: Users, timmar: Clock, helger: Calendar, regler: AlertTriangle, bra: CheckCircle2,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header med sammanfattning */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Schemaanalys</h3>
          <div className="flex gap-2">
            {errors.length > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {errors.length} måste åtgärdas
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {warnings.length} bör kontrolleras
              </span>
            )}
            {oks.length > 0 && (
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {oks.length} OK
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {format(new Date(year, month - 1), "MMMM yyyy", { locale: sv })} — baserat på schemalagd data
        </p>
      </div>

      {/* Insikter */}
      <div className="divide-y divide-gray-50">
        {[...errors, ...warnings, ...oks].map(insight => {
          const cfg = LEVEL_CONFIG[insight.level];
          const Icon = cfg.icon;
          const CatIcon = CATEGORY_ICON[insight.category] ?? Info;

          return (
            <div key={insight.id} className={`px-5 py-3.5 flex gap-3 ${insight.level === "ok" ? "opacity-70" : ""}`}>
              <div className="shrink-0 mt-0.5">
                <Icon size={16} className={cfg.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${cfg.text} leading-tight`}>{insight.title}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${cfg.badge}`}>
                    <CatIcon size={9} />
                    {insight.category}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{insight.detail}</p>
                {fixResult[insight.id] ? (
                  <p className="text-xs text-green-600 mt-1 font-medium">{fixResult[insight.id]}</p>
                ) : insight.fixEndpoint ? (
                  <button
                    onClick={() => runFix(insight.id, insight.fixEndpoint!)}
                    disabled={fixing === insight.id}
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                  >
                    {fixing === insight.id
                      ? <><Loader2 size={11} className="animate-spin" /> Fixar…</>
                      : <><Wand2 size={11} /> Autofix</>
                    }
                  </button>
                ) : insight.action ? (
                  <p className="text-xs text-gray-400 mt-1 italic">→ {insight.action}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
