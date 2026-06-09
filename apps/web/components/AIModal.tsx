"use client";
import { useState } from "react";
import { Sparkles, Check, X, Loader2, AlertTriangle, Info, Sunrise, Sunset, Users, Clock, ShieldCheck, ListChecks } from "lucide-react";
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

interface OpMeta {
  label: string;
  icon: typeof Sunrise;
  color: string;
  chip: string;
  dot: string;
}

const OP_META: Record<string, OpMeta> = {
  dag_tidig: { label: "06:45-täckning", icon: Sunrise, color: "text-blue-600", chip: "bg-blue-50 text-blue-700", dot: "bg-blue-400" },
  kval_lang: { label: "21:30-täckning", icon: Sunset, color: "text-purple-600", chip: "bg-purple-50 text-purple-700", dot: "bg-purple-400" },
  bemanning: { label: "Bemanning", icon: Users, color: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  timbalans: { label: "Kontraktstimmar", icon: Clock, color: "text-amber-600", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
};
const OP_ORDER = ["dag_tidig", "kval_lang", "bemanning", "timbalans"];
const FALLBACK_META: OpMeta = { label: "Åtgärd", icon: Info, color: "text-gray-500", chip: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };

export function AIModal({ group, year, month, validation, onScheduleUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<FixPlan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; applied: number; warnings: number; hard: number } | null>(null);
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
      setResult({ ok: res.ok, applied: res.applied_count, warnings: res.warnings_after, hard: res.hard_errors_after });
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
  const grouped = plan
    ? OP_ORDER
        .map((op) => ({ op, meta: OP_META[op] ?? FALLBACK_META, steps: plan.steps.filter((s) => s.op === op) }))
        .filter((g) => g.steps.length > 0)
    : [];

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg shadow-sm shadow-purple-600/20 transition-all"
      >
        <Sparkles size={14} /> Åtgärda alla varningar ({softWarnings.length})
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-black/5">

            {/* Header */}
            <div className="relative bg-linear-to-r from-purple-600 to-blue-600 px-6 py-5 shrink-0 overflow-hidden">
              <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-[15px] leading-tight">AI-åtgärdsplan</p>
                    <p className="text-xs text-white/70">{group} · {month}/{year}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 overflow-y-auto space-y-5">
              {/* Laddar */}
              {loading && (
                <div className="flex flex-col items-center gap-3 text-center py-10">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                      <Loader2 size={22} className="animate-spin text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Planerar åtgärder…</p>
                    <p className="text-xs text-gray-400 mt-0.5">Simulerar varje steg och kontrollerar att inga nya regelbrott uppstår.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                  <AlertTriangle size={15} className="shrink-0" /> {error}
                </div>
              )}

              {/* Resultat efter tillämpning */}
              {result && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                    <Check size={28} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800">Planen är tillämpad</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {result.applied} åtgärder genomförda. {result.warnings} varningar kvar
                      {result.hard > 0 ? `, ${result.hard} hårda fel` : " · inga hårda fel"}.
                    </p>
                  </div>
                </div>
              )}

              {plan && !result && (
                <>
                  {/* Hero-statistik */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-2xl bg-green-50 border border-green-100 px-3 py-3 text-center">
                      <div className="text-[26px] font-extrabold text-green-700 leading-none tabular-nums">{resolved}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-green-600/80 mt-1.5">Löser</div>
                    </div>
                    <div className="rounded-2xl bg-purple-50 border border-purple-100 px-3 py-3 text-center">
                      <div className="text-[26px] font-extrabold text-purple-700 leading-none tabular-nums">{plan.steps.length}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-purple-600/80 mt-1.5">Steg</div>
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 text-center ${plan.unresolved.length > 0 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-150"}`}>
                      <div className={`text-[26px] font-extrabold leading-none tabular-nums ${plan.unresolved.length > 0 ? "text-amber-700" : "text-gray-400"}`}>{plan.unresolved.length}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-wide mt-1.5 ${plan.unresolved.length > 0 ? "text-amber-600/80" : "text-gray-400"}`}>Kvarstår</div>
                    </div>
                  </div>

                  {/* Trygghetsbadge */}
                  {plan.new_hard_errors === 0 ? (
                    <div className="flex items-center gap-2.5 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                      <ShieldCheck size={18} className="text-green-600 shrink-0" />
                      <p className="text-xs font-medium text-green-800">Inga nya regelbrott — dygnsvila, veckovila och kontrakt hålls.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                      <AlertTriangle size={18} className="text-red-600 shrink-0" />
                      <p className="text-xs font-medium text-red-800">OBS: {plan.new_hard_errors} nya hårda fel — granska innan du godkänner.</p>
                    </div>
                  )}

                  {/* Holistisk förklaring */}
                  <div className="rounded-xl bg-linear-to-br from-purple-50 to-blue-50 border border-purple-100/60 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={12} className="text-purple-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-purple-500">AI förklarar</span>
                    </div>
                    <p className="text-sm text-purple-900/90 leading-relaxed">{plan.explanation}</p>
                  </div>

                  {/* Steglista, grupperad per kategori */}
                  {plan.steps.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                          <ListChecks size={13} /> Åtgärder · {selected.size}/{plan.steps.length} valda
                        </div>
                        <div className="flex gap-2 text-[11px] font-semibold">
                          <button onClick={() => setSelected(new Set(plan.steps.map((s) => s.step_id)))} className="text-purple-600 hover:underline">Markera alla</button>
                          <span className="text-gray-300">·</span>
                          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:underline">Avmarkera</button>
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-3 pr-1 -mr-1">
                        {grouped.map(({ op, meta, steps }) => {
                          const Icon = meta.icon;
                          return (
                            <div key={op} className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Icon size={13} className={meta.color} />
                                <span className="text-xs font-semibold text-gray-600">{meta.label}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.chip}`}>{steps.length}</span>
                              </div>
                              {steps.map((s) => {
                                const checked = selected.has(s.step_id);
                                return (
                                  <label
                                    key={s.step_id}
                                    className={`group flex items-start gap-2.5 pl-2.5 pr-3 py-2 rounded-xl border-l-2 border border-l-current cursor-pointer transition-all ${
                                      checked
                                        ? `bg-white border-gray-200 ${meta.color} shadow-xs`
                                        : "bg-gray-50/60 border-gray-100 border-l-gray-200 opacity-55 hover:opacity-80"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleStep(s.step_id)}
                                      className="mt-0.5 accent-purple-600 cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-700 leading-snug">{s.description}</span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Olösta */}
                  {plan.unresolved.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wide">
                        <AlertTriangle size={13} /> Kvarstår — kräver vikarie / manuellt
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

            {/* Footer-knappar */}
            {plan && !result && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setOpen(false)}
                  disabled={applying}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Avbryt
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => approve(selectedSteps)}
                  disabled={applying || selectedSteps.length === 0}
                  className="flex items-center justify-center gap-2 border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Godkänn valda ({selectedSteps.length})
                </button>
                <button
                  onClick={() => approve(plan.steps)}
                  disabled={applying || plan.steps.length === 0}
                  className="flex items-center justify-center gap-2 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-purple-600/20 transition-all"
                >
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Godkänn alla
                </button>
              </div>
            )}

            {result && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
                <button
                  onClick={() => setOpen(false)}
                  className="px-6 py-2.5 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-purple-600/20 transition-all"
                >
                  Klar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
