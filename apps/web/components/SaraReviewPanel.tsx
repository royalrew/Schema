"use client";
import { useState, useEffect } from "react";
import {
  Check, ThumbsUp, PencilLine, ChevronLeft, ChevronRight,
  Copy, CheckCircle, MessageSquare, ListChecks, RotateCcw
} from "lucide-react";

/**
 * Genomgång med Sara
 *
 * En demo-vänlig genomgång där schemaansvarig går igenom verksamhetens regler
 * och parametrar tillsammans med Sara — en fråga i taget. Varje punkt kan markeras
 * Ej besvarad / Stämmer / Ändra. Vid "Ändra" skrivs Saras svar in, och längst ned
 * sammanställs allt som behöver ändras i systemet.
 *
 * Svaren sparas i localStorage (räcker för demo). Koppling till backend kan läggas
 * till senare utan att UI:t behöver ändras.
 */

type Status = "unanswered" | "ok" | "change";

interface ReviewQuestion {
  id: string;
  category: string;
  title: string;
  /** Kort beskrivning av hur systemet fungerar idag. */
  current: string;
}

const QUESTIONS: ReviewQuestion[] = [
  {
    id: "obokad-max",
    category: "Timmar",
    title: "OBOKAD-passets maxlängd",
    current: "Ett obokad-pass läggs som mest 8 h 30 min på en dag (07:00–15:30). Behövs fler timmar fördelas de på flera lediga dagar.",
  },
  {
    id: "obokad-kontraktstid",
    category: "Timmar",
    title: "OBOKAD räknas som kontraktstid",
    current: "OBOKAD- och kontorstid räknas som fullgjorda kontraktstimmar — personen är på jobbet och tillgänglig för egna eller andra grupper.",
  },
  {
    id: "timbalans",
    category: "Timmar",
    title: "Gräns för timavvikelse-varning",
    current: "Systemet varnar när en persons schema avviker mer än ±15 h från måltimmarna för perioden.",
  },
  {
    id: "heltidstimmar",
    category: "Kontrakt",
    title: "Heltidstimmar per anställningsform",
    current: "Varierande 37 h/v · Dagtid 40 h/v · Kväll 30 h/v · Helg (fre–mån) 26 h/v · Natt 34,33 h/v.",
  },
  {
    id: "veckovila",
    category: "Lagregler",
    title: "Tolkning av veckovila",
    current: "Minst 36 h sammanhängande veckovila. Mjuk varning vid 33–36 h, hårt fel under 33 h.",
  },
  {
    id: "dygnsvila",
    category: "Lagregler",
    title: "Dygnsvila",
    current: "Minst 11 h dygnsvila. Tidigast tillåtna start är 08:30 dagen efter ett kvällspass som slutar 21:30.",
  },
  {
    id: "ledigt-28",
    category: "Lagregler",
    title: "Lediga dagar per 28-dagarsperiod",
    current: "Minst 9 helt lediga dagar (utan pass eller OBOKAD) under varje rullande 28-dagarsperiod.",
  },
  {
    id: "veton",
    category: "Önskemål",
    title: "Antal veton per period",
    current: "Personalen kan lägga max 2 veton (garanterad ledighet) per månad. Generatorn schemalägger aldrig på vetodagar.",
  },
  {
    id: "helgrotation",
    category: "Rättvisa",
    title: "Helgrotation",
    current: "Ordinarie personal och kvällspersonal schemaläggs på max 2 helger per månad.",
  },
  {
    id: "helgkontrakt",
    category: "Kontrakt",
    title: "Helgkontrakt (fre–mån)",
    current: "Helgkontrakt jobbar varje helg enligt kontrakt, max 3 pass per helgblock (fre–mån).",
  },
  {
    id: "nattrapport",
    category: "Rättvisa",
    title: "Nattrapport kl 06:45",
    current: "Varje dag schemaläggs minst en person på tidigt dagpass (06:45) för att ta emot nattrapporten. Passet roteras rättvist.",
  },
  {
    id: "planeringstid",
    category: "Rättvisa",
    title: "Planeringstid vid överbemanning",
    current: "Vid överbemanning delas passet och en del blir planerings-/kontorstid. Personal med planeringsansvar prioriteras.",
  },
];

const STORAGE_KEY = "sara_review_v1";

interface Answer {
  status: Status;
  comment: string;
}

