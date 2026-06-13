"use client";
import { useMemo } from "react";
import {
  HelpCircle, Star, Sunrise, Clock, Moon, Users, Split, Briefcase,
  Scale, ShieldCheck, HeartHandshake, CalendarOff, Ban
} from "lucide-react";
import type { Employee, ScheduleDay } from "@/lib/types";

/**
 * "Varför ser ditt schema ut så här?"
 *
 * Transparenslager per medarbetare. Bygger en begriplig förklaring på svenska av
 * varför schemat ser ut som det gör — härlett ur det faktiska schemat (strukturerad
 * data) och berikat med systemets beslutslogg. Detta är Sintaris kärna: förklarbarhet
 * framför svart låda.
 *
 * Komponenten kräver ingen ny backend — den läser samma schema och beslutslogg som
 * redan finns, samt (om det finns) livssituationer som fångats i AI-lagret.
 */

interface Props {
  employee: Employee;
  /** Den här personens schemadagar för perioden. */
  schedule: ScheduleDay[];
  /** Periodens beslutslogg (gruppnivå) — fritext från generatorn. */
  decisions?: string[];
}

const CONTRACT_LABEL: Record<string, string> = {
  varierande: "Varierande",
  dagtid: "Dagtid",
  kval: "Kväll",
  helg_fre_man: "Helg (fre–mån)",
  natt: "Natt",
  vikarie: "Timvikarie",
};

interface ReasonCard {
  key: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  count: number;
  text: string;
  dates?: string[];
  accent: string; // tailwind färgklasser för ikon-bubblan
}

function shiftTypeOf(sd: ScheduleDay): string | null {
  if (!sd.shift) return null;
  return sd.shift.shift_type;
}

function isObokad(sd: ScheduleDay): boolean {
  return !!sd.shift && (sd.shift.is_unbooked || sd.shift.shift_type === "obokad");
}

function isWeekend(iso: string): boolean {
  const wd = new Date(iso + "T00:00:00").getDay(); // 0=sön, 6=lör
  return wd === 0 || wd === 6;
}

