"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  Clock,
  Download,
  FileText,
  GitBranch,
  HeartHandshake,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminLayout } from "@/components/AdminLayout";
import { fetchEmployees, fetchFairnessReport, fetchGroups, fetchScenarioAnalysis, fetchStaffingReport, fetchWishReport } from "@/lib/api";
import type { Employee as EmployeeType, FairnessReport, ScenarioResult as ApiScenarioResult, StaffingReport, WishReport } from "@/lib/types";

type SituationStatus = "draft" | "active" | "parked" | "closed";
type SuggestionType = "temporary" | "note";

interface LifeSituation {
  id: string;
  employee: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: SituationStatus;
  suggestionType: SuggestionType;
  aiSummary: string;
  impacts: string[];
  risks: string[];
}

interface FallbackScenarioResult {
  verdict: string;
  score: number;
  direct: string[];
  chain: string[];
  risks: string[];
  decisionLog: string[];
}

const STORAGE_KEY = "sintari_life_situations";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

const DEFAULT_SITUATIONS: LifeSituation[] = [];

const STATUS_LABELS: Record<SituationStatus, string> = {
  draft: "Ny hänsyn",
  active: "Aktiv",
  parked: "Parkerad",
  closed: "Avslutad",
};

const STATUS_CLASSES: Record<SituationStatus, string> = {
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  active: "bg-green-50 text-green-800 border-green-200",
  parked: "bg-blue-50 text-blue-800 border-blue-200",
  closed: "bg-gray-50 text-gray-600 border-gray-200",
};

const TYPE_LABELS: Record<SuggestionType, string> = {
  temporary: "Tillfällig anpassning",
  note: "Planeringsanteckning",
};

function simulateScenario(employee: string, date: string, desiredShift: string): FallbackScenarioResult {
  const name = employee.trim() || "Vald medarbetare";
  const shiftLabel = desiredShift === "DAG" ? "dagpass" : desiredShift === "KVAL" ? "kvällspass" : "ledig dag";

  if (desiredShift === "LEDIG") {
    return {
      verdict: "Möjligt, men kräver ersättare",
      score: 74,
      direct: [`${name} tas bort från pass ${date}.`, "Timmålet sjunker och behöver fyllas senare i perioden."],
      chain: ["AI söker först ledig personal i samma grupp.", "Om ingen passar testas utlåning från närliggande grupp.", "Sista alternativet blir vikarie eller OBOKAD tid annan dag."],
      risks: ["Kan skapa underbemanning om datumet redan är pressat.", "Kan ge timunderskott om personen redan ligger lågt."],
      decisionLog: ["Önskan kontrollerad.", "Dygnsvila påverkas inte negativt.", "Bemanning måste lösas innan ändringen accepteras."],
    };
  }

  if (desiredShift === "KVAL") {
    return {
      verdict: "Möjligt med kvällskontroll",
      score: 79,
      direct: [`${name} flyttas till ${shiftLabel} ${date}.`, `${name}s timsaldo behålls inom periodmålet.`],
      chain: ["AI kontrollerar att personen inte får för många kvällar i rad.", "Tidigt dagpass dagen efter spärras om dygnsvilan blir för kort.", "Dagluckan som uppstår fylls med personal som har kvar dagmål."],
      risks: ["Kan skapa spärr mot tidigt pass dagen efter.", "Kan öka kvällsbelastningen om personen redan har många kvällar."],
      decisionLog: ["Hård regel: dygnsvila kontrollerad.", "Hård regel: veckovila kontrollerad.", "Mjuk regel: kvällsfördelning vägs in.", "Kedjan accepteras bara om bemanning och timsaldo fortfarande håller."],
    };
  }

  return {
    verdict: "Troligen möjligt",
    score: 86,
    direct: [`${name} flyttas till dagpass ${date}.`, `${name}s timsaldo behålls inom periodmålet.`],
    chain: ["AI letar efter vem som kan lämna dagpasset utan att bryta dygnsvila.", "Den personen testas mot kvällsbehov eller OBOKAD tid.", "Om kvällsbemanningen påverkas flyttas tredje person in i kedjan.", "Motorn stoppar hela kedjan om 11h dygnsvila eller 36h veckovila bryts."],
    risks: ["Kan flytta kvällsbelastning till annan ordinarie personal.", "Kan påverka rättvisefördelning om flera redan önskat dag."],
    decisionLog: ["Hård regel: dygnsvila kontrollerad.", "Hård regel: veckovila kontrollerad.", "Mjuk regel: önskemål och rättvisa vägs in.", "Kedjan accepteras bara om bemanning och timsaldo fortfarande håller."],
  };
}

