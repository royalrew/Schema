"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, LogOut, Users, Settings, ClipboardList, AlertTriangle, CheckCircle2, Clock, Plus, Shield, BookOpen, Scale, HeartHandshake, Sparkles, ListChecks } from "lucide-react";
import { getUser, clearToken, isLoggedIn, getToken } from "@/lib/auth";
import { WelcomeGuide } from "@/components/WelcomeGuide";
import { AdminLayout } from "@/components/AdminLayout";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";
const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME ?? "Schemamotor";

interface GroupStatus {
  group: string;
  phase: string;
  has_schedule: boolean;
  employee_count: number;
  hard_errors: number;
  coverage_warnings: number;
}

interface LifeSituationDashboardItem {
  status?: string;
}

const PHASE_CONFIG = {
  wish:       { label: "Önskeläge",  bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500" },
  correction: { label: "Granskning", bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500" },
  attested:   { label: "Attesterat", bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400" },
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groups, setGroups] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<GroupStatus[]>([]);
  const [lifeSituationStats, setLifeSituationStats] = useState({ total: 0, active: 0, draft: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    try {
      const raw = localStorage.getItem("sintari_life_situations");
      const items: LifeSituationDashboardItem[] = raw ? JSON.parse(raw) : [];
      setLifeSituationStats({
        total: items.length,
        active: items.filter((item) => item.status === "active").length,
        draft: items.filter((item) => item.status === "draft").length,
      });
    } catch {
      setLifeSituationStats({ total: 0, active: 0, draft: 0 });
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (!isLoggedIn()) { router.push("/login"); return; }
      if (user?.role === "personal") { router.push(`/personal/${user.employee_id}`); return; }
    }
  }, [mounted, user, router]);

  const load = useCallback(async () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${BASE}/api/groups`, { headers });
      if (!res.ok) {
        setGroups([]);
        setStatuses([]);
        return;
      }
      const data = await res.json();
      const grps: string[] = Array.isArray(data) ? data : [];
      setGroups(grps);

      const statList = await Promise.all(grps.map(async g => {
        try {
          const [period, debug] = await Promise.all([
            fetch(`${BASE}/api/period/${encodeURIComponent(g)}/${year}/${month}`, { headers }).then(r => r.json()),
            fetch(`${BASE}/api/debug/${encodeURIComponent(g)}/${year}/${month}`, { headers }).then(r => r.json()),
          ]);
          return {
            group: g,
            phase: period.phase ?? "wish",
            has_schedule: period.has_schedule ?? false,
            employee_count: debug.meta?.employee_count ?? 0,
            hard_errors: debug.validation?.hard_errors_count ?? 0,
            coverage_warnings: (debug.validation?.coverage_warnings ?? []).length,
          } as GroupStatus;
        } catch {
          return { group: g, phase: "wish", has_schedule: false, employee_count: 0, hard_errors: 0, coverage_warnings: 0 };
        }
      }));
      setStatuses(statList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (isLoggedIn()) {
      load();
    }
  }, [load]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: sv });
  const totalErrors = statuses.reduce((s, g) => s + g.hard_errors, 0);
  const totalWarnings = statuses.reduce((s, g) => s + g.coverage_warnings, 0);

  return (
    <AdminLayout>
      {user && <WelcomeGuide userId={user.user_id} />}

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* ── Månadsnavigering + sammanfattning ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 shadow-sm cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 capitalize">{monthName}</h1>
            <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 shadow-sm cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Sammanfattning */}
          <div className="flex items-center gap-3">
            {totalErrors > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                <AlertTriangle size={13} /> {totalErrors} regelbrott
              </span>
            )}
            {totalWarnings > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                <AlertTriangle size={13} /> {totalWarnings} täckningsvarningar
              </span>
            )}
            {!loading && totalErrors === 0 && totalWarnings === 0 && statuses.length > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={13} /> Allt ser bra ut
              </span>
            )}
          </div>
        </div>

        {/* ── Systemguide & genomgång (kompakt) ── */}
        {user?.role === "superadmin" && (
          <div className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Scale size={16} className="text-terracotta" />
              Systemguide & regelgenomgång
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Link
                href="/systembeskrivning"
                className="bg-white border border-ink/10 hover:bg-ink/5 text-ink px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen size={14} />
                Öppna systemguide
              </Link>
              <Link
                href="/installningar?tab=genomgang"
                className="bg-terracotta hover:bg-clay text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <ListChecks size={14} />
                Gå till Sara-genomgång
              </Link>
            </div>
          </div>
        )}

        {/* ── Livssituationer / AI-lager ── */}
        <div className="grid md:grid-cols-[1fr_280px] gap-4">
          <Link
            href="/livssituationer"
            className="bg-white/70 backdrop-blur-md border border-ink/8 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-terracotta/30 hover:shadow-md transition-all"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <HeartHandshake size={16} className="text-terracotta" />
                Livssituationer
              </h2>
              <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                Samla mänskliga hänsyn som rehab, familjelogistik, introduktion och tillfälliga begränsningar. AI gör dem begripliga, regelmotorn avgör vad som håller.
              </p>
            </div>
            <span className="shrink-0 bg-terracotta text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <Sparkles size={14} />
              Öppna AI-lagret
            </span>
          </Link>

          <div className="bg-white border border-ink/8 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">AI-granskning</span>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                Motor först
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-ink">{lifeSituationStats.total}</div>
                <div className="text-[10px] text-ink-soft">totalt</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-700">{lifeSituationStats.active}</div>
                <div className="text-[10px] text-ink-soft">aktiva</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-700">{lifeSituationStats.draft}</div>
                <div className="text-[10px] text-ink-soft">nya</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Gruppceller ── */}
        {loading ? (
          <div className="bg-white/65 border border-ink/8 rounded-3xl p-12 flex items-center justify-center min-h-[200px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-ink-soft">Laddar status…</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statuses.map(g => {
              const cfg = PHASE_CONFIG[g.phase as keyof typeof PHASE_CONFIG] || PHASE_CONFIG.wish;
              return (
                <Link
                  key={g.group}
                  href={`/schema/${encodeURIComponent(g.group)}?year=${year}&month=${month}`}
                  className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-3xl p-5 hover:shadow-lg hover:border-ink/15 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-display font-semibold text-lg text-ink group-hover:text-terracotta transition-colors">
                        {g.group}
                      </h3>
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {g.has_schedule ? (
                      <div className="flex items-center gap-2 text-xs text-ink-soft">
                        <Clock size={13} className="text-terracotta" />
                        <span>{g.employee_count} medarbetare schemalagda</span>
                      </div>
                    ) : (
                      <div className="text-xs text-ink-soft italic">
                        Inget aktivt schema genererat
                      </div>
                    )}
                  </div>

                  {/* Varningar/fel */}
                  {(g.hard_errors > 0 || g.coverage_warnings > 0) && (
                    <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                      {g.hard_errors > 0 && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {g.hard_errors} fel
                        </span>
                      )}
                      {g.coverage_warnings > 0 && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          ⚠ {g.coverage_warnings} varningar
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