/** Plockar ut YYYY-MM-DD ur en beslutsrad om den inleds med ett datum. */
function dateOf(line: string): string | null {
  const m = line.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Defensiv läsning av livssituationer (fångas i AI-lagret). Tål okänt format. */
function readLifeSituations(employee: Employee): { title: string; text: string }[] {
  try {
    const raw = localStorage.getItem("sintari_life_situations");
    if (!raw) return [];
    const items: any[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return items
      .filter((it) => {
        const empRef =
          it?.employeeId ?? it?.employee_id ?? it?.empId ?? it?.employee ?? it?.employeeName ?? it?.name;
        const matchesId = empRef === employee.id;
        const matchesName =
          typeof empRef === "string" && empRef.toLowerCase() === employee.name.toLowerCase();
        const status = (it?.status ?? "active").toString().toLowerCase();
        const isLive = !["archived", "deleted", "draft"].includes(status);
        return (matchesId || matchesName) && isLive;
      })
      .map((it) => ({
        title: (it?.title ?? it?.label ?? it?.type ?? "Hänsyn").toString(),
        text: (it?.description ?? it?.text ?? it?.note ?? "").toString(),
      }));
  } catch {
    return [];
  }
}

export function ScheduleExplanation({ employee, schedule, decisions = [] }: Props) {
  const data = useMemo(() => {
    const mineLines = decisions.filter((d) =>
      d.toLowerCase().includes(employee.name.toLowerCase())
    );

    // Strukturerade räkningar från schemat
    const workDays = schedule.filter((sd) => sd.shift && !isObokad(sd));
    const dag = workDays.filter((sd) => shiftTypeOf(sd) === "dag").length;
    const dagTidig = workDays.filter((sd) => shiftTypeOf(sd) === "dag_tidig");
    const kvall = workDays.filter((sd) =>
      ["kval_kort", "kval_lang"].includes(shiftTypeOf(sd) ?? "")
    ).length;
    const natt = workDays.filter((sd) => shiftTypeOf(sd) === "natt");
    const delad = workDays.filter((sd) => shiftTypeOf(sd) === "delad_tur");
    const kontor = workDays.filter((sd) =>
      ["kontorstid", "planeringstid"].includes(shiftTypeOf(sd) ?? "")
    );
    const obokad = schedule.filter((sd) => isObokad(sd));
    const lent = schedule.filter(
      (sd) => sd.assigned_group && sd.assigned_group !== employee.group && sd.shift
    );
    const lentGroups = Array.from(new Set(lent.map((sd) => sd.assigned_group as string)));
    const weekendWork = workDays.filter((sd) => isWeekend(sd.date)).length;
    const absenceDays = schedule.filter((sd) => sd.absence);

    // Önskemål — auktoritativt från beslutsloggen
    const wishLines = mineLines.filter((d) =>
      /önskeschema infriat|personens eget val/i.test(d)
    );
    const wishDates = wishLines.map(dateOf).filter(Boolean) as string[];

    // Bygg förklaringskort (visas bara om de inträffat)
    const cards: ReasonCard[] = [];

    if (wishDates.length > 0) {
      cards.push({
        key: "wish",
        icon: Star,
        title: "Önskemål infriade",
        count: wishDates.length,
        text: "Pass du själv la in i önskeschemat — generatorn lägger dina önskemål först så länge bemanningen tillåter.",
        dates: wishDates,
        accent: "bg-green-100 text-green-700",
      });
    }

    if (dagTidig.length > 0) {
      cards.push({
        key: "tidig",
        icon: Sunrise,
        title: "Tidigt pass 06:45 — rättvis rotation",
        count: dagTidig.length,
        text: "Det tidiga passet tar emot nattrapporten. Det roteras deterministiskt mellan all ordinarie personal så att ingen får oproportionerligt många.",
        dates: dagTidig.map((sd) => sd.date),
        accent: "bg-blue-100 text-blue-700",
      });
    }

    if (obokad.length > 0) {
      cards.push({
        key: "obokad",
        icon: Clock,
        title: "Obokad tid — för att nå dina timmar",
        count: obokad.length,
        text: "Lades på lediga, tillåtna dagar så att du når dina kontraktstimmar. Obokad räknas som arbetstid — du är på jobbet och kan tas i anspråk av din grupp eller lånas ut.",
        dates: obokad.map((sd) => sd.date),
        accent: "bg-gray-200 text-gray-700",
      });
    }

    if (weekendWork > 0) {
      cards.push({
        key: "helg",
        icon: Scale,
        title: "Helgpass — rättvis fördelning",
        count: weekendWork,
        text: "Helger fördelas rättvist (ordinarie personal schemaläggs på max 2 helger per månad). Helgkontrakt jobbar varje helg enligt avtal.",
        accent: "bg-purple-100 text-purple-700",
      });
    }

    if (natt.length > 0) {
      cards.push({
        key: "natt",
        icon: Moon,
        title: "Nattpass",
        count: natt.length,
        text: "Schemalagt enligt ditt nattkontrakt och nattgruppens bemanningskrav.",
        dates: natt.map((sd) => sd.date),
        accent: "bg-slate-200 text-slate-700",
      });
    }

    if (delad.length > 0) {
      cards.push({
        key: "delad",
        icon: Split,
        title: "Delad tur — sista utväg",
        count: delad.length,
        text: "Används bara när inget annat täcker bemanningsbristen den dagen. Generatorn undviker delade turer i det längsta.",
        dates: delad.map((sd) => sd.date),
        accent: "bg-orange-100 text-orange-700",
      });
    }

    if (lent.length > 0) {
      cards.push({
        key: "lent",
        icon: Users,
        title: "Utlånad till annan grupp",
        count: lent.length,
        text: `Du hjälpte ${lentGroups.join(", ")} som behövde bemanning. Din tid räknas fortfarande som dina timmar.`,
        dates: lent.map((sd) => sd.date),
        accent: "bg-teal-100 text-teal-700",
      });
    }

    if (kontor.length > 0) {
      cards.push({
        key: "kontor",
        icon: Briefcase,
        title: "Planerings- & kontorstid",
        count: kontor.length,
        text: employee.is_planerare
          ? "Vid överbemanning delas passet och du — som planerare — prioriteras för planeringstid."
          : "Vid överbemanning omvandlas en del av passet till kontors-/planeringstid.",
        dates: kontor.map((sd) => sd.date),
        accent: "bg-cyan-100 text-cyan-700",
      });
    }

    const ordinarie = dag + kvall;
    if (ordinarie > 0) {
      cards.push({
        key: "bemanning",
        icon: Scale,
        title: "Bemanningskrav — ordinarie pass",
        count: ordinarie,
        text: "Dag- och kvällspass som lades för att täcka bemanningsbehovet, prioriterat efter lägst ackumulerat timsaldo. Det håller nere övertid och fördelar passen rättvist.",
        accent: "bg-amber-100 text-amber-700",
      });
    }

    // Respekterade gränser
    const vetos = (employee.vetos as unknown as string[]) ?? [];

    const lifeSituations = readLifeSituations(employee);

    return {
      totalWork: workDays.length,
      dag,
      kvall,
      dagTidig: dagTidig.length,
      natt: natt.length,
      obokad: obokad.length,
      weekendWork,
      absenceDays: absenceDays.length,
      cards,
      vetos,
      lifeSituations,
    };
  }, [employee, schedule, decisions]);

  const hasSchedule = data.totalWork > 0 || data.obokad > 0 || data.absenceDays > 0;

  if (!hasSchedule) return null;

  const summary: { label: string; value: number | string }[] = [
    { label: "Arbetspass", value: data.totalWork },
    { label: "Dagpass", value: data.dag + data.dagTidig },
    { label: "Kvällspass", value: data.kvall },
  ];
  if (data.natt > 0) summary.push({ label: "Nattpass", value: data.natt });
  if (data.obokad > 0) summary.push({ label: "Obokad", value: data.obokad });
  if (data.weekendWork > 0) summary.push({ label: "Helgpass", value: data.weekendWork });
  if (data.absenceDays > 0) summary.push({ label: "Frånvaro", value: data.absenceDays });

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-terracotta/5 to-transparent">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle size={18} className="text-terracotta" />
          Varför ser ditt schema ut så här?
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          En begriplig förklaring av besluten bakom ditt schema. Allt är regelstyrt — du ska alltid kunna se <em>varför</em>.
          {" "}Kontrakt: <span className="font-semibold text-gray-700">{CONTRACT_LABEL[employee.contract_type] ?? employee.contract_type}</span>
          {employee.percentage != null && employee.percentage !== 1
            ? ` · ${Math.round(employee.percentage * 100)} % tjänstgöring`
            : ""}
        </p>
      </div>

      <div className="p-5 space-y-6">
        {/* Sammanfattning */}
        <div className="flex flex-wrap gap-2">
          {summary.map((s) => (
            <div
              key={s.label}
              className="flex items-baseline gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
            >
              <span className="text-lg font-bold text-gray-900">{s.value}</span>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Förklaringskort */}
        {data.cards.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Det här styrde ditt schema
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.cards.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.key} className="border border-gray-100 rounded-xl p-4 bg-white">
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.accent}`}>
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900">{c.title}</h4>
                          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                            {c.count}×
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed mt-1">{c.text}</p>
                        {c.dates && c.dates.length > 0 && (
                          <p className="text-[10px] text-gray-400 font-mono mt-1.5">
                            {c.dates.slice(0, 8).join(" · ")}
                            {c.dates.length > 8 ? ` +${c.dates.length - 8}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hänsyn vi tagit (livssituationer från AI-lagret) */}
        {data.lifeSituations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Hänsyn vi tagit
            </h3>
            <div className="space-y-2">
              {data.lifeSituations.map((ls, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border border-rose-100 bg-rose-50/40 rounded-xl p-3"
                >
                  <HeartHandshake size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{ls.title}</p>
                    {ls.text && <p className="text-xs text-gray-600 mt-0.5">{ls.text}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Respekterade gränser */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            Det här respekterade vi alltid
          </h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2.5 border border-gray-100 rounded-xl p-3">
              <ShieldCheck size={16} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-800">11h dygnsvila</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Aldrig bruten — garanterad av motorn.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 border border-gray-100 rounded-xl p-3">
              <Ban size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-800">
                  Dina veton ({data.vetos.length})
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {data.vetos.length > 0
                    ? `Du blev aldrig schemalagd: ${data.vetos.slice(0, 3).join(", ")}${data.vetos.length > 3 ? "…" : ""}`
                    : "Inga veton lagda denna period."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 border border-gray-100 rounded-xl p-3">
              <CalendarOff size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-800">
                  Frånvaro ({data.absenceDays})
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Inga pass lades på dina frånvarodagar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
