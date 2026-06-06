"use client";
import { CheckCircle2, Circle, Lock, ArrowRight } from "lucide-react";
import type { Phase } from "@/lib/types";

interface StepDef {
  id: Phase;
  number: number;
  title: string;
  description: string;
  action: string;       // vad användaren ska göra nu
  nextLabel: string;    // knapptext för att gå vidare
}

const STEPS: StepDef[] = [
  {
    id: "wish",
    number: 1,
    title: "Önskeschema",
    description: "Personal markerar vilka dagar de vill jobba. Klicka på en dag för att lägga till ett önskemål.",
    action: "Väntar på att personalen lägger in sina önskemål. Klicka på ett namn för att se och redigera deras önskemål.",
    nextLabel: "Alla önskemål är inne — generera schema",
  },
  {
    id: "correction",
    title: "Granska schema",
    number: 2,
    description: "Systemet har genererat ett förslag. Granska och justera vid behov.",
    action: "Kontrollera att bemanningen ser rimlig ut. Röda punkter markerar regelbrott — hovra för att se vad som är fel.",
    nextLabel: "Schemat är godkänt — attestera",
  },
  {
    id: "attested",
    number: 3,
    title: "Attesterat",
    description: "Schemat är godkänt och låst. Det kan nu exporteras som löneunderlag.",
    action: "Schemat är klart och låst. Exportera det som rapport om du vill.",
    nextLabel: "",
  },
];

const PHASE_ORDER: Phase[] = ["wish", "correction", "attested"];

interface Props {
  phase: Phase;
  onAdvance: (next: Phase) => void;
  loading?: boolean;
}

export function PhaseBar({ phase, onAdvance, loading }: Props) {
  const currentIdx = PHASE_ORDER.indexOf(phase);
  const nextPhase = currentIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[currentIdx + 1] : null;
  const currentStep = STEPS.find(s => s.id === phase)!;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Stegindikator */}
      <div className="flex border-b border-gray-100">
        {STEPS.map((step, idx) => {
          const isActive = step.id === phase;
          const isDone = idx < currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <div
              key={step.id}
              className={`flex-1 flex items-center gap-2 px-4 py-2.5 border-r last:border-r-0 border-gray-100 ${
                isActive ? "bg-terracotta/10" : isDone ? "bg-green-50/60" : "bg-white"
              }`}
            >
              {isDone ? (
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              ) : isActive ? (
                <div className="w-4 h-4 rounded-full bg-terracotta flex items-center justify-center shrink-0">
                  <span className="text-[9px] text-white font-bold">{step.number}</span>
                </div>
              ) : (
                <Circle size={16} className="text-gray-200 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-semibold leading-tight ${isActive ? "text-terracotta" : isDone ? "text-green-700" : "text-gray-300"}`}>
                  Steg {step.number}: {step.title}
                </p>
                <p className={`text-[10px] leading-tight hidden sm:block ${isActive ? "text-terracotta/70" : isDone ? "text-green-500" : "text-gray-300"}`}>
                  {step.description}
                </p>
              </div>
              {idx < STEPS.length - 1 && (
                <ArrowRight size={12} className={`ml-auto shrink-0 ${isActive ? "text-terracotta/40" : "text-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Aktiv instruktion + knapp */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm text-gray-700">{currentStep.action}</p>
        </div>

        {phase === "attested" ? (
          <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
            <Lock size={14} />
            Schemat är låst
          </div>
        ) : nextPhase ? (
          <button
            onClick={() => onAdvance(nextPhase)}
            disabled={loading}
            className="flex items-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {loading ? "Vänta…" : currentStep.nextLabel}
            {!loading && <ArrowRight size={14} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
