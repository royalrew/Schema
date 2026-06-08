"use client";
import { useState } from "react";
import { Sparkles, Check, X, ChevronRight, Loader2, AlertTriangle, Info } from "lucide-react";
import type { ValidationError, ValidationResult } from "@/lib/types";
import { getToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";

function authFetch(url: string, init?: RequestInit) {
  const token = getToken();
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

interface SideEffect {
  date: string;
  message: string;
}

interface ExplainResult {
  explanation: string;
  fix_type: string;
  fix_possible: boolean;
  affected_employee_id: string | null;
  affected_employee_name: string | null;
  affected_date: string;
  side_effects: SideEffect[];
}

interface Props {
  group: string;
  year: number;
  month: number;
  validation: ValidationResult | null;
  onScheduleUpdated: () => void;
}

type WarningState = "loading" | "ready" | "applying" | "done";

function formatDate(iso: string) {
  const d = new Date(iso);
  const days = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
  return `${days[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function AIModal({ group, year, month, validation, onScheduleUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [warningState, setWarningState] = useState<WarningState>("loading");
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const softWarnings = (validation?.errors ?? []).filter(e => e.severity === "soft");
  const remaining = softWarnings.filter((_, i) => !skipped.has(i));
  const current = remaining[0] ?? null;
  const currentOriginalIdx = current ? softWarnings.indexOf(current) : -1;

  async function loadExplanation(warning: ValidationError) {
    setWarningState("loading");
    setExplainResult(null);
    setFeedback(null);
    try {
      const res = await authFetch(`${BASE}/api/ai/explain-warning`, {
        method: "POST",
        body: JSON.stringify({ group, year, month, warning }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Fel vid AI-analys");
      setExplainResult(data);
      setWarningState("ready");
    } catch {
      setWarningState("ready");
      setExplainResult(null);
    }
  }

  function openModal() {
    setOpen(true);
    setSkipped(new Set());
    setCurrentIdx(0);
    setFeedback(null);
    const first = softWarnings[0];
    if (first) loadExplanation(first);
  }

  function skipCurrent() {
    if (currentOriginalIdx < 0) return;
    const next = new Set(skipped);
    next.add(currentOriginalIdx);
    setSkipped(next);
    setFeedback(null);
    const nextWarning = softWarnings.find((_, i) => !next.has(i));
    if (nextWarning) loadExplanation(nextWarning);
  }

  async function approveFix() {
    if (!explainResult?.fix_possible || !explainResult.affected_employee_id) return;
    setWarningState("applying");
    setFeedback(null);
    try {
      const res = await authFetch(`${BASE}/api/ai/apply-fix`, {
        method: "POST",
        body: JSON.stringify({
          group,
          year,
          month,
          fix_type: explainResult.fix_type,
          affected_employee_id: explainResult.affected_employee_id,
          affected_date: explainResult.affected_date,
        }),
      });
      const data = await res.json();
      setFeedback({ ok: data.ok, message: data.message });
      if (data.ok) {
        onScheduleUpdated();
        setTimeout(() => skipCurrent(), 1200);
      } else {
        setWarningState("ready");
      }
    } catch {
      setFeedback({ ok: false, message: "Något gick fel vid tillämpning av fix." });
      setWarningState("ready");
    }
  }

  if (softWarnings.length === 0) return null;

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
      >
        <Sparkles size={14} /> Åtgärda varningar ({softWarnings.length})
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="bg-linear-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={18} />
                <div>
                  <p className="font-semibold text-sm">AI-varningshantering</p>
                  <p className="text-xs text-purple-200">{group} · {month}/{year} · {remaining.length} kvar av {softWarnings.length}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {current ? (
                <div className="space-y-4">
                  {/* Varningens ursprungstext */}
                  <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-mono text-yellow-700">{formatDate(current.date)}</p>
                      <p className="text-sm text-yellow-800 mt-0.5">{current.message}</p>
                    </div>
                  </div>

                  {/* AI-förklaring */}
                  {warningState === "loading" && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <Loader2 size={14} className="animate-spin" /> Analyserar med AI…
                    </div>
                  )}

                  {warningState !== "loading" && explainResult && (
                    <div className="space-y-3">
                      {/* Förklaring */}
                      <div className="bg-purple-50 rounded-xl px-4 py-3 text-sm text-purple-800">
                        {explainResult.explanation}
                      </div>

                      {/* Föreslagen åtgärd */}
                      {explainResult.fix_possible && explainResult.affected_employee_name && (
                        <div className="border border-gray-200 rounded-xl p-3 space-y-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Föreslagen åtgärd</p>
                          <p className="text-sm text-gray-700">
                            Tilldela <span className="font-semibold">{explainResult.affected_employee_name}</span> passet den {formatDate(explainResult.affected_date)}.
                          </p>
                        </div>
                      )}

                      {!explainResult.fix_possible && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                          <Info size={14} className="shrink-0" />
                          Ingen automatisk åtgärd möjlig — hantera manuellt i schemat.
                        </div>
                      )}

                      {/* Bieffekter */}
                      {explainResult.side_effects.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 space-y-1">
                          <p className="text-xs font-semibold text-orange-700">Bieffekter av åtgärden</p>
                          {explainResult.side_effects.map((se, i) => (
                            <p key={i} className="text-xs text-orange-800">
                              <span className="font-mono bg-orange-100 px-1 rounded mr-1">{formatDate(se.date)}</span>
                              {se.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback */}
                  {feedback && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {feedback.ok ? <Check size={14} /> : <X size={14} />}
                      {feedback.message}
                    </div>
                  )}

                  {/* Knappar */}
                  <div className="flex gap-2 pt-1">
                    {explainResult?.fix_possible ? (
                      <button
                        onClick={approveFix}
                        disabled={warningState === "applying" || warningState === "loading" || feedback?.ok === true}
                        className="flex-1 flex items-center justify-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      >
                        {warningState === "applying" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Godkänn åtgärd
                      </button>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <button
                      onClick={skipCurrent}
                      disabled={warningState === "applying"}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      Hoppa över <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Check size={32} className="mx-auto text-green-500 mb-2" />
                  <p className="text-sm font-semibold text-gray-700">Alla varningar genomgångna</p>
                  <p className="text-xs text-gray-400 mt-1">Stäng fönstret och kontrollera schemat.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
