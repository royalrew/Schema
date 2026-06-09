"use client";
import { useState } from "react";
import { Sparkles, Check, X, Loader2, AlertTriangle, Info, Sunrise, Sunset, Users, Clock, ShieldCheck } from "lucide-react";
import type { ValidationResult, FixPlan, FixStep } from "@/lib/types";
import { fetchFixPlan, applyFixPlan } from "@/lib/api";

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

const OP_META: Record<string, { label: string; icon: typeof Sunrise; color: string }> = {
  dag_tidig: { label: "06:45-täckning", icon: Sunrise, color: "text-blue-600" },
  kval_lang: { label: "21:30-täckning", icon: Sunset, color: "text-purple-600" },
  bemanning: { label: "Bemanning", icon: Users, color: "text-emerald-600" },
  timbalans: { label: "Kontraktstimmar", icon: Clock, color: "text-amber-600" },
};

export function AIModal({ group, year, month, validation, onScheduleUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<FixPlan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const softWarnings = (validation?.errors ?? []).filter((e) => e.severity === "soft");

  async function openModal() {
    setOpen(true);
    setPlan(null);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const p = await fetchFixPlan(group, year, month);
      setPlan(p);
      setSelected(new Set(p.steps.map((s) => s.step_id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunde inte bygga åtgärdsplan");
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approve(steps: FixStep[]) {
    if (steps.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const res = await applyFixPlan(group, year, month, steps);
      setResult({
        ok: res.ok,
        message: `${res.applied_count} åtgärder tillämpade. ${res.warnings_after} varningar kvar, ${res.hard_errors_after} hårda fel.`,
      });
      onScheduleUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunde inte tillämpa planen");
    } finally {
      setApplying(false);
    }
  }

  if (softWarnings.length === 0 && !open) return null;

  const resolved = plan ? Math.max(0, plan.warnings_before - plan.warnings_after_if_all) : 0;
  const selectedSteps = plan ? plan.steps.filter((s) => selected.has(s.step_id)) : [];

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
      >
        <Sparkles size={14} /> Åtgärda alla varningar ({softWarnings.length})
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]">

            {/* Header */}
            <div className="bg-linear-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={18} />
                <div>
                  <p className="font-semibold text-sm">AI-åtgärdsplan</p>
                  <p className="text-xs text-purple-200">{group} · {month}/{year}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Laddar */}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Planerar åtgärder med look-ahead…
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
                  <X size={14} /> {error}
                </div>
              )}

              {/* Resultat efter tillämpning */}
              {result && (
                <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                  {result.ok ? <Check size={16} className="shrink-0 mt-0.5" /> : <X size={16} className="shrink-0 mt-0.5" />}
                  <span>{result.message}</span>
                </div>
              )}

              {plan && !result && (
                <>
                  {/* Sammanfattning */}
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} className="text-green-600 shrink-0" />
                      <p className="text-sm font-semibold text-gray-800">
                        Löser {resolved} av {plan.warnings_before} varningar i {plan.steps.length} steg
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 pl-7">
                      {plan.new_hard_errors === 0
                        ? "Inga nya regelbrott uppstår."
                        : `⚠ OBS: ${plan.new_hard_errors} nya hårda fel.`}
                      {plan.unresolved.length > 0 && ` ${plan.unresolved.length} varningar kvarstår och kräver vikarie.`}
                    </p>
                  </div>

                  {/* Holistisk förklaring */}
                  <div className="bg-purple-50 rounded-xl px-4 py-3 text-sm text-purple-800">
                    {plan.explanation}
                  </div>

                  {/* Steglista */}
                  {plan.steps.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                          Åtgärder ({selected.size}/{plan.steps.length} valda)
                        </p>
                        <div className="flex gap-2 text-[11px] font-semibold">
                          <button onClick={() => setSelected(new Set(plan.steps.map((s) => s.step_id)))} className="text-purple-600 hover:underline">Markera alla</button>
                          <span className="text-gray-300">·</span>
                          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline">Avmarkera alla</button>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                        {plan.steps.map((s) => {
                          const meta = OP_META[s.op ?? ""] ?? { label: "Åtgärd", icon: Info, color: "text-gray-500" };
                          const Icon = meta.icon;
                          const checked = selected.has(s.step_id);
                          return (
                            <label
                              key={s.step_id}
                              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-white border-gray-200" : "bg-gray-50/60 border-gray-100 opacity-60"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleStep(s.step_id)}
                                className="mt-0.5 accent-purple-600 cursor-pointer"
                              />
                              <Icon size={14} className={`shrink-0 mt-0.5 ${meta.color}`} />
                              <span className="text-xs text-gray-700 leading-snug">{s.description}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Olösta */}
                  {plan.unresolved.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Kvarstår — kräver vikarie / manuellt</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {plan.unresolved.map((u, i) => (
                          <div key={i} className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
                            <AlertTriangle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-800"><span className="font-mono mr-1">{formatDate(u.date)}</span>{u.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer-knappar */}
            {plan && !result && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
                <button
                  onClick={() => setOpen(false)}
                  disabled={applying}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-medium transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => approve(selectedSteps)}
                  disabled={applying || selectedSteps.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-50 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Godkänn valda ({selectedSteps.length})
                </button>
                <button
                  onClick={() => approve(plan.steps)}
                  disabled={applying || plan.steps.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Godkänn alla
                </button>
              </div>
            )}

            {result && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 bg-terracotta hover:bg-clay text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Stäng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
