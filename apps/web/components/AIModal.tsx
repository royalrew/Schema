"use client";
import { useState } from "react";
import { Sparkles, ArrowRight, Check, X, ChevronRight, Loader2 } from "lucide-react";

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

interface AISuggestion {
  id: string;
  reason: string;
  employee_a_id: string;
  employee_a_name: string;
  date_a: string;
  employee_b_id: string;
  employee_b_name: string;
  date_b: string;
  shift_a_label: string;
  shift_b_label: string;
}

interface Props {
  group: string;
  year: number;
  month: number;
  onScheduleUpdated: () => void;
}

type State = "idle" | "loading" | "results" | "empty" | "error";

export function AIModal({ group, year, month, onScheduleUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [summary, setSummary] = useState("");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  async function analyze() {
    setState("loading");
    setSuggestions([]);
    setCurrentIdx(0);
    setSkipped(new Set());
    setFeedback(null);

    try {
      const res = await authFetch(`${BASE}/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, year, month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "AI-anrop misslyckades");
      setSummary(data.summary ?? "");
      setSuggestions(data.suggestions ?? []);
      setState(data.suggestions?.length > 0 ? "results" : "empty");
    } catch (e: unknown) {
      setSummary(e instanceof Error ? e.message : "Okänt fel");
      setState("error");
    }
  }

  async function approveSwap(sug: AISuggestion) {
    setApplying(true);
    setFeedback(null);
    try {
      const res = await authFetch(`${BASE}/api/ai/swap/${encodeURIComponent(group)}/${year}/${month}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_a_id: sug.employee_a_id,
          date_a: sug.date_a,
          employee_b_id: sug.employee_b_id,
          date_b: sug.date_b,
        }),
      });
      const data = await res.json();
      setFeedback({ ok: data.ok, message: data.message });
      if (data.ok) {
        onScheduleUpdated();
        setTimeout(() => nextSuggestion(sug.id), 1200);
      }
    } finally {
      setApplying(false);
    }
  }

  function nextSuggestion(skipId?: string) {
    setFeedback(null);
    const newSkipped = new Set(skipped);
    if (skipId) newSkipped.add(skipId);
    setSkipped(newSkipped);
    const remaining = suggestions.filter(s => !newSkipped.has(s.id));
    const nextIdx = remaining.findIndex((_, i) => i > currentIdx - (skipId ? 1 : 0));
    setCurrentIdx(remaining.length > 0 ? 0 : -1);
  }

  const remaining = suggestions.filter(s => !skipped.has(s.id));
  const current = remaining[0] ?? null;

  function formatDate(d: string) {
    const date = new Date(d);
    const days = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
    return `${days[(date.getDay() + 6) % 7]} ${date.getDate()}/${date.getMonth() + 1}`;
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (state === "idle") analyze(); }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
      >
        <Sparkles size={14} /> Analysera med AI
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="bg-linear-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={18} />
                <div>
                  <p className="font-semibold text-sm">AI-analys</p>
                  <p className="text-xs text-purple-200">{group} · {month}/{year}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Innehåll */}
            <div className="p-6">

              {/* Laddar */}
              {state === "loading" && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={32} className="animate-spin text-purple-500" />
                  <p className="text-sm text-gray-500">Analyserar schemat mot personkorten…</p>
                </div>
              )}

              {/* Inga konkreta byten men AI kan ha observationer */}
              {state === "empty" && (
                <div className="space-y-3 py-2">
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
                    {summary}
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    AI:n hittade inga passbyten att föreslå, men observationerna ovan kan vara användbara.
                  </p>
                </div>
              )}

              {/* Fel */}
              {state === "error" && (
                <div className="text-center py-6">
                  <p className="text-red-600 font-medium">AI-anropet misslyckades</p>
                  <p className="text-sm text-gray-500 mt-1">{summary}</p>
                  <button onClick={analyze} className="mt-3 text-sm text-terracotta hover:underline">
                    Försök igen
                  </button>
                </div>
              )}

              {/* Förslag */}
              {state === "results" && (
                <div className="space-y-4">
                  {/* Sammanfattning */}
                  <div className="bg-purple-50 rounded-xl px-4 py-3 text-sm text-purple-800">
                    {summary}
                  </div>

                  {current ? (
                    <>
                      {/* Förslag-kort */}
                      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Förslag {suggestions.length - remaining.length + 1} av {suggestions.length}
                          </span>
                          <span className="text-xs text-gray-300">{remaining.length} kvar</span>
                        </div>

                        <p className="text-sm text-gray-700">{current.reason}</p>

                        {/* Byte-visualisering */}
                        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 text-sm">
                          <div className="flex-1 text-center">
                            <p className="font-semibold text-gray-800">{current.employee_a_name}</p>
                            <p className="text-xs text-gray-500">{formatDate(current.date_a)}</p>
                            <span className="inline-block bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                              {current.shift_a_label}
                            </span>
                          </div>
                          <ArrowRight size={16} className="text-gray-400 shrink-0" />
                          <div className="flex-1 text-center">
                            <p className="font-semibold text-gray-800">{current.employee_b_name}</p>
                            <p className="text-xs text-gray-500">{formatDate(current.date_b)}</p>
                            <span className="inline-block bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                              {current.shift_b_label}
                            </span>
                          </div>
                        </div>

                        {/* Feedback */}
                        {feedback && (
                          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {feedback.ok ? <Check size={14} /> : <X size={14} />}
                            {feedback.message}
                          </div>
                        )}
                      </div>

                      {/* Knappar */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveSwap(current)}
                          disabled={applying || feedback?.ok}
                          className="flex-1 flex items-center justify-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                        >
                          {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Godkänn byte
                        </button>
                        <button
                          onClick={() => nextSuggestion(current.id)}
                          disabled={applying}
                          className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors"
                        >
                          Hoppa över <ChevronRight size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm font-semibold text-gray-700">Alla förslag genomgångna</p>
                      <p className="text-xs text-gray-400 mt-1">Stäng fönstret eller analysera om</p>
                      <button onClick={analyze} className="mt-2 text-xs text-purple-600 hover:underline">
                        Analysera igen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