export function SaraReviewPanel() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Ladda sparade svar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setAnswers(JSON.parse(saved));
      } catch {
        /* ignorera trasig data */
      }
    }
    setLoaded(true);
  }, []);

  // Spara svar när de ändras (efter första laddningen)
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }, [answers, loaded]);

  const q = QUESTIONS[current];
  const a = answers[q.id] ?? { status: "unanswered" as Status, comment: "" };

  const answeredCount = QUESTIONS.filter(
    (x) => (answers[x.id]?.status ?? "unanswered") !== "unanswered"
  ).length;
  const percent = Math.round((answeredCount / QUESTIONS.length) * 100);
  const changes = QUESTIONS.filter((x) => answers[x.id]?.status === "change");

  function setStatus(status: Status) {
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { status, comment: status === "change" ? prev[q.id]?.comment ?? "" : "" },
    }));
  }

  function setComment(comment: string) {
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { status: "change", comment },
    }));
  }

  function go(delta: number) {
    setCurrent((c) => Math.min(QUESTIONS.length - 1, Math.max(0, c + delta)));
  }

  function reset() {
    if (window.confirm("Vill du rensa alla svar från genomgången?")) {
      setAnswers({});
      setCurrent(0);
    }
  }

  function buildChangeList(): string {
    let text = "=== ÄNDRINGAR ATT GÖRA I SYSTEMET (genomgång med Sara) ===\n";
    text += `Datum: ${new Date().toLocaleDateString("sv-SE")}\n\n`;
    if (changes.length === 0) {
      text += "Inga punkter markerade som 'Ändra'.\n";
    } else {
      changes.forEach((x, i) => {
        const c = answers[x.id]?.comment?.trim();
        text += `${i + 1}. ${x.title} (${x.category})\n`;
        text += `   Saras svar: ${c ? c : "(ingen kommentar angiven)"}\n\n`;
      });
    }
    return text;
  }

  function copyChangeList() {
    navigator.clipboard.writeText(buildChangeList());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusPill = (s: Status) =>
    s === "ok"
      ? { label: "Stämmer", cls: "bg-green-100 text-green-800 border-green-200" }
      : s === "change"
      ? { label: "Ändra", cls: "bg-amber-100 text-amber-800 border-amber-200" }
      : { label: "Ej besvarad", cls: "bg-gray-100 text-gray-500 border-gray-200" };

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Rubrik + progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ListChecks size={18} className="text-terracotta" />
              Genomgång med Sara
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-md">
              Gå igenom en fråga i taget. Markera om det stämmer eller behöver ändras — svaren sparas automatiskt.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gray-900">
              {answeredCount} av {QUESTIONS.length} besvarade
            </p>
            <p className="text-[11px] text-gray-400">{percent}%</p>
          </div>
        </div>
        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-terracotta h-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Snabbnavigering — punkter */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUESTIONS.map((x, i) => {
            const s = answers[x.id]?.status ?? "unanswered";
            const dot =
              s === "ok" ? "bg-green-500" : s === "change" ? "bg-amber-500" : "bg-gray-300";
            return (
              <button
                key={x.id}
                onClick={() => setCurrent(i)}
                title={x.title}
                className={`w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer relative ${
                  i === current
                    ? "ring-2 ring-terracotta ring-offset-1 text-gray-900 bg-white"
                    : "text-gray-500 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {i + 1}
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dot} border border-white`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Aktuell fråga */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 min-h-[260px] flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-terracotta bg-terracotta/10 px-2.5 py-1 rounded-full">
            {q.category}
          </span>
          <span className="text-[11px] text-gray-400 font-medium">
            Fråga {current + 1} / {QUESTIONS.length}
          </span>
        </div>

        <div className="space-y-3 flex-1">
          <h3 className="text-lg font-bold text-gray-900">{q.title}</h3>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Så fungerar det idag
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{q.current}</p>
          </div>

          {/* Status-väljare: Ej besvarad / Stämmer / Ändra */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => setStatus("unanswered")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                a.status === "unanswered"
                  ? "bg-gray-700 border-gray-700 text-white"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <RotateCcw size={13} /> Ej besvarad
            </button>
            <button
              onClick={() => setStatus("ok")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                a.status === "ok"
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-green-200 text-green-700 hover:bg-green-50"
              }`}
            >
              <ThumbsUp size={13} /> Stämmer
            </button>
            <button
              onClick={() => setStatus("change")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                a.status === "change"
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
              }`}
            >
              <PencilLine size={13} /> Ändra
            </button>
          </div>

          {/* Svarsfält vid Ändra */}
          {a.status === "change" && (
            <div className="space-y-1.5 pt-1 animate-[fadeIn_0.2s_ease-out]">
              <label className="block text-[11px] font-bold text-amber-900 flex items-center gap-1">
                <MessageSquare size={12} /> Vad ska ändras? Skriv Saras svar:
              </label>
              <textarea
                value={a.comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="T.ex. Hos oss räknas heltid som 38,25 h/v, inte 37 h."
                className="w-full text-sm p-3 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 bg-white min-h-[70px]"
              />
            </div>
          )}
        </div>

        {/* Navigering */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button
            onClick={() => go(-1)}
            disabled={current === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft size={15} /> Föregående
          </button>
          <button
            onClick={() => go(1)}
            disabled={current === QUESTIONS.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-terracotta text-white hover:bg-clay disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Nästa <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Sammanfattning: Det här behöver ändras */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-amber-50/40 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle size={16} className="text-amber-600" />
            Det här behöver ändras i systemet
            <span className="text-xs font-normal text-gray-500">({changes.length})</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copyChangeList}
              disabled={changes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-terracotta text-white hover:bg-clay disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Kopierat!" : "Kopiera ändringslista"}
            </button>
            {answeredCount > 0 && (
              <button
                onClick={reset}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Rensa
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {changes.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              Inga punkter markerade som ”Ändra” än. Markera en fråga som <span className="font-semibold text-amber-700">Ändra</span> så hamnar den här.
            </p>
          ) : (
            <ul className="space-y-3">
              {changes.map((x) => {
                const c = answers[x.id]?.comment?.trim();
                return (
                  <li key={x.id} className="flex gap-3 text-sm">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {x.title}{" "}
                        <span className="text-[10px] font-normal text-gray-400">· {x.category}</span>
                      </p>
                      <p className="text-gray-600">
                        {c ? c : <span className="italic text-gray-400">Ingen kommentar angiven än.</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
