"use client";
import { useEffect } from "react";
import { format, getDaysInMonth, getDay } from "date-fns";
import { sv } from "date-fns/locale";
import type { Employee, ScheduleDay } from "@/lib/types";

const DAY_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const WEEKLY_HOURS: Record<string, number> = {
  dagtid: 40, varierande: 37, kval: 30,
  helg_fre_man: 26, natt: 34.33,
  vikarie: 0,
};

const SHIFT_LABEL: Record<string, { short: string; bg: string }> = {
  dag_tidig: { short: "06:45", bg: "#1e40af" },
  dag:       { short: "DAG",   bg: "#3b82f6" },
  kval_kort: { short: "K",     bg: "#7c3aed" },
  kval_lang: { short: "KL",    bg: "#6d28d9" },
  delad_tur: { short: "DT",    bg: "#4f46e5" },
  natt:      { short: "N",     bg: "#1e293b" },
  obokad:    { short: "OB",    bg: "#9ca3af" },
  APT:       { short: "APT",   bg: "#0d9488" },
};

const ABSENCE_LABEL: Record<string, { short: string; bg: string }> = {
  sem:  { short: "SEM", bg: "#fb923c" },
  FL:   { short: "FL",  bg: "#fdba74" },
  TJL:  { short: "TJL", bg: "#fbbf24" },
  sjuk: { short: "SJK", bg: "#ef4444" },
};

interface Props {
  employees: Employee[];
  schedule: ScheduleDay[];
  group: string;
  year: number;
  month: number;
}

