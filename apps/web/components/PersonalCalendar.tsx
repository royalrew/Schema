"use client";
import { useState, useCallback, useEffect } from "react";
import { format, getDaysInMonth, getDay } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Star, CalendarDays, Clock, UserCircle, LogOut, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateWishSchedule, fetchShiftConfigs, fetchSchedule, fetchPeriodInfo, fetchEmployee, updateWishes, type WishShiftEntry } from "@/lib/api";
import { getUser, clearToken } from "@/lib/auth";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { DagValjare, type ShiftPreset } from "./DagValjare";
import { Personkort } from "./Personkort";
import { FranvaroManager } from "./FranvaroManager";
import { WelcomeGuide } from "./WelcomeGuide";
import type { Employee, ScheduleDay, Phase } from "@/lib/types";

const DAY_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const SHIFT: Record<string, { label: string; sub: string; bg: string; fg: string }> = {
  dag_tidig: { label: "Dag tidig", sub: "06:45 – 16:00", bg: "#1e40af", fg: "#fff" },
  dag:       { label: "Dag",       sub: "07:00 – 16:00", bg: "#3b82f6", fg: "#fff" },
  kval_kort: { label: "Kväll",     sub: "13:45 – 20:00", bg: "#7c3aed", fg: "#fff" },
  kval_lang: { label: "Kväll lång",sub: "13:45 – 21:30", bg: "#6d28d9", fg: "#fff" },
  delad_tur: { label: "Delad tur", sub: "07:00 + 15:30",  bg: "#4f46e5", fg: "#fff" },
  natt:      { label: "Natt",      sub: "22:00 – 07:00", bg: "#1e293b", fg: "#fff" },
  obokad:    { label: "Obokad",    sub: "Buffert",        bg: "#e5e7eb", fg: "#6b7280" },
  APT:       { label: "APT",       sub: "13:45 – 16:00", bg: "#0d9488", fg: "#fff" },
};

const ABSENCE: Record<string, { label: string; sub: string; bg: string; fg: string }> = {
  sem:  { label: "Semester",     sub: "", bg: "#fb923c", fg: "#fff" },
  FL:   { label: "Föräldraled.", sub: "", bg: "#fdba74", fg: "#fff" },
  TJL:  { label: "Tjänsteled.",  sub: "", bg: "#fbbf24", fg: "#fff" },
  VAB:  { label: "VAB",          sub: "Vård av barn", bg: "#38bdf8", fg: "#fff" },
  KOM:  { label: "Kompledig",    sub: "", bg: "#2dd4bf", fg: "#fff" },
  STU:  { label: "Studieledig.", sub: "", bg: "#818cf8", fg: "#fff" },
  sjuk: { label: "Sjukskrivning",sub: "", bg: "#ef4444", fg: "#fff" },
};

function isoWeek(d: Date) {
  const t = new Date(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - w.getTime()) / 86400000 - 3 + ((w.getDay() + 6) % 7)) / 7);
}

interface Props {
  employee: Employee;
  initialSchedule: ScheduleDay[];
  initialPhase: Phase;
  year: number;
  month: number;
}

