"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Sunset,
  Users,
  X,
} from "lucide-react";
import type { ValidationResult, FixPlan } from "@/lib/types";
import { fetchFixPlan } from "@/lib/api";

interface Props {
  group: string;
  year: number;
  month: number;
  validation: ValidationResult | null;
  onScheduleUpdated: () => void;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
  return `${days[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1}`;
}

const OP_META = {
  dag_tidig: { label: "06:45-täckning", icon: Sunrise, chip: "bg-blue-50 text-blue-700" },
  kval_lang: { label: "21:30-täckning", icon: Sunset, chip: "bg-purple-50 text-purple-700" },
  bemanning: { label: "Bemanning", icon: Users, chip: "bg-emerald-50 text-emerald-700" },
  timbalans: { label: "Kontraktstimmar", icon: Clock, chip: "bg-amber-50 text-amber-700" },
};

const OP_ORDER = ["dag_tidig", "kval_lang", "bemanning", "timbalans"];

export function AIModal({ group, year, month, validation }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<FixPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const softWarnings = (validation?.errors ?? []).filter((e) => e.severity === "soft");
  const hardErrors = (validation?.errors ?? []).filter((e) => e.severity === "hard");

  async function openReport() {
    setOpen(true);
    setPlan(null);
    setError(null);
    setLoading(true);
    try {
      setPlan(await fetchFixPlan(group, year, month));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta AI-rapport");
    } finally {
      setLoading(false);
    }
  }

  if (softWarnings.length === 0 && hardErrors.length === 0 && !open) return null;

  const resolved = plan ? Math.max(0, plan.warnings_before - plan.warnings_after_if_all) : 0;
  const grouped = plan
    ? OP_ORDER
        .map((op) => ({
          op,
          meta: OP_META[op as keyof typeof OP_META] ?? { label: "Åtgärd", icon: Info, chip: "bg-gray-100 text-gray-700" },
          steps: plan.steps.filter((s) => s.op === op),
        }))
        .filter((g) => g.steps.length > 0)
    : [];

  return (
    <>
      <button
        onClick={openReport}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg transition-all"
      >
        <Sparkles size={14} />
        Visa AI-rapport
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-black/5">
            <div className="relative bg-linear-to-r from-purple-600 to-blue-600 px-6 py-5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-[15px] leading-tight">AI-rapport</p>
                    <p className="text-xs text-white/70">
                      {group} · {month}/{year}
                    </p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 overflow-y-auto space-y-5">
              {loading && (
                <div className="flex flex-col items-center gap-3 text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                    <Loader2 size={22} className="animate-spin text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Hämtar AI-rapport...</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sammanfattar åtgärder, stopp och kvarstående risker.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                  <AlertTriangle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              {plan && (
                <>
                  <div className="grid grid-cols-3 gap-2.5">
                    <StatTile label="Löst" value={resolved} tone="green" />
                    <StatTile label="AI-steg" value={plan.steps.length} tone="purple" />
                    <StatTile label="Kvarstår" value={plan.unresolved.length} tone={plan.unresolved.length > 0 ? "amber" : "gray"} />
                  </div>

                  {plan.new_hard_errors === 0 ? (
                    <div className="flex items-center gap-2.5 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                      <ShieldCheck size={18} className="text-green-600 shrink-0" />
                      <p className="text-xs font-medium text-green-800">AI har inte skapat några nya hårda regelbrott. Dygnsvila, veckovila och kontrakt håller.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                      <AlertTriangle size={18} className="text-red-600 shrink-0" />
                      <p className="text-xs font-medium text-red-800">{plan.new_hard_errors} hårda fel stoppar automatiken. Regelmotorn kräver annan lösning.</p>
                    </div>
                  )}

                  <div className="rounded-xl bg-linear-to-br from-purple-50 to-blue-50 border border-purple-100/60 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={12} className="text-purple-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-purple-500">AI förklarar</span>
                    </div>
                    <p className="text-sm text-purple-900/90 leading-relaxed">{plan.explanation}</p>
                  </div>

                  {grouped.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Det AI gjorde eller föreslog</p>
                      <div className="max-h-72 overflow-y-auto space-y-3 pr-1 -mr-1">
                        {grouped.map(({ op, meta, steps }) => {
                          const Icon = meta.icon;
                          return (
                            <div key={op} className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Icon size={13} className="text-purple-600" />
                                <span className="text-xs font-semibold text-gray-600">{meta.label}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.chip}`}>{steps.length}</span>
                              </div>
                              {steps.map((s) => (
                                <div key={s.step_id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                                  <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
                                  <span className="text-xs text-gray-700 leading-snug">{s.description}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {plan.unresolved.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wide">
                        <AlertTriangle size={13} />
                        Kvarstår
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {plan.unresolved.map((u, i) => (
                          <div key={i} className="flex items-start gap-2 bg-amber-50/70 border border-amber-100 rounded-lg px-3 py-2">
                            <span className="text-[11px] font-mono font-semibold text-amber-700 shrink-0 mt-px">{formatDate(u.date)}</span>
                            <p className="text-xs text-amber-900/80 leading-snug">{u.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="px-6 py-2.5 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-purple-600/20 transition-all"
              >
                Klar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "green" | "purple" | "amber" | "gray" }) {
  const classes = {
    green: "bg-green-50 border-green-100 text-green-700",
    purple: "bg-purple-50 border-purple-100 text-purple-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    gray: "bg-gray-50 border-gray-100 text-gray-500",
  };

  return (
    <div className={`rounded-2xl border px-3 py-3 text-center ${classes[tone]}`}>
      <div className="text-[26px] font-extrabold leading-none tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide mt-1.5">{label}</div>
    </div>
  );
}
