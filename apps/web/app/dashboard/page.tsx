"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ChevronLeft, ChevronRight, LogOut, Users, Settings, ClipboardList, AlertTriangle, CheckCircle2, Clock, Plus, Shield, BookOpen, Scale } from "lucide-react";
import { getUser, clearToken, isLoggedIn } from "@/lib/auth";
import { WelcomeGuide } from "@/components/WelcomeGuide";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groups, setGroups] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<GroupStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
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
      const token = localStorage.getItem("auth_token");
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
    <div className="min-h-screen bg-paper">
      {user && <WelcomeGuide userId={user.user_id} />}
      {/* ── Header ── */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-ink/8 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-terracotta rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-paper rounded-full" />
            </div>
            <span className="font-display text-xl">{ORG_NAME}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/medarbetare" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <Users size={14} /> Personal
            </Link>
            <Link href="/roller" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <Shield size={14} /> Roller
            </Link>
            {user?.role === "superadmin" && (
              <Link href="/systembeskrivning" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                <Scale size={14} /> Systembeskrivning
              </Link>
            )}
            <Link href="/rag" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <BookOpen size={14} /> RAG
            </Link>
            <Link href="/schemalagga" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <ClipboardList size={14} /> Bemanning
            </Link>
            <Link href="/installningar" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings size={14} /> Passtider
            </Link>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <span className="text-sm text-gray-600 font-medium">{mounted ? user?.full_name : ""}</span>
            <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-terracotta hover:bg-cream rounded-lg transition-colors cursor-pointer">
              <Shield size={14} /> Byt lösenord
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={14} /> Logga ut
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* ── Månadsnavigering + sammanfattning ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 shadow-sm">
              <ChevronLeft size={16} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 capitalize">{monthName}</h1>
            <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 shadow-sm">
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

        {/* ── Systembeskrivning Banner ── */}
        {user?.role === "superadmin" && (
          <div className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Scale size={16} className="text-terracotta" />
                Sintari Systemguide & Regelspecifikation
              </h2>
              <p className="text-xs text-ink-soft leading-relaxed max-w-xl">
                Sammanställning av allt vi har byggt, timräkning för heltid och deltid, samt de hårda lagreglerna (dygnsvila, veckovila) och de mjuka verksamhetsreglerna (önskemålskrockar, dagsansvarig, planerare). Visa denna sida för Sara under er genomgång.
              </p>
            </div>
            <Link 
              href="/systembeskrivning" 
              className="bg-terracotta hover:bg-clay text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              Öppna specifikationen →
            </Link>
          </div>
        )}

        {/* ── Gruppceller ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {statuses.map(g => {
              const phase = PHASE_CONFIG[g.phase as keyof typeof PHASE_CONFIG] ?? PHASE_CONFIG.wish;
              return (
                <Link
                  key={g.group}
                  href={`/schema/${encodeURIComponent(g.group)}`}
                  className="bg-white/60 rounded-2xl border border-ink/8 p-5 hover:shadow-lg hover:shadow-clay/5 hover:border-terracotta/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-ink group-hover:text-terracotta transition-colors">{g.group}</h3>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${phase.bg} ${phase.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${phase.dot}`} />
                      {phase.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Users size={11} className="text-gray-400" />
                      {g.employee_count} personal
                    </div>
                    {g.has_schedule ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={11} className="text-green-500" />
                        Schema genererat
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-gray-400" />
                        Inget schema ännu
                      </div>
                    )}
                  </div>

                  {/* Varningar/fel */}
                  {(g.hard_errors > 0 || g.coverage_warnings > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
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
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