export function PersonalCalendar({
  employee: init,
  initialSchedule,
  initialPhase,
  year: initYear,
  month: initMonth,
}: Props) {
  const router = useRouter();
  const [emp, setEmp] = useState(init);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(initialSchedule);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [saving, setSaving] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  // Hämta förinställda passtider för gruppen
  useEffect(() => {
    fetchShiftConfigs(emp.group).then(configs => {
      setPresets(configs.map(c => ({
        shift_type: c.shift_type,
        start_time: c.start_time,
        end_time: c.end_time,
        label: c.label ?? c.shift_type,
      })));
    }).catch(() => {});
  }, [emp.group]);

  const wishes = new Set<string>(emp.wishes as unknown as string[]);

  async function loadMonth(y: number, m: number) {
    setYear(y);
    setMonth(m);
    const [sched, info, fresh] = await Promise.all([
      fetchSchedule(emp.group, y, m).catch(() => []),
      fetchPeriodInfo(emp.group, y, m).catch(() => ({ phase: "wish" as Phase, has_schedule: false })),
      fetchEmployee(emp.id).catch(() => emp),
    ]);
    setSchedule(sched.filter(sd => sd.employee_id === emp.id));
    setPhase(info.phase);
    setEmp(fresh);
  }

  const toggleWish = useCallback(async (dateStr: string) => {
    const next = new Set<string>(emp.wishes as unknown as string[]);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    const arr = Array.from(next);
    setSaving(true);
    try {
      await updateWishes(emp.id, arr);
      setEmp(prev => ({ ...prev, wishes: arr as unknown as typeof prev.wishes }));
    } finally {
      setSaving(false);
    }
  }, [emp]);

  /* ── kalenderstruktur ── */
  const n = getDaysInMonth(new Date(year, month - 1));
  const firstWd = (getDay(new Date(year, month - 1, 1)) + 6) % 7;
  const padded: (number | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const schedIdx = new Map(schedule.map(sd => [sd.date as unknown as string, sd]));
  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: sv });
  const workedDays = schedule.filter(sd => sd.shift && !sd.shift.is_unbooked).length;

  // Wish schedule index
  const rawWishSchedule: WishShiftEntry[] = (emp as unknown as { wish_schedule?: WishShiftEntry[] }).wish_schedule ?? [];
  const wishIdx = new Map(rawWishSchedule.map(w => [w.date, w]));

  const saveWishEntry = useCallback(async (entry: WishShiftEntry | null, dateStr: string) => {
    setSaving(true);
    setOpenDay(null);
    try {
      const current = rawWishSchedule.filter(w => w.date !== dateStr);
      const updated = entry ? [...current, entry] : current;
      await updateWishSchedule(emp.id, updated);
      const fresh = await fetchEmployee(emp.id).catch(() => emp);
      setEmp(fresh);
    } finally {
      setSaving(false);
    }
  }, [emp, rawWishSchedule]);

  const WEEKLY_HOURS: Record<string, number> = {
    dagtid: 40, varierande: 37, kval: 30,
    helg_fre_man: 26, natt: 34.33,
    vikarie: 0,
  };
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const targetHours = (WEEKLY_HOURS[emp.contract_type] ?? 37) * daysInMonth / 7;
  const actualHours = schedule.reduce((sum, sd) => {
    if (!sd.shift || sd.shift.is_unbooked) return sum;
    return sum + sd.shift.segments.reduce((s, seg) =>
      s + (new Date(seg.end_time).getTime() - new Date(seg.start_time).getTime()) / 3_600_000, 0);
  }, 0);
  const saldo = actualHours - targetHours;

  const wishedDays = rawWishSchedule.filter(w => w.start_time !== null).length;

  const PHASE_CONFIG = {
    wish: {
      banner: "bg-green-50 border-green-200 text-green-800",
      icon: "🗓️",
      title: "Önskeläge är aktivt",
      desc: "Klicka på en dag för att lägga in din önskade arbetstid. Välj förinställd tid eller skriv in egen.",
    },
    correction: {
      banner: "bg-blue-50 border-blue-200 text-blue-800",
      icon: "✅",
      title: "Ditt schema är klart",
      desc: "Schemat har genererats. Kontakta din chef om något behöver justeras.",
    },
    attested: {
      banner: "bg-gray-50 border-gray-200 text-gray-700",
      icon: "🔒",
      title: "Schemat är attesterat",
      desc: "Schemat är godkänt och låst. Det används nu som löneunderlag.",
    },
  };
  const phaseConf = PHASE_CONFIG[phase];

  return (
    <div className="min-h-screen bg-paper">
      <WelcomeGuide userId={getUser()?.user_id ?? 0} />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">{emp.name}</h1>
            <p className="text-sm text-gray-400">{emp.group} · {emp.contract_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/systembeskrivning" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-terracotta hover:bg-cream rounded-lg transition-colors cursor-pointer">
            <Scale size={14} /> Systembeskrivning
          </Link>
          <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-terracotta hover:bg-cream rounded-lg transition-colors cursor-pointer">
            <UserCircle size={14} /> Byt lösenord
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
            <LogOut size={14} /> Logga ut
          </button>
        </div>
      </div>

      {/* ── Fas-banner (framträdande) ── */}
      <div className={`border-b px-4 py-3 ${phaseConf.banner}`}>
        <div className="max-w-lg mx-auto flex items-start gap-3">
          <span className="text-xl shrink-0">{phaseConf.icon}</span>
          <div>
            <p className="font-semibold text-sm">{phaseConf.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{phaseConf.desc}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {/* ── Månadsnavigering ── */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => loadMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 shadow-sm"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-gray-900 capitalize">{monthName}</h2>
          <button
            onClick={() => loadMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 shadow-sm"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ── Tvåkolumnslayout: kalender vänster, sidebar höger ── */}
        <div className="flex gap-4 items-start">

          {/* VÄNSTER: Kalender */}
          <div className="flex-1 min-w-0">{/* ── Kalender ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {DAY_SHORT.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-semibold ${i >= 5 ? "text-blue-500" : "text-gray-400"}`}>
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => {
            const firstReal = week.find(d => d !== null);
            if (!firstReal) return null;
            const wn = isoWeek(new Date(year, month - 1, firstReal));
            return (
              <div key={wi} className={`grid grid-cols-7 ${wi > 0 ? "border-t border-gray-200" : ""}`}>
                {week.map((day, di) => {
                  if (!day) return (
                    <div key={di} className={`min-h-20 bg-gray-100 ${di < 6 ? "border-r border-gray-200" : ""}`}
                      style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,0.03) 4px,rgba(0,0,0,0.03) 8px)" }}
                    >
                      {di === 0 && <span className="text-[9px] text-gray-300 p-1 block">v{wn}</span>}
                    </div>
                  );

                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const sd = schedIdx.get(dateStr);
                  const wishEntry = wishIdx.get(dateStr) ?? null;
                  const isWe = di >= 5;
                  const canEdit = phase === "wish" && !sd?.absence;
                  const isOpen = openDay === dateStr;

                  // Badge: visa önskad tur ELLER schemalagd tur ELLER frånvaro
                  let badge: { label: string; sub: string; bg: string; fg: string } | null = null;
                  if (sd?.absence) {
                    badge = ABSENCE[sd.absence.absence_type] ?? null;
                  } else if (wishEntry?.start_time) {
                    badge = {
                      label: wishEntry.shift_type
                        ? (SHIFT[wishEntry.shift_type]?.label ?? wishEntry.shift_type)
                        : "Anpassad",
                      sub: `${wishEntry.start_time}–${wishEntry.end_time}`,
                      bg: wishEntry.shift_type ? (SHIFT[wishEntry.shift_type]?.bg ?? "#6366f1") : "#6366f1",
                      fg: "#fff",
                    };
                  } else if (wishEntry?.start_time === null && wishEntry !== null) {
                    badge = { label: "Ledig", sub: "Önskar ledigt", bg: "#f3f4f6", fg: "#6b7280" };
                  } else if (sd?.shift && !sd.shift.is_unbooked) {
                    badge = SHIFT[sd.shift.shift_type] ?? null;
                  }

                  const dayName = ["mån","tis","ons","tor","fre","lör","sön"][di];
                  const dateLabel = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day} ${format(new Date(year, month - 1), "MMMM", { locale: sv })}`;

                  return (
                    <div
                      key={di}
                      className={[
                        "relative min-h-20 p-2 flex flex-col gap-1 select-none",
                        di < 6 ? "border-r border-gray-100" : "",
                        isWe ? "bg-blue-50/40" : "",
                        wishEntry && !wishEntry.start_time ? "bg-gray-50" : "",
                        wishEntry?.start_time ? "bg-green-50/30" : "",
                        canEdit ? "cursor-pointer hover:bg-blue-50/30 transition-colors" : "",
                        saving ? "opacity-50" : "",
                      ].join(" ")}
                      onClick={() => canEdit && setOpenDay(isOpen ? null : dateStr)}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-base font-bold ${isWe ? "text-blue-600" : "text-gray-800"}`}>{day}</span>
                        {di === 0 && <span className="text-[9px] text-gray-300">v{wn}</span>}
                      </div>

                      {badge ? (
                        <span
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg text-center block leading-tight"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                          {badge.sub && <span className="block text-[9px] font-normal opacity-75">{badge.sub}</span>}
                        </span>
                      ) : canEdit ? (
                        <span className="text-[10px] text-gray-300 text-center block mt-1">+ lägg tur</span>
                      ) : null}

                      {/* DagValjare popover */}
                      {isOpen && (
                        <DagValjare
                          date={dateStr}
                          dateLabel={dateLabel}
                          presets={presets}
                          current={wishEntry}
                          onSave={entry => saveWishEntry(entry, dateStr)}
                          onClose={() => setOpenDay(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

          </div>{/* slut vänster kalender-div */}

          {/* HÖGER: Stats + Personkort */}
          <div className="w-72 shrink-0 space-y-4">

            {/* Statistikkort */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sammanfattning</p>
              </div>
              <div className="divide-y divide-gray-50">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-blue-400" />
                    <span className="text-sm text-gray-600">Schemalagda pass</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{workedDays}</span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-purple-400" />
                    <span className="text-sm text-gray-600">Timmar</span>
                  </div>
                  <span className="text-sm font-mono text-gray-700">
                    {actualHours.toFixed(1)}h / {targetHours.toFixed(1)}h
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Timsaldo</span>
                  <span className={`text-lg font-bold ${Math.abs(saldo) <= 4 ? "text-green-600" : "text-red-500"}`}>
                    {saldo >= 0 ? "+" : ""}{saldo.toFixed(1)}h
                  </span>
                </div>
                {phase === "wish" && (
                  <div className="px-4 py-3 flex items-center justify-between bg-green-50">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-green-500" />
                      <span className="text-sm text-green-700 font-medium">Önskemål inlagda</span>
                    </div>
                    <span className="text-lg font-bold text-green-700">{wishedDays}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Frånvaro */}
            <div>
              <FranvaroManager employee={emp} onUpdate={setEmp} />
            </div>

            {/* Personkort */}
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <UserCircle size={15} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personkort</span>
              </div>
              <Personkort employee={emp} onUpdate={setEmp} />
            </div>

          </div>{/* slut höger */}
        </div>{/* slut flex */}
      </div>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
