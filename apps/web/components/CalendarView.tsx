"use client";
import Link from "next/link";
import { getDaysInMonth, getDay, format } from "date-fns";
import { sv } from "date-fns/locale";
import type { Employee, ScheduleDay, ValidationError, Phase } from "@/lib/types";

const DAY_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const SHIFT_COLORS: Record<string, { bg: string; fg: string }> = {
  dag_tidig: { bg: "#1e40af", fg: "#fff" },
  dag:       { bg: "#3b82f6", fg: "#fff" },
  kval_kort: { bg: "#7c3aed", fg: "#fff" },
  kval_lang: { bg: "#6d28d9", fg: "#fff" },
  delad_tur: { bg: "#4f46e5", fg: "#fff" },
  natt:      { bg: "#1e293b", fg: "#fff" },
  obokad:    { bg: "#e5e7eb", fg: "#6b7280" },
  APT:       { bg: "#0d9488", fg: "#fff" },
  kontorstid:{ bg: "#fef3c7", fg: "#92400e" },
  planeringstid: { bg: "#06b6d4", fg: "#fff" }, // Cyan för planeringstid
};

const ABSENCE: Record<string, { label: string; bg: string; fg: string; }> = {
  sem:  { label: "Sem",  bg: "#fb923c", fg: "#fff" },
  FL:   { label: "FL",   bg: "#fdba74", fg: "#fff" },
  TJL:  { label: "TJL",  bg: "#fbbf24", fg: "#fff" },
  VAB:  { label: "VAB",  bg: "#38bdf8", fg: "#fff" },
  KOM:  { label: "Kom",  bg: "#2dd4bf", fg: "#fff" },
  STU:  { label: "Stu",  bg: "#818cf8", fg: "#fff" },
  sjuk: { label: "Sjuk", bg: "#ef4444", fg: "#fff" },
};

function isoWeek(d: Date) {
  const t = new Date(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - w.getTime()) / 86400000 - 3 + ((w.getDay() + 6) % 7)) / 7);
}

interface Props {
  employees: Employee[];
  scheduleIndex: Map<string, Map<string, ScheduleDay>>;
  errorIndex: Map<string, Map<string, ValidationError[]>>;
  wishIndex: Map<string, Set<string>>;
  year: number;
  month: number;
  phase: Phase;
  aptDate?: string | null;
  onEditDay: (empId: string, dateStr: string, currentDay: ScheduleDay | null) => void;
}