function createSituation(input: {
  employee: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
}): LifeSituation {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const isEvening = text.includes("kväll") || text.includes("kvall");
  const isNew = text.includes("ny") || text.includes("intro");
  const isRehab = text.includes("rehab") || text.includes("gravid") || text.includes("behandling");

  let aiSummary = "Gör om situationen till en spårbar planeringsregel och låt schemamotorn validera effekten innan attest.";
  let impacts = ["Skapa tydlig giltighetsperiod", "Kontrollera dygnsvila och veckovila", "Visa påverkan på timsaldo"];
  let risks = ["Kan flytta belastning till andra medarbetare"];
  let suggestionType: SuggestionType = "temporary";

  if (isEvening) {
    aiSummary = "Föreslå en tillfällig kvällsspärr och kontrollera direkt om kvällsbemanningen fortfarande håller.";
    impacts = ["Spärra kvällspass under perioden", "Ersätt timmar med dagpass eller OBOKAD tid", "Flagga gruppdagar med kvällsbrist"];
    risks = ["Risk för kvällsbrist om flera har liknande anpassningar"];
  } else if (isNew) {
    aiSummary = "Lägg som introduktionsanteckning och varna om personen blir ensam på kritiska pass.";
    impacts = ["Undvik ensam dagsansvarig", "Para med erfaren kollega", "Följ upp efter perioden"];
    risks = ["Kvalitetsrisk snarare än juridiskt regelbrott"];
    suggestionType = "note";
  } else if (isRehab) {
    aiSummary = "Föreslå mjuk belastningsbegränsning och extra kontroll av återhämtning efter schemagenerering.";
    impacts = ["Undvik flera tunga pass i följd", "Prioritera jämn återhämtning", "Kontrollera att timmålet nås"];
    risks = ["Kan kräva manuell avvägning om bemanningen är pressad"];
  }

  return {
    id: `situation-${Date.now()}`,
    employee: input.employee,
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    status: "active",
    suggestionType,
    aiSummary,
    impacts,
    risks,
  };
}

