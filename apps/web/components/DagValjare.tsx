"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";

export interface WishShiftEntry {
  date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string | null;
  note: string;
}

export interface ShiftPreset {
  shift_type: string;
  start_time: string;
  end_time: string;
  label: string;
}

interface Props {
  date: string;           // "YYYY-MM-DD"
  dateLabel: string;      // "Måndag 5 juni"
  presets: ShiftPreset[];
  current: WishShiftEntry | null;
  onSave: (entry: WishShiftEntry | null) => void;
  onClose: () => void;
  anchorRect?: DOMRect;   // om angiven renderas via portal med fixed position
}

export function DagValjare({ date, dateLabel, presets, current, onSave, onClose, anchorRect }: Props) {
  const [mode, setMode] = useState<"preset" | "custom" | "ledig">(
    current?.shift_type === null && current?.start_time !== null ? "custom"
    : current?.start_time === null ? "ledig"
    : "preset"
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(current?.shift_type ?? "");
  const [startTime, setStartTime] = useState(current?.start_time ?? "07:00");
  const [endTime, setEndTime] = useState(current?.end_time ?? "16:00");
  const [note, setNote] = useState(current?.note ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function handleSave() {
    if (mode === "ledig") {
      onSave({ date, start_time: null, end_time: null, shift_type: null, note });
      return;
    }
    if (mode === "preset") {
      const p = presets.find(p => p.shift_type === selectedPreset);
      if (!p) return;
      onSave({ date, start_time: p.start_time, end_time: p.end_time, shift_type: p.shift_type, note });
      return;
    }
    // custom
    onSave({ date, start_time: startTime, end_time: endTime, shift_type: null, note });
  }

  function handleRemove() {
    onSave(null);  // null = ta bort helt
  }

  // Beräkna fixed-position baserat på ankarcellens position
  const fixedStyle: React.CSSProperties = anchorRect
    ? (() => {
        const POPOVER_W = 288;
        const MARGIN = 4;
        // Placera under cellen, centrera horisontellt
        let left = anchorRect.left + anchorRect.width / 2 - POPOVER_W / 2;
        // Klipp vid fönsterkanten
        left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8));
        const top = anchorRect.bottom + MARGIN + window.scrollY;
        return { position: "fixed" as const, top, left, width: POPOVER_W, zIndex: 9999 };
      })()
    : {};

  const content = (
    <div
      ref={ref}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      style={anchorRect ? fixedStyle : { position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 4, width: 288, zIndex: 50 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-800">{dateLabel}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={15} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Förinställda tider */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Förinställda tider</p>
          <div className="space-y-1">
            {presets.map(p => (
              <button
                key={p.shift_type}
                onClick={() => { setMode("preset"); setSelectedPreset(p.shift_type); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
                  mode === "preset" && selectedPreset === p.shift_type
                    ? "bg-terracotta text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className={`text-xs font-mono ${mode === "preset" && selectedPreset === p.shift_type ? "text-blue-200" : "text-gray-400"}`}>
                  {p.start_time}–{p.end_time}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Kontorstid */}
        <button
          onClick={() => {
            setMode("custom");
            setStartTime("14:00");
            setEndTime("16:00");
          }}
          className="w-full px-3 py-2 rounded-xl text-sm font-medium text-left bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-between"
        >
          <span>Kontorstid</span>
          <span className="text-xs text-gray-400 font-mono">14:00–16:00</span>
        </button>

        {/* Annan tid */}
        <div>
          <button
            onClick={() => setMode("custom")}
            className={`w-full px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${
              mode === "custom" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Annan tid...
          </button>
          {mode === "custom" && (
            <div className="flex items-center gap-2 mt-2 px-1">
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
              <span className="text-gray-300">–</span>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
            </div>
          )}
        </div>

        {/* Notering */}
        <input
          type="text"
          placeholder="Notering (valfritt)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />

        {/* Knappar */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { setMode("ledig"); }}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === "ledig" ? "bg-gray-200 text-gray-700" : "border border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            Ledig
          </button>
          <button
            onClick={handleSave}
            disabled={mode === "preset" && !selectedPreset}
            className="flex-1 flex items-center justify-center gap-1.5 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Check size={14} /> Spara
          </button>
        </div>

        {current && (
          <button
            onClick={handleRemove}
            className="w-full text-xs text-red-400 hover:text-red-600 text-center pt-1"
          >
            Ta bort tur
          </button>
        )}
      </div>
    </div>
  );

  if (anchorRect) {
    return mounted ? createPortal(content, document.body) : null;
  }
  return content;
}
