"use client";
import { ScheduleDay, ValidationError } from "@/lib/types";

interface ShiftStyle {
  label: string;
  time: string;
  bg: string;
  text: string;
}

const SHIFT_STYLES: Record<string, ShiftStyle> = {
  dag_tidig:  { label: "06:45", time: "06:45–16", bg: "bg-blue-800",   text: "text-white" },
  dag:        { label: "DAG",   time: "07–16",     bg: "bg-blue-500",   text: "text-white" },
  kval_kort:  { label: "K",     time: "13:45–20",  bg: "bg-purple-500", text: "text-white" },
  kval_lang:  { label: "KL",    time: "13:45–21",  bg: "bg-purple-700", text: "text-white" },
  delad_tur:  { label: "DT",    time: "07+15:30",  bg: "bg-indigo-500", text: "text-white" },
  natt:       { label: "N",     time: "22–07",     bg: "bg-slate-800",  text: "text-white" },
  obokad:     { label: "OB",    time: "Obokad",    bg: "bg-gray-200",   text: "text-gray-600" },
  APT:        { label: "APT",   time: "13:45–16",  bg: "bg-teal-400",   text: "text-white" },
  planeringstid: { label: "PL", time: "Planering", bg: "bg-cyan-500",   text: "text-white" },
  kontorstid:    { label: "KO", time: "Kontor",    bg: "bg-emerald-500", text: "text-white" },
};

const ABSENCE_STYLES: Record<string, ShiftStyle> = {
  sem:  { label: "SEM", time: "Semester",      bg: "bg-orange-400", text: "text-white" },
  FL:   { label: "FL",  time: "Föräldraled.",  bg: "bg-orange-300", text: "text-white" },
  TJL:  { label: "TJL", time: "Tjänsteled.",   bg: "bg-amber-400",  text: "text-white" },
  sjuk: { label: "SJK", time: "Sjuk",          bg: "bg-red-500",    text: "text-white" },
};

interface Props {
  day: ScheduleDay;
  errors: ValidationError[];
  isWeekend: boolean;
  isWished?: boolean;
  canWish?: boolean;
  onToggleWish?: () => void;
}

export function DayCell({ day, errors, isWeekend, isWished, canWish, onToggleWish }: Props) {
  const hasHardError = errors.some((e) => e.severity === "hard");
  const hasSoftError = errors.some((e) => e.severity === "soft");
  const cellBg = isWeekend ? "bg-blue-50/40" : "bg-white";

  let style: ShiftStyle | null = null;
  let label = "";
  let timeText = "Ledig";
  if (day.absence) {
    style = ABSENCE_STYLES[day.absence.absence_type] ?? { label: "FR", time: "Frånvaro", bg: "bg-gray-300", text: "text-gray-700" };
    label = style.label;
    timeText = style.time;
  } else if (day.shift) {
    style = SHIFT_STYLES[day.shift.shift_type] ?? { label: "?", time: "", bg: "bg-gray-400", text: "text-white" };
    label = style.label;
    const hasActivityOverride = day.shift.segments.some(seg => seg.activity && seg.activity !== day.shift!.shift_type);
    if (hasActivityOverride) {
      label += "*";
    }

    if (day.shift.segments.length > 1) {
      const fmt = (iso: string) => {
        try {
          return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
        } catch {
          return iso.split("T")[1]?.slice(0, 5) || iso;
        }
      };
      timeText = day.shift.segments.map(seg => {
        const act = seg.activity || day.shift!.shift_type;
        const actLabel = SHIFT_STYLES[act]?.label || act.toUpperCase();
        return `${fmt(seg.start_time)}–${fmt(seg.end_time)} (${actLabel})`;
      }).join(" | ");
    } else {
      timeText = style.time;
    }
  }

  const tooltipLines = [
    timeText,
    day.assigned_group ? `Utförs i: ${day.assigned_group}` : "",
    ...errors.map((e) => `⚠ ${e.message}`),
  ];

  return (
    <td
      className={`relative border border-gray-100 w-7 h-9 text-center align-middle ${cellBg} ${canWish ? "cursor-pointer hover:bg-green-50" : ""} ${isWished && !style ? "bg-green-100" : ""}`}
      title={[...tooltipLines, isWished ? "★ Önskedag" : ""].filter(Boolean).join("\n")}
      onClick={canWish ? onToggleWish : undefined}
    >
      {style ? (
        <span
          className={`text-[9px] font-bold px-0.5 py-0.5 rounded leading-tight block mx-0.5 ${style.bg} ${style.text}`}
        >
          {label}
          {day.assigned_group && (
            <span className="text-[7px] block opacity-90 font-normal border-t border-white/20 mt-0.5 pt-0.5">
              →{day.assigned_group.slice(0, 3)}
            </span>
          )}
        </span>
      ) : isWished ? (
        <span className="text-[9px] font-bold text-green-600">★</span>
      ) : null}

      {/* Regelbrott-indikator */}
      {hasHardError && (
        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full pointer-events-none" />
      )}
      {!hasHardError && hasSoftError && (
        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full pointer-events-none" />
      )}
      {/* Önskemålsindikator när dag redan är schemalagd */}
      {isWished && style && (
        <span className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-green-500 rounded-full pointer-events-none" />
      )}
    </td>
  );
}