export default function LivssituationerPage() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const [situations, setSituations] = useState<LifeSituation[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [scenarioGroup, setScenarioGroup] = useState("");
  const [scenarioYear, setScenarioYear] = useState(today.getFullYear());
  const [scenarioMonth, setScenarioMonth] = useState(today.getMonth() + 1);
  const [scenarioEmployees, setScenarioEmployees] = useState<EmployeeType[]>([]);
  const [employee, setEmployee] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(isoDate(nextMonth));
  const [endDate, setEndDate] = useState(isoDate(nextMonthEnd));
  const [scenarioEmployee, setScenarioEmployee] = useState("");
  const [scenarioDate, setScenarioDate] = useState(isoDate(today));
  const [scenarioShift, setScenarioShift] = useState("DAG");
  const [scenarioResult, setScenarioResult] = useState<ApiScenarioResult | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [reportGroup, setReportGroup] = useState<string>("ALLA");
  const [reportYear, setReportYear] = useState(today.getFullYear());
  const [reportMonth, setReportMonth] = useState(today.getMonth() + 1);
  const [wishReport, setWishReport] = useState<WishReport | null>(null);
  const [wishReportLoading, setWishReportLoading] = useState(false);
  const [wishReportError, setWishReportError] = useState<string | null>(null);
  const [staffingReport, setStaffingReport] = useState<StaffingReport | null>(null);
  const [staffingReportLoading, setStaffingReportLoading] = useState(false);
  const [staffingReportError, setStaffingReportError] = useState<string | null>(null);
  const [fairnessReport, setFairnessReport] = useState<FairnessReport | null>(null);
  const [fairnessLoading, setFairnessLoading] = useState(false);
  const [fairnessError, setFairnessError] = useState<string | null>(null);
  const scenarioEmployeeName = scenarioEmployees.find((emp) => emp.id === scenarioEmployee)?.name ?? scenarioEmployee;
  const fallbackScenario = useMemo(
    () => simulateScenario(scenarioEmployeeName || "Vald medarbetare", scenarioDate, scenarioShift),
    [scenarioEmployeeName, scenarioDate, scenarioShift],
  );
  const scenario = scenarioResult ?? fallbackScenario;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSituations(JSON.parse(saved));
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setSituations(DEFAULT_SITUATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SITUATIONS));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGroups()
      .then((groups) => {
        if (cancelled) return;
        setAvailableGroups(groups);
        setScenarioGroup((current) => current || groups[0] || "");
      })
      .catch(() => {
        if (!cancelled) setAvailableGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scenarioGroup) {
      setScenarioEmployees([]);
      setScenarioEmployee("");
      return;
    }
    let cancelled = false;
    fetchEmployees(scenarioGroup)
      .then((items) => {
        if (cancelled) return;
        const groupItems = items.filter((emp) => emp.group === scenarioGroup);
        setScenarioEmployees(groupItems);
        setScenarioEmployee((current) => current || groupItems[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) setScenarioEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioGroup]);

  const summary = useMemo(() => {
    return {
      active: situations.filter((s) => s.status === "active").length,
      draft: situations.filter((s) => s.status === "draft").length,
      total: situations.length,
    };
  }, [situations]);

  const saveSituations = (next: LifeSituation[]) => {
    setSituations(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addSituation = () => {
    if (!employee.trim() || !title.trim() || !description.trim()) return;
    saveSituations([
      createSituation({
        employee: employee.trim(),
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
      }),
      ...situations,
    ]);
    setEmployee("");
    setTitle("");
    setDescription("");
  };

  const runScenario = async () => {
    if (!scenarioEmployee) {
      setScenarioError("Välj en medarbetare först.");
      return;
    }
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const result = await fetchScenarioAnalysis({
        group: scenarioGroup,
        year: scenarioYear,
        month: scenarioMonth,
        employee_id: scenarioEmployee,
        date: scenarioDate,
        desired_shift: scenarioShift,
      });
      setScenarioResult(result);
    } catch (error) {
      setScenarioResult(null);
      setScenarioError(error instanceof Error ? error.message : "Kunde inte simulera scenariot");
    } finally {
      setScenarioLoading(false);
    }
  };

  const loadWishReport = async () => {
    setWishReportLoading(true);
    setWishReportError(null);
    try {
      const report = await fetchWishReport({
        year: reportYear,
        month: reportMonth,
        group: reportGroup === "ALLA" ? null : reportGroup,
      });
      setWishReport(report);
    } catch (error) {
      setWishReport(null);
      setWishReportError(error instanceof Error ? error.message : "Kunde inte hämta önskemålsrapport");
    } finally {
      setWishReportLoading(false);
    }
  };

  const loadStaffingReport = async () => {
    setStaffingReportLoading(true);
    setStaffingReportError(null);
    try {
      const report = await fetchStaffingReport({
        year: reportYear,
        month: reportMonth,
        group: reportGroup === "ALLA" ? null : reportGroup,
      });
      setStaffingReport(report);
    } catch (error) {
      setStaffingReport(null);
      setStaffingReportError(error instanceof Error ? error.message : "Kunde inte hämta bemanningsrapport");
    } finally {
      setStaffingReportLoading(false);
    }
  };

  const loadFairnessReport = async () => {
    setFairnessLoading(true);
    setFairnessError(null);
    try {
      const report = await fetchFairnessReport({
        year: reportYear,
        month: reportMonth,
        group: reportGroup === "ALLA" ? null : reportGroup,
      });
      setFairnessReport(report);
    } catch (error) {
      setFairnessReport(null);
      setFairnessError(error instanceof Error ? error.message : "Kunde inte hämta rättviserapport");
    } finally {
      setFairnessLoading(false);
    }
  };

  const exportWishReportCsv = () => {
    if (!wishReport) return;
    const rows = wishReport.items
      .filter((item) => !item.fulfilled)
      .map((item) => [
        item.group,
        item.employee_name,
        item.date,
        item.desired,
        item.actual,
        item.reason,
      ]);
    const csv = [
      ["Grupp", "Medarbetare", "Datum", "Önskade", "Fick", "Orsak"],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `onskemalsrapport-${wishReport.year}-${String(wishReport.month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateStatus = (id: string, status: SituationStatus) => {
    saveSituations(situations.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const removeSituation = (id: string) => {
    saveSituations(situations.filter((s) => s.id !== id));
  };

  return (
    <AuthGuard requiredRole="admin">
      <AdminLayout>
        <div className="min-h-screen bg-paper p-6">
          <main className="max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-terracotta bg-white border border-ink/8 rounded-full px-3 py-1">
                  <HeartHandshake size={14} />
                  Verksamhetslager ovanpå regelmotorn
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-ink">Livssituationer</h1>
                <p className="text-sm text-ink-soft max-w-2xl leading-relaxed">
                  Registrera mänskliga behov som AI kan tolka till tydliga förslag. Den deterministiska schemamotorn fortsätter att avgöra vad som är lagligt och möjligt.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 min-w-full lg:min-w-[360px]">
                <SummaryTile label="Aktiva" value={summary.active} tone="green" />
                <SummaryTile label="Nya" value={summary.draft} tone="amber" />
                <SummaryTile label="Totalt" value={summary.total} tone="gray" />
              </div>
            </header>

            <section className="bg-white border border-ink/8 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <GitBranch size={16} className="text-terracotta" />
                    Vad händer om?
                  </h2>
                  <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                    Testa en enskild önskan och se kedjereaktionen innan schemat ändras. AI visar vad som flyttas, vilka regler som stoppar och vilka följdeffekter som uppstår.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs font-bold text-green-800">
                  <ShieldCheck size={14} />
                  Reglerna avgör
                </div>
              </div>

              <div className="grid lg:grid-cols-[360px_1fr] gap-5">
                <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  <Field label="Grupp">
                    <select value={scenarioGroup} onChange={(e) => { setScenarioGroup(e.target.value); setScenarioEmployee(""); setScenarioResult(null); }} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                      {availableGroups.length === 0 && <option value="">Ingen grupp hittad</option>}
                      {availableGroups.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="År">
                      <input type="number" value={scenarioYear} onChange={(e) => { setScenarioYear(Number(e.target.value)); setScenarioResult(null); }} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                    </Field>
                    <Field label="Månad">
                      <input type="number" min={1} max={12} value={scenarioMonth} onChange={(e) => { setScenarioMonth(Number(e.target.value)); setScenarioResult(null); }} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                    </Field>
                  </div>
                  <Field label="Medarbetare">
                    <select value={scenarioEmployee} onChange={(e) => { setScenarioEmployee(e.target.value); setScenarioResult(null); }} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                      {scenarioEmployees.length === 0 && <option value="">Ingen personal hittad</option>}
                      {scenarioEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Datum">
                    <input type="date" value={scenarioDate} onChange={(e) => { setScenarioDate(e.target.value); setScenarioResult(null); }} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                  </Field>
                  <Field label="Önskan">
                    <select value={scenarioShift} onChange={(e) => { setScenarioShift(e.target.value); setScenarioResult(null); }} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/30">
                      <option value="DAG">Jobba dag</option>
                      <option value="KVAL">Jobba kväll</option>
                      <option value="LEDIG">Vara ledig</option>
                    </select>
                  </Field>
                </div>

                <div className="grid md:grid-cols-[180px_1fr] gap-4">
                  <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 space-y-3">
                    <div className="text-[11px] font-bold uppercase text-purple-700">Resultat</div>
                    <div>
                      <div className="text-3xl font-bold text-purple-900">{scenario.score}%</div>
                      <div className="text-xs font-semibold text-purple-800">{scenario.verdict}</div>
                    </div>
                    <button onClick={runScenario} disabled={scenarioLoading || !scenarioEmployee} className="w-full rounded-xl bg-white border border-purple-200 px-3 py-2 text-xs font-bold text-purple-800 flex items-center justify-center gap-2 disabled:opacity-50">
                      <RefreshCw size={13} className={scenarioLoading ? "animate-spin" : ""} />
                      {scenarioLoading ? "Simulerar" : scenarioResult ? "Simulerat" : "Simulera"}
                    </button>
                    {scenarioError && (
                      <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-lg p-2 leading-relaxed">
                        {scenarioError}
                      </p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <ScenarioList title="Direkt effekt" items={scenario.direct} />
                    <ScenarioList title="Kedjereaktion" items={scenario.chain} />
                    <ScenarioList title="Risker" items={scenario.risks} warning />
                    <ScenarioList title="Beslutslogg" items={scenario.decisionLog} />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-ink/8 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Sparkles size={16} className="text-terracotta" />
                    Rättviserapport 06:45
                  </h2>
                  <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                    Visar möjliga 06:45-byte för jämnare fördelning. Rapporten provar byten i minnet och sparar inget schema.
                  </p>
                </div>
                <button onClick={loadFairnessReport} disabled={fairnessLoading} className="rounded-xl bg-white border border-ink/10 text-ink px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  <RefreshCw size={13} className={fairnessLoading ? "animate-spin" : ""} />
                  Hämta rapport
                </button>
              </div>

              {fairnessError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{fairnessError}</p>
              )}

              {fairnessReport && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <SummaryTile label="Förslag" value={fairnessReport.proposals.length} tone="gray" />
                    <SummaryTile label="Kan appliceras" value={fairnessReport.can_apply} tone="green" />
                    <SummaryTile label="Stoppade" value={fairnessReport.stopped} tone="amber" />
                  </div>

                  <div className="rounded-xl bg-ink/5 border border-ink/8 p-3 space-y-1">
                    {fairnessReport.summary.map((line) => (
                      <p key={line} className="text-xs text-ink-soft">{line}</p>
                    ))}
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-ink/8 rounded-xl divide-y divide-ink/5">
                    {fairnessReport.proposals.length === 0 ? (
                      <p className="p-4 text-xs text-green-700 bg-green-50">Rapporten hittade inga 06:45-byte som behövs just nu.</p>
                    ) : (
                      fairnessReport.proposals.map((proposal) => (
                        <div key={`${proposal.group}-${proposal.date}-${proposal.from_employee_id}-${proposal.to_employee_id}`} className="p-3 grid lg:grid-cols-[1fr_120px_1.3fr_1.3fr] gap-2 text-xs">
                          <div>
                            <p className="font-bold text-ink">{proposal.date} · {proposal.group}</p>
                            <p className="text-ink-soft">{proposal.from_employee_name} → {proposal.to_employee_name}</p>
                          </div>
                          <StatusPill status={proposal.status === "kan appliceras" ? "ok" : "brist"} />
                          <div>
                            <p className="font-bold text-ink">{proposal.action}</p>
                            <p className="text-ink-soft">{proposal.reason}</p>
                          </div>
                          <div>
                            <p className={proposal.status === "kan appliceras" ? "font-bold text-green-700" : "font-bold text-red-700"}>{proposal.proof}</p>
                            <p className="text-ink-soft">{proposal.effect}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white border border-ink/8 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Check size={16} className="text-terracotta" />
                    Önskemålsrapport
                  </h2>
                  <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                    Visar vilka önskemål som inte kunde genomföras efter generering. Kan köras för en grupp eller över alla grupper.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={reportGroup} onChange={(e) => setReportGroup(e.target.value)} className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-bold bg-white">
                    <option value="ALLA">Alla grupper</option>
                    {availableGroups.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                  <input type="number" value={reportYear} onChange={(e) => setReportYear(Number(e.target.value))} className="w-24 rounded-xl border border-ink/10 px-3 py-2 text-xs font-bold" />
                  <input type="number" min={1} max={12} value={reportMonth} onChange={(e) => setReportMonth(Number(e.target.value))} className="w-20 rounded-xl border border-ink/10 px-3 py-2 text-xs font-bold" />
                  <button onClick={loadWishReport} disabled={wishReportLoading} className="rounded-xl bg-terracotta text-white px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                    <RefreshCw size={13} className={wishReportLoading ? "animate-spin" : ""} />
                    Hämta rapport
                  </button>
                </div>
              </div>

              {wishReportError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{wishReportError}</p>
              )}

              {wishReport && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <SummaryTile label="Uppfyllnad" value={Math.round(wishReport.fulfillment_rate)} tone="green" />
                    <SummaryTile label="Totalt" value={wishReport.total_wishes} tone="gray" />
                    <SummaryTile label="Uppfyllda" value={wishReport.fulfilled} tone="green" />
                    <SummaryTile label="Ej uppfyllda" value={wishReport.unfulfilled} tone="amber" />
                  </div>

                  <div className="rounded-xl bg-ink/5 border border-ink/8 p-3 space-y-1">
                    {wishReport.summary.map((line) => (
                      <p key={line} className="text-xs text-ink-soft">{line}</p>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-3">
                    <div className="rounded-xl border border-ink/8 bg-white overflow-hidden">
                      <div className="px-3 py-2 border-b border-ink/8 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase text-ink-soft">Uppfyllnad per grupp</h3>
                        <button onClick={exportWishReportCsv} disabled={wishReport.unfulfilled === 0} className="rounded-lg border border-ink/10 px-2.5 py-1 text-[11px] font-bold text-ink-soft flex items-center gap-1.5 disabled:opacity-40">
                          <Download size={12} />
                          CSV
                        </button>
                      </div>
                      <div className="divide-y divide-ink/5">
                        {(wishReport.group_breakdown ?? []).map((group) => (
                          <div key={group.group} className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-xs items-center">
                            <div>
                              <p className="font-bold text-ink">{group.group}</p>
                              <p className="text-ink-soft">{group.fulfilled}/{group.total_wishes} uppfyllda</p>
                            </div>
                            <span className="font-bold text-green-700">{Math.round(group.fulfillment_rate)}%</span>
                            <span className={group.unfulfilled > 0 ? "font-bold text-amber-700" : "font-bold text-green-700"}>
                              {group.unfulfilled} kvar
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-ink/8 bg-white p-3 space-y-2">
                      <h3 className="text-[11px] font-bold uppercase text-ink-soft">Vanligaste orsaker</h3>
                      {Object.entries(wishReport.blocker_counts ?? {}).length === 0 ? (
                        <p className="text-xs text-green-700">Inga blockerare i rapporten.</p>
                      ) : (
                        Object.entries(wishReport.blocker_counts ?? {}).map(([label, count]) => (
                          <div key={label} className="flex items-center justify-between text-xs">
                            <span className="text-ink-soft">{label}</span>
                            <span className="font-bold text-ink">{count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto border border-ink/8 rounded-xl divide-y divide-ink/5">
                    {wishReport.items.filter((item) => !item.fulfilled).length === 0 ? (
                      <p className="p-4 text-xs text-green-700 bg-green-50">Alla registrerade önskemål är uppfyllda.</p>
                    ) : (
                      wishReport.items.filter((item) => !item.fulfilled).map((item) => (
                        <div key={`${item.employee_id}-${item.date}-${item.desired}`} className="p-3 grid md:grid-cols-[1fr_120px_120px_1.5fr] gap-2 text-xs">
                          <div>
                            <p className="font-bold text-ink">{item.employee_name}</p>
                            <p className="text-ink-soft">{item.group} · {item.date}</p>
                          </div>
                          <p><span className="font-bold">Önskade:</span> {item.desired}</p>
                          <p><span className="font-bold">Fick:</span> {item.actual}</p>
                          <p className="text-amber-800">{item.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white border border-ink/8 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <AlertTriangle size={16} className="text-terracotta" />
                    Bemanningsrapport
                  </h2>
                  <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                    Tabell över krav, bemannat och differens. Den här vyn räknar inte själv i diagram, utan visar färdigräknade rader från backend.
                  </p>
                </div>
                <button onClick={loadStaffingReport} disabled={staffingReportLoading} className="rounded-xl bg-white border border-ink/10 text-ink px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  <RefreshCw size={13} className={staffingReportLoading ? "animate-spin" : ""} />
                  Hämta bemanning
                </button>
              </div>

              {staffingReportError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{staffingReportError}</p>
              )}

              {staffingReport && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-4 gap-3">
                    <SummaryTile label="Brist" value={staffingReport.shortage_slots} tone="amber" />
                    <SummaryTile label="Exakt" value={staffingReport.ok_slots} tone="green" />
                    <SummaryTile label="Överskott" value={staffingReport.surplus_slots} tone="gray" />
                    <SummaryTile label="Bemannat" value={staffingReport.total_staffed} tone="green" />
                  </div>

                  <div className="rounded-xl bg-ink/5 border border-ink/8 p-3 space-y-1">
                    {staffingReport.summary.map((line) => (
                      <p key={line} className="text-xs text-ink-soft">{line}</p>
                    ))}
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-ink/8 rounded-xl divide-y divide-ink/5">
                    {[...staffingReport.rows]
                      .sort((a, b) => {
                        const rank = (status: string) => status === "brist" ? 0 : status === "överskott" ? 1 : 2;
                        return rank(a.status) - rank(b.status) || a.date.localeCompare(b.date) || a.group.localeCompare(b.group);
                      })
                      .slice(0, 80)
                      .map((row) => (
                        <div key={`${row.group}-${row.date}-${row.slot}`} className="grid md:grid-cols-[1fr_90px_80px_80px_80px] gap-2 p-3 text-xs items-center">
                          <div>
                            <p className="font-bold text-ink">{row.group}</p>
                            <p className="text-ink-soft">{row.date} · {row.slot}</p>
                          </div>
                          <StatusPill status={row.status} />
                          <p><span className="font-bold">Krav:</span> {row.required}</p>
                          <p><span className="font-bold">Bem:</span> {row.staffed}</p>
                          <p className={row.diff < 0 ? "font-bold text-red-700" : row.diff > 0 ? "font-bold text-amber-700" : "font-bold text-green-700"}>
                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>

            <section className="grid lg:grid-cols-[380px_1fr] gap-6">
              <div className="bg-white border border-ink/8 rounded-2xl p-5 space-y-4 shadow-sm h-fit">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Plus size={16} className="text-terracotta" />
                    Ny livssituation
                  </h2>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Skriv situationen i vanligt språk. AI gör den till en aktiv hänsyn som schemaläggningen använder direkt.
                  </p>
                </div>

                <Field label="Medarbetare">
                  <input value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="Namn eller roll" className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                </Field>

                <Field label="Rubrik">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T.ex. kan inte jobba kvällar" className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                </Field>

                <Field label="Beskrivning">
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beskriv vad planeraren behöver ta hänsyn till..." className="min-h-[110px] w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Gäller från">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                  </Field>
                  <Field label="Gäller till">
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30" />
                  </Field>
                </div>

                <button onClick={addSituation} disabled={!employee.trim() || !title.trim() || !description.trim()} className="w-full bg-terracotta hover:bg-clay disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <Sparkles size={16} />
                  Lägg till i AI-lösningen
                </button>
              </div>

              <div className="space-y-4">
                <section className="bg-white/80 border border-ink/8 rounded-2xl p-5 grid md:grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Bot size={16} className="text-terracotta" />
                      AI-granskning inför attest
                    </h2>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      AI:n sammanfattar verksamhetsrisker, men regelmotorn måste fortfarande validera dygnsvila, veckovila, bemanning och timsaldo.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ReviewBadge icon={ShieldCheck} label="Juridik: motor" />
                    <ReviewBadge icon={AlertTriangle} label={`${summary.draft} nya hänsyn`} />
                    <ReviewBadge icon={HeartHandshake} label={`${summary.active} används av AI`} />
                  </div>
                </section>

                {situations.length === 0 && (
                  <div className="bg-white border border-ink/8 rounded-2xl p-6 text-sm text-ink-soft">
                    Inga livssituationer är registrerade ännu. Lägg in en verklig hänsyn till vänster när planeringen behöver ta hänsyn till något utanför de hårda reglerna.
                  </div>
                )}

                {situations.map((situation) => (
                  <article key={situation.id} className="bg-white border border-ink/8 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] font-bold border rounded-full px-2.5 py-1 ${STATUS_CLASSES[situation.status]}`}>
                            {STATUS_LABELS[situation.status]}
                          </span>
                          <span className="text-[11px] font-bold text-ink-soft bg-ink/5 rounded-full px-2.5 py-1">
                            {TYPE_LABELS[situation.suggestionType]}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-ink">{situation.title}</h3>
                        <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
                          <span className="flex items-center gap-1.5">
                            <UserRound size={13} />
                            {situation.employee}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <CalendarClock size={13} />
                            {situation.startDate} till {situation.endDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateStatus(situation.id, "active")} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-green-700">
                          <Check size={13} />
                          Aktivera
                        </button>
                        <button onClick={() => updateStatus(situation.id, "parked")} className="px-3 py-1.5 rounded-lg bg-white border border-ink/10 text-ink text-[11px] font-bold flex items-center gap-1 hover:bg-ink/5">
                          <Clock size={13} />
                          Parkera
                        </button>
                        <button onClick={() => updateStatus(situation.id, "closed")} className="px-3 py-1.5 rounded-lg bg-white border border-ink/10 text-ink-soft text-[11px] font-bold flex items-center gap-1 hover:bg-ink/5">
                          <FileText size={13} />
                          Avsluta
                        </button>
                        <button onClick={() => removeSituation(situation.id)} className="p-1.5 rounded-lg bg-white border border-red-100 text-red-600 hover:bg-red-50" title="Ta bort">
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-ink-soft leading-relaxed">{situation.description}</p>

                    <div className="bg-cream/20 border border-ink/5 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-ink flex items-center gap-2">
                        <Sparkles size={14} className="text-terracotta" />
                        AI-tolkning för schemaläggning
                      </h4>
                      <p className="text-xs text-ink-soft leading-relaxed">{situation.aiSummary}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <BulletList title="Föreslagen påverkan" items={situation.impacts} />
                        <BulletList title="Att kontrollera" items={situation.risks} warning />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold text-ink-soft uppercase">{label}</span>
      {children}
    </label>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "gray" }) {
  const classes = {
    green: "bg-green-50 text-green-800 border-green-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    gray: "bg-white text-ink border-ink/8",
  };

  return (
    <div className={`rounded-2xl border p-4 ${classes[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] font-bold uppercase">{label}</div>
    </div>
  );
}

function ReviewBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/8 bg-white px-3 py-1.5 text-[11px] font-bold text-ink-soft">
      <Icon size={13} />
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: "brist" | "ok" | "överskott" }) {
  const classes = {
    brist: "bg-red-50 text-red-700 border-red-200",
    ok: "bg-green-50 text-green-700 border-green-200",
    överskott: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <span className={`w-fit rounded-full border px-2 py-1 text-[11px] font-bold ${classes[status]}`}>
      {status}
    </span>
  );
}

function BulletList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return (
    <div className="space-y-2">
      <h5 className={`text-[11px] font-bold ${warning ? "text-amber-800" : "text-ink"}`}>{title}</h5>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-xs text-ink-soft leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${warning ? "bg-amber-500" : "bg-terracotta"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScenarioList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-ink/8 bg-white p-3 space-y-2">
      <h3 className={`text-[11px] font-bold uppercase ${warning ? "text-amber-800" : "text-ink"}`}>{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-xs text-ink-soft leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${warning ? "bg-amber-500" : "bg-terracotta"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