export function CalendarView({ employees, scheduleIndex, errorIndex, wishIndex, year, month, phase, aptDate, onEditDay }: Props) {
  const n = getDaysInMonth(new Date(year, month - 1));
  const firstWd = (getDay(new Date(year, month - 1, 1)) + 6) % 7; // 0=Mån

  const padded: (number | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const d2s = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="space-y-0 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      {weeks.map((week, wi) => {
        const firstReal = week.find(d => d !== null);
        if (!firstReal) return null;
        const wn = isoWeek(new Date(year, month - 1, firstReal));

        return (
          <div key={wi} className={wi > 0 ? "border-t-2 border-gray-300" : ""}>

            {/* ── Datumrad ── */}
            <div className="grid bg-gray-50" style={{ gridTemplateColumns: "11rem repeat(7, 1fr)" }}>
              <div className="px-4 py-2 flex items-center">
                <span className="text-xs font-bold text-gray-400 tracking-wide">v{wn}</span>
              </div>
              {week.map((day, di) => {
                const isWe = di >= 5;
                const outside = !day;
                return (
                  <div
                    key={di}
                    className={`py-2 text-center border-l border-gray-200 ${
                      outside ? "bg-gray-100" : isWe ? "bg-blue-50" : "bg-gray-50"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${
                      outside ? "text-gray-400" : isWe ? "text-blue-500" : "text-gray-500"
                    }`}>
                      {DAY_SHORT[di]}
                    </p>
                    {day ? (
                      <>
                        <p className={`text-xl font-bold leading-tight ${isWe ? "text-blue-700" : "text-gray-800"}`}>
                          {day}
                        </p>
                        {(() => {
                          const dateStr = d2s(day);
                          let dag = 0, kval = 0;
                          for (const emp of employees) {
                            const sd = scheduleIndex.get(emp.id)?.get(dateStr);
                            if (!sd?.shift || sd.shift.is_unbooked) continue;
                            const t = sd.shift.shift_type;
                            if (t === "dag" || t === "dag_tidig") dag++;
                            if (t === "kval_kort" || t === "kval_lang") kval++;
                          }
                          if (dag === 0 && kval === 0) return null;
                          return (
                            <div className="flex flex-col items-center gap-0.5 mt-1">
                              {dag > 0 && (
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded-md px-2 py-0.5 w-full text-center">
                                  Dag {dag}
                                </span>
                              )}
                              {kval > 0 && (
                                <span className="text-[11px] font-bold text-purple-700 bg-purple-100 rounded-md px-2 py-0.5 w-full text-center">
                                  Kv {kval}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <p className="text-xs text-gray-300 leading-tight mt-0.5">–</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Personalrader ── */}
            {employees.map((emp, ei) => (
              <div
                key={emp.id}
                className={`grid border-t border-gray-100 ${ei % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}
                style={{ gridTemplateColumns: "11rem repeat(7, 1fr)" }}
              >
                {/* Namn */}
                <div className="px-4 py-2 flex items-center gap-1.5 border-r border-gray-200">
                  <Link
                    href={`/personal/${emp.id}`}
                    className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate flex-1"
                  >
                    {emp.name}
                  </Link>
                  {emp.is_dagansvarig && (
                    <span className="shrink-0 text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1 py-0.5 rounded" title="Dagansvarig — aldrig kväll">
                      DA
                    </span>
                  )}
                </div>

                {/* Dagceller */}
                {week.map((day, di) => {
                  if (!day) return (
                    <div
                      key={di}
                      className="border-l border-gray-200 min-h-12 bg-gray-100"
                      style={{
                        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)"
                      }}
                    />
                  );

                  const dateStr = d2s(day);
                  const sd = scheduleIndex.get(emp.id)?.get(dateStr);
                  const isWished = wishIndex.get(emp.id)?.has(dateStr) ?? false;
                  const canEdit = phase !== "attested";
                  const isWe = di >= 5;
                  const hasError = (errorIndex.get(dateStr)?.get(emp.id) ?? []).some(e => e.severity === "hard");

                  const isApt = aptDate === dateStr;

                  // Bygg badge från faktisk shift-data (tider från segmenten)
                  let badge: { label: string; bg: string; fg: string } | null = null;
                  if (isApt && !sd?.shift && !sd?.absence) {
                    badge = { label: "APT 13:45", bg: "#0d9488", fg: "#fff" };
                  } else if (sd?.absence) {
                    const a = ABSENCE[sd.absence.absence_type];
                    if (a) badge = a;
                  } else if (sd?.shift && !sd.shift.is_unbooked) {
                    const colors = SHIFT_COLORS[sd.shift.shift_type] ?? { bg: "#94a3b8", fg: "#fff" };
                    const segments = sd.shift.segments;
                    const fmt = (iso: string) => new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
                    let timeStr = "";
                    if (segments.length > 1) {
                      const firstSeg = segments[0];
                      const lastSeg = segments[segments.length - 1];
                      timeStr = `${fmt(firstSeg.start_time)}–${fmt(lastSeg.end_time)} *`;
                    } else if (segments[0]) {
                      timeStr = `${fmt(segments[0].start_time)}–${fmt(segments[0].end_time)}`;
                    } else {
                      timeStr = sd.shift.shift_type;
                    }
                    badge = { label: timeStr, ...colors };
                  }

                  return (
                    <div
                      key={di}
                      onClick={canEdit ? () => onEditDay(emp.id, dateStr, sd || null) : undefined}
                      title={canEdit ? "Klicka för att korrigera pass/frånvaro" : ""}
                      className={[
                        "relative border-l border-gray-100 min-h-12 flex items-center justify-center p-1",
                        isWe ? "bg-blue-50/20" : "",
                        isWished && !badge ? "bg-green-50" : "",
                        canEdit ? "cursor-pointer hover:bg-blue-50/20 hover:shadow-inner transition-all" : "",
                      ].join(" ")}
                    >
                      {badge ? (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md w-full text-center block leading-tight font-mono"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                        </span>
                      ) : isWished ? (
                        <span className="text-green-500 text-base">★</span>
                      ) : canEdit ? (
                        <span className="text-gray-200 text-xs select-none">+</span>
                      ) : null}

                      {hasError && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                      {isWished && badge && (
                        <span className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-green-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ── Bemanningsrad ── */}
            <div
              className="grid border-t border-gray-200 bg-gray-50/80"
              style={{ gridTemplateColumns: "11rem repeat(7, 1fr)" }}
            >
              <div className="px-4 py-1.5 flex items-center">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Bemanning</span>
              </div>
              {week.map((day, di) => {
                if (!day) return <div key={di} className="border-l border-gray-100" />;
                const dateStr = d2s(day);
                let dag = 0, kval = 0;
                for (const emp of employees) {
                  const sd = scheduleIndex.get(emp.id)?.get(dateStr);
                  if (!sd?.shift || sd.shift.is_unbooked) continue;
                  const t = sd.shift.shift_type;
                  if (t === "dag" || t === "dag_tidig") dag++;
                  if (t === "kval_kort" || t === "kval_lang") kval++;
                }
                const total = dag + kval;
                return (
                  <div key={di} className="border-l border-gray-100 py-1.5 flex flex-col items-center justify-center gap-0.5">
                    {dag > 0 && (
                      <span className="text-[10px] font-bold text-blue-600">{dag}d</span>
                    )}
                    {kval > 0 && (
                      <span className="text-[10px] font-bold text-purple-600">{kval}k</span>
                    )}
                    {total === 0 && (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        );
      })}
    </div>
  );
}
