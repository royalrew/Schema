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

/**
 * Renders the DagValjare component, which displays a dialog or popover
 * allowing staff members to select or customize working hours for a specific day.
 *
 * @param props - The component properties.
 * @param props.date - The selected date string in YYYY-MM-DD format.
 * @param props.dateLabel - The formatted day label (e.g. "Måndag 5 juni").
 * @param props.presets - Available shift presets for the group.
 * @param props.current - The current wish shift entry if one exists.
 * @param props.onSave - Callback triggered to save or clear the shift entry.
 * @param props.onClose - Callback triggered to close the selector.
 * @param props.anchorRect - Optional DOMRect of the clicked calendar cell to position the popover relative to it.
 * @returns The rendered DagValjare component.
 */
export function DagValjare({ date, dateLabel, presets, current, onSave, onClose, anchorRect }: Props) {
  const [mode, setMode] = useState<"preset" | "custom" | "ledig" | "delad_tur">(
    current?.shift_type === "delad_tur" ? "delad_tur"
    : current?.shift_type === null && current?.start_time !== null ? "custom"
    : current?.start_time === null ? "ledig"
    : "preset"
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(current?.shift_type ?? "");
  const [startTime, setStartTime] = useState(current?.start_time ?? "07:00");
  const [endTime, setEndTime] = useState(current?.end_time ?? "16:00");
  const [note, setNote] = useState(current?.note ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 640);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    if (isMobile) return;
    function handleScroll() {
      onClose();
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onClose, isMobile]);

  useEffect(() => {
    if (!anchorRect || isMobile) return;

    const POPOVER_W = 288;
    const POPOVER_H = mode === "custom" ? 430 : 370;
    const MARGIN = 4;

    // Horizontal positioning
    let left = anchorRect.left + anchorRect.width / 2 - POPOVER_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8));

    // Vertical positioning (default below)
    let top = anchorRect.bottom + MARGIN;
    if (top + POPOVER_H > window.innerHeight) {
      // Doesn't fit below, try placing it above the cell
      const topAbove = anchorRect.top - POPOVER_H - MARGIN;
      if (topAbove >= 8) {
        top = topAbove;
      } else {
        // Doesn't fit above either, center it in the viewport
        top = Math.max(8, (window.innerHeight - POPOVER_H) / 2);
      }
    }

    setPosition({ top, left });
  }, [anchorRect, isMobile, mode]);

  function handleSave() {
    if (mode === "ledig") {
      onSave({ date, start_time: null, end_time: null, shift_type: null, note });
      return;
    }
    if (mode === "delad_tur") {
      onSave({ date, start_time: "07:00", end_time: "20:00", shift_type: "delad_tur", note });
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

  const formContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-800">{dateLabel}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
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

        {/* Delad tur */}
        <button
          onClick={() => {
            setMode("delad_tur");
          }}
          className={`w-full px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors flex items-center justify-between border ${
            mode === "delad_tur"
              ? "bg-terracotta text-white border-terracotta/40 shadow-sm"
              : "bg-gray-50 text-gray-700 border-transparent hover:bg-gray-100"
          }`}
        >
          <div className="flex flex-col text-left">
            <span className="font-semibold">Delad tur</span>
            <span className={`text-[10px] ${mode === "delad_tur" ? "text-orange-100" : "text-gray-400"}`}>
              Fm: 07:00–13:00 + Em: 15:30–20:00
            </span>
          </div>
          <span className={`text-xs font-mono ${mode === "delad_tur" ? "text-orange-100" : "text-gray-400"}`}>
            07:00–20:00
          </span>
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
    </>
  );

  if (isMobile) {
    const mobileContent = (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9998]">
        <div
          ref={ref}
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-sm z-[9999] max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-155"
        >
          {formContent}
        </div>
      </div>
    );
    return mounted ? createPortal(mobileContent, document.body) : null;
  }

  // Desktop popover
  const fixedStyle: React.CSSProperties = anchorRect
    ? {
        position: "fixed" as const,
        top: position.top,
        left: position.left,
        width: 288,
        zIndex: 9999,
      }
    : {};

  const desktopContent = (
    <div
      ref={ref}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={anchorRect ? fixedStyle : { position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 4, width: 288, zIndex: 50 }}
    >
      {formContent}
    </div>
  );

  if (anchorRect) {
    return mounted ? createPortal(desktopContent, document.body) : null;
  }
  return desktopContent;
}

