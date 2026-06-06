"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Save, Check, ClipboardList, Calendar, Settings, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { fetchStaffingTemplate, saveStaffingTemplate, fetchGroups, fetchStaffing, saveStaffing } from "@/lib/api";
import type { DayKrav } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import { getDaysInMonth, format } from "date-fns";
import { sv } from "date-fns/locale";
import type { Bemanningskrav, HourlyRequirement } from "@/lib/types";

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

function defaultTemplate(): DayKrav[] {
  return Array.from({ length: 7 }, () => ({ fm: 2, kval: 2, natt: 0 }));
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded-lg border border-ink/10 text-ink-soft hover:bg-ink/5 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer"
      >−</button>
      <span className="w-8 text-center text-sm font-bold text-ink tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(10, value + 1))}
        className="w-7 h-7 rounded-lg border border-ink/10 text-ink-soft hover:bg-ink/5 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer"
      >+</button>
    </div>
  );
}

export default function SchemalaggarePage() {
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"template" | "month">("template");

  // Veckomall state
  const [templateDays, setTemplateDays] = useState<DayKrav[]>(defaultTemplate());
  const [forceShowNatt, setForceShowNatt] = useState(false);

  // Månadsjustering state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthDays, setMonthDays] = useState<Bemanningskrav[]>([]);

  // System states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ladda grupper vid start
  useEffect(() => {
    async function loadGroups() {
      try {
        const data = await fetchGroups();
        if (data && data.length > 0) {
          setGroups(data);
          setSelectedGroup(data[0]);
        } else {
          const fallback = ["Norra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];
          setGroups(fallback);
          setSelectedGroup(fallback[0]);
        }
      } catch (err) {
        const fallback = ["Norra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];
        setGroups(fallback);
        setSelectedGroup(fallback[0]);
      }
    }
    loadGroups();
  }, []);

  // Ladda mall- eller månadsdata
  const loadData = useCallback(async () => {
    if (!selectedGroup) return;
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "template") {
        const data = await fetchStaffingTemplate(selectedGroup);
        setTemplateDays(data.per_weekday?.length === 7 ? data.per_weekday : defaultTemplate());
      } else {
        // Hämta månadens faktiska krav
        const data = await fetchStaffing(selectedGroup, year, month);
        setMonthDays(data);
      }
    } catch (err) {
      console.error(err);
      setError("Kunde inte hämta bemanningsdata");
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, activeTab, year, month]);

  useEffect(() => {
    loadData();
    setSaved(false);
  }, [loadData]);

  // Uppdatera cell i veckomall
  function updateTemplate(dayIdx: number, field: keyof DayKrav, value: number) {
    setTemplateDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, [field]: value } : d));
    setSaved(false);
  }

  // Uppdatera cell i månadsjusteringar
  function updateMonthDay(dateStr: string, field: keyof Omit<Bemanningskrav, "group" | "date">, value: number) {
    setMonthDays(prev => prev.map(d => d.date === dateStr ? { ...d, [field]: value } : d));
    setSaved(false);
  }

  function updateTemplateHourly(dayIdx: number, reqs: HourlyRequirement[]) {
    setTemplateDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, hourly_requirements: reqs } : d));
    setSaved(false);
  }

  function updateMonthDayHourly(dateStr: string, reqs: HourlyRequirement[]) {
    setMonthDays(prev => prev.map(d => d.date === dateStr ? { ...d, hourly_requirements: reqs } : d));
    setSaved(false);
  }

  // Hämta värden från veckomall och applicera på månadsjusteringar
  const handleApplyTemplateToMonth = useCallback(async () => {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      // Hämta den senaste veckomallen först för att vara säker
      const tmpl = await fetchStaffingTemplate(selectedGroup);
      const activeTmpl = tmpl.per_weekday?.length === 7 ? tmpl.per_weekday : templateDays;
      
      const daysInMonth = getDaysInMonth(new Date(year, month - 1));
      const updatedDays: Bemanningskrav[] = [];

      for (let dNum = 1; dNum <= daysInMonth; dNum++) {
        const d = new Date(year, month - 1, dNum);
        const wd = d.getDay(); // 0 = söndag, 1 = måndag...
        const templateIdx = wd === 0 ? 6 : wd - 1; // 0=Mån, 6=Sön
        const templateDay = activeTmpl[templateIdx] || { fm: 2, kval: 2, natt: 0 };
        
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
        updatedDays.push({
          group: selectedGroup as any,
          date: dateStr,
          fm_heads: templateDay.fm,
          em_heads: 0,
          kval_heads: templateDay.kval,
          natt_heads: templateDay.natt,
          hourly_requirements: templateDay.hourly_requirements || [],
        });
      }
      setMonthDays(updatedDays);
      setSaved(false);
    } catch (err) {
      setError("Kunde inte tillämpa veckomall");
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, year, month, templateDays]);

  // Spara data
  async function handleSave() {
    if (!selectedGroup) return;
    setSaving(true);
    setError(null);
    try {
      if (activeTab === "template") {
        await saveStaffingTemplate({ group_name: selectedGroup, per_weekday: templateDays });
      } else {
        await saveStaffing(monthDays);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError("Kunde inte spara inställningarna");
    } finally {
      setSaving(false);
    }
  }

  const isNatten = selectedGroup === "Natten";
  const showNatt = templateDays.some(d => d.natt > 0) || isNatten || forceShowNatt;
  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: sv });

  // Gruppera månadsdagar vecka för vecka för enklare läsbarhet
  const monthWeeks = (() => {
    const weeks: { weekNumber: number; days: Bemanningskrav[] }[] = [];
    let currentWeek: Bemanningskrav[] = [];
    
    monthDays.forEach(day => {
      const d = new Date(day.date);
      // ISO-vecka
      const weekNumber = parseInt(format(d, "I"));
      
      if (currentWeek.length > 0) {
        const lastDay = new Date(currentWeek[currentWeek.length - 1].date);
        const lastWeekNum = parseInt(format(lastDay, "I"));
        if (lastWeekNum !== weekNumber) {
          weeks.push({ weekNumber: lastWeekNum, days: currentWeek });
          currentWeek = [];
        }
      }
      currentWeek.push(day);
    });
    
    if (currentWeek.length > 0) {
      const lastDay = new Date(currentWeek[currentWeek.length - 1].date);
      const lastWeekNum = parseInt(format(lastDay, "I"));
      weeks.push({ weekNumber: lastWeekNum, days: currentWeek });
    }
    
    return weeks;
  })();

  return (
    <AuthGuard requiredRole="admin">
      <div className="min-h-screen bg-paper text-ink pb-16">
        {/* ── Top Bar ── */}
        <div className="bg-white/70 backdrop-blur-sm border-b border-ink/8 px-6 py-4 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-sm font-semibold text-ink-soft hover:text-ink transition-colors">
                ← Översikt
              </Link>
              <div className="w-px h-4 bg-ink/10" />
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-terracotta" />
                <h1 className="text-base font-bold text-ink">Bemanningskrav</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || loading || groups.length === 0}
                className="flex items-center gap-1.5 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer shadow-md shadow-terracotta/10 hover:shadow-lg transition-all"
              >
                {saved ? <Check size={14} className="animate-bounce" /> : <Save size={14} />}
                {saving ? "Sparar…" : saved ? "Sparat!" : "Spara ändringar"}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Felmeddelande */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800 flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* ── Gruppväljare ── */}
          <div className="flex flex-col gap-2.5">
            <label className="mono-label text-ink-soft/60">Välj hemvårdsgrupp</label>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedGroup === g
                      ? "bg-terracotta text-white shadow-md shadow-terracotta/15"
                      : "bg-white border border-ink/8 text-ink hover:bg-ink/5 hover:border-ink/15"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── Flikar för Mall vs Månad ── */}
          <div className="flex bg-ink/5 p-1 rounded-2xl w-full sm:w-96">
            <button
              onClick={() => setActiveTab("template")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "template"
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-soft/75 hover:text-ink"
              }`}
            >
              <Settings size={13} />
              Veckomall (Mån–Sön)
            </button>
            <button
              onClick={() => setActiveTab("month")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "month"
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-soft/75 hover:text-ink"
              }`}
            >
              <Calendar size={13} />
              Månadsjusteringar
            </button>
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
            <span className="font-bold text-amber-900 block mb-0.5">ℹ️ Helgbemanning i Töreboda</span>
            Fredag kväll (13:45–) räknas som helgbemanning. Ange därför helgkravet för fredag kväll under "Fredag" kolumnen/raden. Vardagsbemanning gäller måndag–torsdag (dygnet runt) samt fredag förmiddag.
          </div>

          {loading ? (
            <div className="bg-white/60 border border-ink/8 rounded-3xl p-12 flex items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-ink-soft">Laddar bemanningsdata…</span>
              </div>
            </div>
          ) : activeTab === "template" ? (
            /* ════════ TAB 1: VECKOMALL (SAMMANFOGAD) ════════ */
            <div className="space-y-6">
              {/* Header för Veckomall */}
              <div className="bg-white/60 backdrop-blur-md border border-ink/8 p-5 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-ink">{selectedGroup} — Standardmall & Bemanningskrav</h2>
                  <p className="text-[11px] text-ink-soft mt-0.5">Konfigurera standardbehovet för pass (Fm, Kväll, Natt) samt tim- och överlappskrav för varje veckodag.</p>
                </div>
                
                {!showNatt && !isNatten && (
                  <button
                    onClick={() => setForceShowNatt(true)}
                    className="text-xs font-bold text-terracotta hover:underline cursor-pointer border border-terracotta/20 hover:border-terracotta/50 bg-terracotta/5 px-3.5 py-2 rounded-xl transition-all"
                  >
                    + Visa nattpass
                  </button>
                )}
              </div>

              {/* Grid av Dagskort */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templateDays.map((day, i) => {
                  const isWeekend = i === 5 || i === 6; // Lör, Sön
                  const isFriday = i === 4; // Fre
                  return (
                    <div key={i} className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-3xl p-5 flex flex-col gap-4 shadow-xs hover:shadow-md transition-all">
                      {/* Kort-Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-ink/5">
                        <h3 className="font-bold text-sm text-ink">{DAY_NAMES[i]}dag</h3>
                        <div className="flex gap-1">
                          {isFriday && <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-sm">kväll = helg</span>}
                          {isWeekend && <span className="text-[9px] font-bold bg-terracotta/5 text-terracotta border border-terracotta/15 px-1.5 py-0.5 rounded-sm">helg</span>}
                        </div>
                      </div>

                      {/* Passbehov (Fm, Kväll, Natt) */}
                      <div className="grid grid-cols-3 gap-3">
                        {/* Förmiddag (ej nattgrupp) */}
                        {!isNatten && (
                          <div className="bg-blue-50/20 border border-blue-500/10 rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                              <span className="text-[10px] font-bold text-ink-soft">Förmiddag</span>
                            </div>
                            <Stepper value={day.fm} onChange={v => updateTemplate(i, "fm", v)} />
                          </div>
                        )}

                        {/* Kväll (ej nattgrupp) */}
                        {!isNatten && (
                          <div className="bg-purple-50/20 border border-purple-500/10 rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                              <span className="text-[10px] font-bold text-ink-soft">Kväll</span>
                            </div>
                            <Stepper value={day.kval} onChange={v => updateTemplate(i, "kval", v)} />
                          </div>
                        )}

                        {/* Natt */}
                        {(showNatt || isNatten || day.natt > 0) && (
                          <div className={`bg-slate-50/20 border border-slate-800/10 rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5 ${isNatten ? "col-span-3" : ""}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
                              <span className="text-[10px] font-bold text-ink-soft">Natt</span>
                            </div>
                            <Stepper value={day.natt} onChange={v => updateTemplate(i, "natt", v)} />
                          </div>
                        )}
                      </div>

                      {/* Tim- och överlappskrav */}
                      <div className="pt-3 border-t border-ink/5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-ink-soft">Timbemanning / Överlappskrav:</span>
                          <button
                            onClick={() => {
                              const copy = [...(day.hourly_requirements || [])];
                              copy.push({ start_time: "14:00", end_time: "16:00", needed_heads: 2, prioritized_activities: ["planeringstid", "kontorstid"] });
                              updateTemplateHourly(i, copy);
                            }}
                            className="text-[10px] font-bold text-terracotta hover:underline cursor-pointer"
                          >
                            + Lägg till timkrav
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {(day.hourly_requirements || []).map((hr, hrIdx) => (
                            <div key={hrIdx} className="flex items-center gap-2 bg-cream/40 p-2 rounded-xl border border-ink/5">
                              <input
                                type="text"
                                value={hr.start_time}
                                onChange={e => {
                                  const copy = [...day.hourly_requirements!];
                                  copy[hrIdx] = { ...copy[hrIdx], start_time: e.target.value };
                                  updateTemplateHourly(i, copy);
                                }}
                                className="w-14 border border-ink/10 rounded-md px-1.5 py-0.5 text-[10px] text-center font-mono bg-white focus:outline-none"
                                placeholder="14:00"
                              />
                              <span className="text-[10px] text-ink-soft">—</span>
                              <input
                                type="text"
                                value={hr.end_time}
                                onChange={e => {
                                  const copy = [...day.hourly_requirements!];
                                  copy[hrIdx] = { ...copy[hrIdx], end_time: e.target.value };
                                  updateTemplateHourly(i, copy);
                                }}
                                className="w-14 border border-ink/10 rounded-md px-1.5 py-0.5 text-[10px] text-center font-mono bg-white focus:outline-none"
                                placeholder="16:00"
                              />
                              <div className="w-px h-3 bg-ink/10" />
                              <span className="text-[10px] text-ink-soft">Krav:</span>
                              <input
                                type="number"
                                value={hr.needed_heads}
                                onChange={e => {
                                  const copy = [...day.hourly_requirements!];
                                  copy[hrIdx] = { ...copy[hrIdx], needed_heads: parseInt(e.target.value) || 0 };
                                  updateTemplateHourly(i, copy);
                                }}
                                className="w-10 border border-ink/10 rounded-md px-1 py-0.5 text-[10px] text-center font-bold bg-white focus:outline-none"
                                min="0"
                              />
                              <button
                                onClick={() => {
                                  const copy = [...day.hourly_requirements!];
                                  copy.splice(hrIdx, 1);
                                  updateTemplateHourly(i, copy);
                                }}
                                className="text-red-500 hover:text-red-700 text-[10px] ml-auto p-1 font-bold cursor-pointer"
                              >
                                Ta bort
                              </button>
                            </div>
                          ))}
                          {(!day.hourly_requirements || day.hourly_requirements.length === 0) && (
                            <p className="text-[10px] text-ink-soft/40 italic">Inga timkrav satta för denna dag.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ════════ TAB 2: MÅNADSJUSTERINGAR ════════ */
            <div className="space-y-6">
              {/* Månadsväljare + Återställningskontroller */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 backdrop-blur-md border border-ink/8 p-5 rounded-3xl shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-ink">Aktiv schemaperiod:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (month === 1) { setMonth(12); setYear(y => y - 1); }
                        else setMonth(m => m - 1);
                      }}
                      className="p-1.5 rounded-lg border border-ink/10 hover:bg-ink/5 text-ink-soft transition cursor-pointer"
                    >
                      ←
                    </button>
                    <span className="text-xs font-bold capitalize w-32 text-center select-none">{monthName}</span>
                    <button
                      onClick={() => {
                        if (month === 12) { setMonth(1); setYear(y => y + 1); }
                        else setMonth(m => m + 1);
                      }}
                      className="p-1.5 rounded-lg border border-ink/10 hover:bg-ink/5 text-ink-soft transition cursor-pointer"
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleApplyTemplateToMonth}
                    className="flex items-center gap-1 text-[11px] font-bold bg-cream border border-ink/12 hover:bg-ink/5 hover:border-ink/20 text-ink px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                    title="Skriv över denna månads dagsjusteringar med grundbehovet från veckomallen"
                  >
                    <RefreshCw size={11} />
                    Fyll från veckomall
                  </button>
                </div>
              </div>

              {/* Justeringslista grupperat vecka för vecka */}
              {monthWeeks.map(({ weekNumber, days }) => (
                <div key={weekNumber} className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-3xl overflow-hidden shadow-xs">
                  <div className="px-6 py-3 border-b border-ink/8 bg-ink/[0.01] flex justify-between items-center">
                    <span className="mono-label text-[10px] text-ink-soft/50">Vecka {weekNumber}</span>
                  </div>
                  
                  <div className="divide-y divide-ink/8">
                    {days.map(day => {
                      const d = new Date(day.date);
                      const isWdWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isFriday = d.getDay() === 5;
                      const dateDisplay = format(d, "EEEE d MMMM", { locale: sv });
                      
                      return (
                        <div
                          key={day.date}
                          className={`px-6 py-4 flex flex-col gap-3 transition-colors ${
                            isWdWeekend ? "bg-terracotta/[0.01]" : ""
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Datumetikett */}
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold capitalize text-ink">
                                {dateDisplay}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-ink-soft/50 font-mono">{day.date}</span>
                                {isFriday && (
                                  <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-sm">
                                    kväll = helgbemanning
                                  </span>
                                )}
                                {isWdWeekend && (
                                  <span className="text-[9px] font-bold bg-terracotta/5 text-terracotta border border-terracotta/15 px-1.5 py-0.2 rounded-sm">
                                    helg
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Justeringskontroller */}
                            <div className="flex flex-wrap items-center gap-6 md:gap-8">
                              {/* Förmiddag (ej nattgrupp) */}
                              {!isNatten && (
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-5 bg-blue-500 rounded-sm block shrink-0" />
                                  <div className="text-[10px] font-bold text-ink-soft w-14">Fm</div>
                                  <Stepper
                                    value={day.fm_heads}
                                    onChange={v => updateMonthDay(day.date, "fm_heads", v)}
                                  />
                                </div>
                              )}

                              {/* Kväll (ej nattgrupp) */}
                              {!isNatten && (
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-5 bg-purple-500 rounded-sm block shrink-0" />
                                  <div className="text-[10px] font-bold text-ink-soft w-14">Kväll</div>
                                  <Stepper
                                    value={day.kval_heads}
                                    onChange={v => updateMonthDay(day.date, "kval_heads", v)}
                                  />
                                </div>
                              )}

                              {/* Natt */}
                              {(showNatt || isNatten || day.natt_heads > 0) && (
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-5 bg-slate-800 rounded-sm block shrink-0" />
                                  <div className="text-[10px] font-bold text-ink-soft w-14">Natt</div>
                                  <Stepper
                                    value={day.natt_heads}
                                    onChange={v => updateMonthDay(day.date, "natt_heads", v)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Timkrav list för en dag */}
                          <div className="mt-2 pt-2 border-t border-ink/5 w-full">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-ink-soft">Timbemanning / Överlappskrav:</span>
                              <button
                                onClick={() => {
                                  const copy = [...(day.hourly_requirements || [])];
                                  copy.push({ start_time: "14:00", end_time: "16:00", needed_heads: 2, prioritized_activities: ["planeringstid", "kontorstid"] });
                                  updateMonthDayHourly(day.date, copy);
                                }}
                                className="text-[10px] font-bold text-terracotta hover:underline cursor-pointer"
                              >
                                + Lägg till timkrav
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {(day.hourly_requirements || []).map((hr, hrIdx) => (
                                <div key={hrIdx} className="flex items-center gap-2 bg-cream/40 p-2 rounded-lg border border-ink/5">
                                  <input
                                    type="text"
                                    value={hr.start_time}
                                    onChange={e => {
                                      const copy = [...day.hourly_requirements!];
                                      copy[hrIdx] = { ...copy[hrIdx], start_time: e.target.value };
                                      updateMonthDayHourly(day.date, copy);
                                    }}
                                    className="w-14 border border-ink/10 rounded-md px-1.5 py-0.5 text-[10px] text-center font-mono bg-white focus:outline-none"
                                    placeholder="14:00"
                                  />
                                  <span className="text-[10px] text-ink-soft">—</span>
                                  <input
                                    type="text"
                                    value={hr.end_time}
                                    onChange={e => {
                                      const copy = [...day.hourly_requirements!];
                                      copy[hrIdx] = { ...copy[hrIdx], end_time: e.target.value };
                                      updateMonthDayHourly(day.date, copy);
                                    }}
                                    className="w-14 border border-ink/10 rounded-md px-1.5 py-0.5 text-[10px] text-center font-mono bg-white focus:outline-none"
                                    placeholder="16:00"
                                  />
                                  <div className="w-px h-3 bg-ink/10" />
                                  <span className="text-[10px] text-ink-soft">Krav:</span>
                                  <input
                                    type="number"
                                    value={hr.needed_heads}
                                    onChange={e => {
                                      const copy = [...day.hourly_requirements!];
                                      copy[hrIdx] = { ...copy[hrIdx], needed_heads: parseInt(e.target.value) || 0 };
                                      updateMonthDayHourly(day.date, copy);
                                    }}
                                    className="w-10 border border-ink/10 rounded-md px-1 py-0.5 text-[10px] text-center font-bold bg-white focus:outline-none"
                                    min="0"
                                  />
                                  <button
                                    onClick={() => {
                                      const copy = [...day.hourly_requirements!];
                                      copy.splice(hrIdx, 1);
                                      updateMonthDayHourly(day.date, copy);
                                    }}
                                    className="text-red-500 hover:text-red-700 text-[10px] ml-auto p-1 font-bold cursor-pointer"
                                  >
                                    Ta bort
                                  </button>
                                </div>
                              ))}
                              {(!day.hourly_requirements || day.hourly_requirements.length === 0) && (
                                <p className="text-[10px] text-ink-soft/40 italic">Inga timkrav satta för denna dag.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {monthDays.length === 0 && (
                <div className="bg-white/60 border border-ink/8 rounded-3xl p-12 text-center text-xs text-ink-soft">
                  Inga bemanningskrav genererade för denna månad. Klicka på "Fyll från veckomall" för att hämta standardkrav för perioden.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
