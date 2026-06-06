"use client";

import React, { useState, useMemo } from "react";
import { Search, Info, HelpCircle, Calendar, Check, ListFilter, AlertCircle } from "lucide-react";

interface Props {
  decisions: string[];
}

type Category = "ALL" | "WISH" | "ROTATION" | "STAFFING" | "DEFICIT" | "WEEKEND" | "DELAD" | "MANUAL";

interface LogEntry {
  raw: string;
  dateStr: string;
  message: string;
  category: Category;
}

export function BeslutsloggPanel({ decisions = [] }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("ALL");
  const [visibleCount, setVisibleCount] = useState(15);

  // Parse raw string logs into structured entries
  const parsedEntries = useMemo((): LogEntry[] => {
    return decisions.map((item) => {
      let dateStr = "";
      let message = item;

      // 1. Match [YYYY-MM-DD HH:MM] formats first
      const timestampMatch = item.match(/^\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]\s+(.*)$/);
      if (timestampMatch) {
        dateStr = timestampMatch[1];
        message = `(${timestampMatch[2]}) ${timestampMatch[3]}`;
      } else {
        // Formats: "YYYY-MM-DD: Reason text..."
        const colonIndex = item.indexOf(":");
        if (colonIndex !== -1) {
          const part1 = item.substring(0, colonIndex).trim();
          // Simple regex to check if part1 looks like a date YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(part1)) {
            dateStr = part1;
            message = item.substring(colonIndex + 1).trim();
          }
        }
      }

      // Deduce category
      let category: Category = "STAFFING";
      const lowerMsg = message.toLowerCase();

      if (
        lowerMsg.includes("manuell korrigering") ||
        lowerMsg.includes("ändrad av") ||
        lowerMsg.includes("satt till") ||
        lowerMsg.includes("genererat av") ||
        lowerMsg.includes("korrigering av") ||
        lowerMsg.includes("autokorrigering") ||
        lowerMsg.includes("uppdaterad för") ||
        lowerMsg.includes("uppdaterade för")
      ) {
        category = "MANUAL";
      } else if (lowerMsg.includes("önskeschema") || lowerMsg.includes("personens eget val") || lowerMsg.includes("önskemål")) {
        category = "WISH";
      } else if (lowerMsg.includes("rotationsprincip") || lowerMsg.includes("06:45") || lowerMsg.includes("dag_tidig")) {
        category = "ROTATION";
      } else if (lowerMsg.includes("obokad") || lowerMsg.includes("timunderskottet") || lowerMsg.includes("deficit")) {
        category = "DEFICIT";
      } else if (lowerMsg.includes("helgpass") || lowerMsg.includes("helgkontrakt")) {
        category = "WEEKEND";
      } else if (lowerMsg.includes("delad tur") || lowerMsg.includes("delad_tur")) {
        category = "DELAD";
      } else if (lowerMsg.includes("nattpass") || lowerMsg.includes("bemanningskrav") || lowerMsg.includes("bemanningsbehov")) {
        category = "STAFFING";
      }

      return {
        raw: item,
        dateStr,
        message,
        category,
      };
    });
  }, [decisions]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return parsedEntries.filter((entry) => {
      const matchesCategory = selectedCategory === "ALL" || entry.category === selectedCategory;
      const matchesSearch =
        entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.dateStr.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [parsedEntries, selectedCategory, searchQuery]);

  // Get count stats
  const stats = useMemo(() => {
    const counts = {
      ALL: parsedEntries.length,
      WISH: 0,
      ROTATION: 0,
      STAFFING: 0,
      DEFICIT: 0,
      WEEKEND: 0,
      DELAD: 0,
      MANUAL: 0,
    };
    parsedEntries.forEach((entry) => {
      counts[entry.category] = (counts[entry.category] || 0) + 1;
    });
    return counts;
  }, [parsedEntries]);

  // Render appropriate badge for categories
  const renderBadge = (cat: Category) => {
    switch (cat) {
      case "MANUAL":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            Ändring
          </span>
        );
      case "WISH":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">
            Önskemål
          </span>
        );
      case "ROTATION":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            Rotationsprincip
          </span>
        );
      case "STAFFING":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            Bemanningskrav
          </span>
        );
      case "DEFICIT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
            Deficit-fyllnad
          </span>
        );
      case "WEEKEND":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
            Helgregler
          </span>
        );
      case "DELAD":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
            Delad tur
          </span>
        );
      default:
        return null;
    }
  };

  const handleShowMore = () => {
    setVisibleCount((prev) => prev + 15);
  };

  return (
    <div className="backdrop-blur-md bg-white/80 dark:bg-slate-900/60 border border-[#7E8F7A]/30 shadow-xl rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#7E8F7A]/20 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D95D39] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D95D39]"></span>
            </span>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-sans tracking-wide">
              Systemets Beslutslogg
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Revisionssäker spårbarhet och förklaringar bakom automatisk schematilldelning.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative max-w-xs w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Sök medarbetare eller datum..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm pl-10 pr-4 py-2 bg-slate-50/50 dark:bg-slate-950/30 border border-[#7E8F7A]/25 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D95D39] focus:border-[#D95D39] text-slate-800 dark:text-slate-100 transition-all placeholder-slate-400"
          />
        </div>
      </div>

      {/* Empty State / If no decisions */}
      {decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl bg-slate-50/30 dark:bg-slate-950/10 border border-dashed border-[#7E8F7A]/20">
          <Info size={36} className="text-slate-400 dark:text-slate-500 mb-3 animate-pulse" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ingen beslutslogg tillgänglig</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            Det finns ingen genererad logg för denna period ännu. Klicka på <strong className="text-[#D95D39]">"Kör autoschema"</strong> för att starta schemamotorn och generera loggar.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2 flex items-center gap-1">
              <ListFilter size={12} /> Filter:
            </span>
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "ALL"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm shadow-[#D95D39]/30"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Alla ({stats.ALL})
            </button>
            <button
              onClick={() => setSelectedCategory("MANUAL")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "MANUAL"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm shadow-[#D95D39]/30"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Ändringar ({stats.MANUAL || 0})
            </button>
            <button
              onClick={() => setSelectedCategory("WISH")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "WISH"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Önskemål ({stats.WISH})
            </button>
            <button
              onClick={() => setSelectedCategory("ROTATION")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "ROTATION"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Rotation ({stats.ROTATION})
            </button>
            <button
              onClick={() => setSelectedCategory("STAFFING")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "STAFFING"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Bemanningskrav ({stats.STAFFING})
            </button>
            <button
              onClick={() => setSelectedCategory("DEFICIT")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "DEFICIT"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Deltidssaldo ({stats.DEFICIT})
            </button>
            <button
              onClick={() => setSelectedCategory("WEEKEND")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "WEEKEND"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Helgregler ({stats.WEEKEND})
            </button>
            <button
              onClick={() => setSelectedCategory("DELAD")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium border ${
                selectedCategory === "DELAD"
                  ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
                  : "bg-white/50 hover:bg-white border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-800"
              }`}
            >
              Delad tur ({stats.DELAD})
            </button>
          </div>

          {/* Result view */}
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl bg-slate-50/10 border border-slate-200/20">
              <AlertCircle size={24} className="text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inga beslutsloggar matchade din sökning eller filter.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-[#7E8F7A]/25 space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {filteredEntries.slice(0, visibleCount).map((entry, index) => (
                <div
                  key={index}
                  className="relative group bg-white/20 dark:bg-slate-900/10 p-3 rounded-lg border border-slate-200/10 hover:border-[#7E8F7A]/30 hover:bg-white/40 dark:hover:bg-slate-800/20 transition-all duration-200"
                >
                  {/* Timeline bullet dot */}
                  <span className="absolute -left-[31px] top-4 flex items-center justify-center w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 bg-[#7E8F7A] group-hover:bg-[#D95D39] group-hover:scale-110 transition-all duration-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  </span>

                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {entry.dateStr && (
                        <span className="flex items-center gap-1 text-xs font-mono font-bold text-[#D95D39] bg-[#D95D39]/5 px-2 py-0.5 rounded">
                          <Calendar size={12} />
                          {entry.dateStr}
                        </span>
                      )}
                      {renderBadge(entry.category)}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Beslut #{parsedEntries.length - parsedEntries.indexOf(entry)}
                    </span>
                  </div>

                  <p className="text-xs md:text-sm text-slate-750 dark:text-slate-250 leading-relaxed font-medium">
                    {entry.message}
                  </p>
                </div>
              ))}

              {/* Show more button */}
              {filteredEntries.length > visibleCount && (
                <div className="pt-2 text-center">
                  <button
                    onClick={handleShowMore}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-[#D95D39] hover:bg-[#C24D2C] text-white rounded-lg transition-all duration-200 shadow-md shadow-[#D95D39]/20 cursor-pointer"
                  >
                    Visa fler loggar ({filteredEntries.length - visibleCount} kvar)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Secure Audit Info */}
          <div className="flex items-start gap-2.5 bg-slate-500/5 border border-slate-500/10 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 mt-4">
            <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">GDPR & Säkerhetsnotering: </span>
              Beslutsloggen sparas i krypterad, oföränderlig audit-lagring för att uppfylla kraven på transparens enligt GRC (Governance, Risk and Compliance). Den innehåller inga personliga hälsouppgifter eller sekretessbelagd information.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