export function PrintSchedule({ employees, schedule, group, year, month }: Props) {
  useEffect(() => {
    const fillRows = () => {
      const page = document.querySelector<HTMLElement>(".page");
      const tbody = document.querySelector<HTMLElement>("tbody");
      if (!page || !tbody) return;

      // Återställ eventuella tidigare höjder
      Array.from(tbody.querySelectorAll<HTMLElement>("tr")).forEach(tr => {
        tr.style.height = "";
      });

      const pageH = page.getBoundingClientRect().height;
      // A3 landscape minus 20 mm marginaler i CSS-pixlar (96 dpi)
      const targetH = (297 - 20) * 3.7795;

      if (pageH > 0 && pageH < targetH) {
        const rows = Array.from(tbody.querySelectorAll<HTMLElement>("tr"));
        if (rows.length === 0) return;
        const currentRowH = rows[0].getBoundingClientRect().height || 14;
        const extraPerRow = (targetH - pageH) / rows.length;
        rows.forEach(tr => {
          tr.style.height = `${currentRowH + extraPerRow}px`;
        });
      }
    };

    const resetRows = () => {
      document.querySelectorAll<HTMLElement>("tbody tr").forEach(tr => {
        tr.style.height = "";
      });
    };

    window.addEventListener("beforeprint", fillRows);
    window.addEventListener("afterprint", resetRows);

    // Trigga print-dialogen automatiskt
    window.print();

    return () => {
      window.removeEventListener("beforeprint", fillRows);
      window.removeEventListener("afterprint", resetRows);
    };
  }, []);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: sv });

  const schedIdx = new Map<string, Map<string, ScheduleDay>>();
  for (const sd of schedule) {
    if (!schedIdx.has(sd.employee_id)) schedIdx.set(sd.employee_id, new Map());
    schedIdx.get(sd.employee_id)!.set(sd.date as unknown as string, sd);
  }

  function dayOfWeek(d: number) {
    return (getDay(new Date(year, month - 1, d)) + 6) % 7; // 0=Mån
  }
  function isWeekend(d: number) { return dayOfWeek(d) >= 5; }

  function shiftHours(sd: ScheduleDay): number {
    if (!sd.shift || sd.shift.is_unbooked) return 0;
    return sd.shift.segments.reduce((s, seg) =>
      s + (new Date(seg.end_time).getTime() - new Date(seg.start_time).getTime()) / 3_600_000, 0);
  }

  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: sv });

  return (
    <>
      <style>{`
        @page { size: A3 landscape; margin: 10mm; }
        * { box-sizing: border-box; font-family: system-ui, sans-serif; }
        body { background: white; color: #111; margin: 0; padding: 0; }
        .no-print { display: none !important; }

        /* ── Skärmläge ── */
        @media screen {
          body { padding: 20px; background: #f3f4f6; }
          .page { background: white; padding: 16px; border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,.1); max-width: 100%; overflow-x: auto; }
          .print-btn {
            position: fixed; top: 16px; right: 16px;
            background: #1d4ed8; color: white; border: none; padding: 10px 20px;
            border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
            z-index: 10;
          }
        }

        /* ── Utskriftsläge ── */
        @media print {
          .print-btn { display: none; }
          html, body { height: 100%; margin: 0; }
          .page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 0;
            margin: 0;
            box-shadow: none;
            border-radius: 0;
          }
          .table-section { flex: 1; }
          .legend { margin-top: 6px; flex-shrink: 0; page-break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }

        /* ── Tabell ── */
        table { border-collapse: collapse; width: 100%; font-size: 9px; table-layout: fixed; }
        th, td { border: 1px solid #e5e7eb; padding: 2px 3px; text-align: center; overflow: hidden; }
        th { background: #f9fafb; font-weight: 600; }
        td.name { text-align: left; padding: 2px 6px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        td.hours { text-align: right; padding: 2px 6px; font-variant-numeric: tabular-nums; }
        .badge {
          display: inline-block; color: white; border-radius: 3px;
          padding: 1px 3px; font-size: 8px; font-weight: 700; line-height: 1.4;
        }
        .weekend { background: #eff6ff; }
        .summary td { border-top: 2px solid #374151; background: #f9fafb; font-size: 8px; }
        h1 { font-size: 15px; font-weight: 700; margin: 0 0 2px; }
        .meta { font-size: 10px; color: #6b7280; margin-bottom: 8px; }
        .legend { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 8px; }
        .legend-item { display: flex; align-items: center; gap: 3px; }
      `}</style>

      <button className="print-btn" onClick={() => window.print()}>
        Skriv ut / Spara PDF
      </button>

      <div className="page">
        <h1>Schema — {group}</h1>
        <p className="meta">
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)} &nbsp;·&nbsp;
          {employees.length} personal &nbsp;·&nbsp;
          Genererat {generatedAt}
        </p>

        <div className="table-section">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 110 }}>Namn</th>
              {days.map(d => (
                <th key={d} className={isWeekend(d) ? "weekend" : ""} style={{ minWidth: 28 }}>
                  <div>{d}</div>
                  <div style={{ fontWeight: 400, opacity: 0.6, fontSize: 7 }}>
                    {DAY_SHORT[dayOfWeek(d)]}
                  </div>
                </th>
              ))}
              <th style={{ textAlign: "right", minWidth: 50 }}>Tim</th>
              <th style={{ textAlign: "right", minWidth: 50 }}>Mål</th>
              <th style={{ textAlign: "right", minWidth: 46 }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => {
              const empSched = schedIdx.get(emp.id) ?? new Map();
              let totalH = 0;

              return (
                <tr key={emp.id}>
                  <td className="name">{emp.name}</td>
                  {days.map(d => {
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const sd = empSched.get(dateStr);
                    if (sd?.shift) totalH += shiftHours(sd);

                    let badge = null;
                    if (sd?.absence) {
                      const a = ABSENCE_LABEL[sd.absence.absence_type];
                      if (a) badge = <span className="badge" style={{ background: a.bg }}>{a.short}</span>;
                    } else if (sd?.shift) {
                      const s = SHIFT_LABEL[sd.shift.shift_type];
                      if (s) badge = (
                        <span
                          className="badge"
                          style={{ background: sd.shift.is_unbooked ? "#9ca3af" : s.bg }}
                        >
                          {sd.shift.is_unbooked ? "OB" : s.short}
                        </span>
                      );
                    }

                    return (
                      <td key={d} className={isWeekend(d) ? "weekend" : ""}>
                        {badge}
                      </td>
                    );
                  })}
                  <td className="hours">{totalH > 0 ? totalH.toFixed(1) : "—"}</td>
                  <td className="hours" style={{ color: "#6b7280" }}>
                    {((WEEKLY_HOURS[emp.contract_type] ?? 37) * daysInMonth / 7).toFixed(1)}
                  </td>
                  <td className="hours" style={{ color: totalH === 0 ? "#9ca3af" : totalH < (WEEKLY_HOURS[emp.contract_type] ?? 37) * daysInMonth / 7 - 4 ? "#dc2626" : "#16a34a" }}>
                    {totalH > 0 ? `${(totalH - (WEEKLY_HOURS[emp.contract_type] ?? 37) * daysInMonth / 7).toFixed(1)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Bemanningsrad */}
          <tfoot>
            <tr className="summary">
              <td className="name" style={{ fontWeight: 700 }}>Bemanning</td>
              {days.map(d => {
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                let dag = 0, kval = 0;
                for (const emp of employees) {
                  const sd = schedIdx.get(emp.id)?.get(dateStr);
                  if (!sd?.shift || sd.shift.is_unbooked) continue;
                  if (["dag", "dag_tidig"].includes(sd.shift.shift_type)) dag++;
                  if (["kval_kort", "kval_lang"].includes(sd.shift.shift_type)) kval++;
                }
                return (
                  <td key={d} className={isWeekend(d) ? "weekend" : ""} style={{ fontSize: 8 }}>
                    {dag > 0 && <span style={{ color: "#1d4ed8" }}>{dag}d</span>}
                    {dag > 0 && kval > 0 && " "}
                    {kval > 0 && <span style={{ color: "#7c3aed" }}>{kval}k</span>}
                    {dag === 0 && kval === 0 && <span style={{ color: "#d1d5db" }}>·</span>}
                  </td>
                );
              })}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
        </div>

        {/* Förklaring */}
        <div className="legend">
          {Object.entries(SHIFT_LABEL).filter(([k]) => k !== "obokad").map(([key, val]) => (
            <div key={key} className="legend-item">
              <span className="badge" style={{ background: val.bg }}>{val.short}</span>
              <span style={{ color: "#6b7280" }}>{key.replace("_", " ")}</span>
            </div>
          ))}
          <div className="legend-item">
            <span className="badge" style={{ background: "#9ca3af" }}>OB</span>
            <span style={{ color: "#6b7280" }}>Obokad</span>
          </div>
          {Object.entries(ABSENCE_LABEL).map(([key, val]) => (
            <div key={key} className="legend-item">
              <span className="badge" style={{ background: val.bg }}>{val.short}</span>
              <span style={{ color: "#6b7280" }}>{key}</span>
            </div>
          ))}
          <span style={{ marginLeft: "auto", color: "#9ca3af" }}>
            Töreboda Schemamotor · {generatedAt}
          </span>
        </div>
      </div>
    </>
  );
}
