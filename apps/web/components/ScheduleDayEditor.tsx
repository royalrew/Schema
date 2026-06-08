"use client";
import React, { useState, useEffect } from "react";
import { X, Calendar, Check, Trash2 } from "lucide-react";
import type { ScheduleDay } from "@/lib/types";

export interface UpdateScheduleDayData {
  employee_id: string;
  date: string;
  shift_type: string | null;
  absence_type: string | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface ShiftPreset {
  shift_type: string;
  start_time: string;
  end_time: string;
  label: string;
}

interface Props {
  employeeId: string;
  employeeName: string;
  dateStr: string;
  dateLabel: string;
  presets: ShiftPreset[];
  currentDay: ScheduleDay | null;
  onSave: (data: UpdateScheduleDayData) => Promise<void>;
  onClose: () => void;
}

const ABSENCE_TYPES = [
  { value: "sem", label: "Semester" },
  { value: "FL", label: "Föräldraledig" },
  { value: "TJL", label: "Tjänsteledig" },
  { value: "sjuk", label: "Sjukskrivning" },
  { value: "VAB", label: "VAB" },
  { value: "KOM", label: "Kompledig" },
  { value: "STU", label: "Studieledig" },
];

export function ScheduleDayEditor({ 
  employeeId, 
  employeeName, 
  dateStr, 
  dateLabel, 
  presets, 
  currentDay, 
  onSave, 
  onClose 
}: Props) {
  const [mode, setMode] = useState<"preset" | "custom" | "absence" | "ledig">("ledig");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [selectedAbsence, setSelectedAbsence] = useState<string>("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("16:00");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize values
  useEffect(() => {
    if (currentDay?.absence) {
      setMode("absence");
      setSelectedAbsence(currentDay.absence.absence_type);
      setNote(currentDay.shift?.note ?? "");
    } else if (currentDay?.shift) {
      const shift = currentDay.shift;
      setNote(shift.note ?? "");
      
      // Check if it matches a preset
      const match = presets.find(
        p => p.shift_type === shift.shift_type && 
        shift.segments.length === 1 &&
        shift.segments[0].start_time.includes(p.start_time) &&
        shift.segments[0].end_time.includes(p.end_time)
      );

      if (shift.shift_type === "delad_tur") {
        setMode("preset");
        setSelectedPreset("delad_tur");
      } else if (match) {
        setMode("preset");
        setSelectedPreset(shift.shift_type);
      } else {
        setMode("custom");
        setSelectedPreset(shift.shift_type);
        if (shift.segments.length > 0) {
          const startIso = shift.segments[0].start_time;
          const endIso = shift.segments[0].end_time;
          const fmt = (iso: string) => {
            const parts = iso.split("T");
            return parts[1] ? parts[1].slice(0, 5) : "07:00";
          };
          setStartTime(fmt(startIso));
          setEndTime(fmt(endIso));
        }
      }
    } else {
      setMode("ledig");
      setSelectedPreset(presets[0]?.shift_type ?? "");
    }
  }, [currentDay, presets]);

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      let shift_type: string | null = null;
      let absence_type: string | null = null;
      let start_t: string | null = null;
      let end_t: string | null = null;

      if (mode === "preset") {
        shift_type = selectedPreset;
      } else if (mode === "custom") {
        shift_type = selectedPreset || "dag"; // default to dag
        start_t = startTime;
        end_t = endTime;
      } else if (mode === "absence") {
        absence_type = selectedAbsence;
      }

      await onSave({
        employee_id: employeeId,
        date: dateStr,
        shift_type,
        absence_type,
        start_time: start_t,
        end_time: end_t,
        note: note || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kunde inte spara ändringen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setLoading(true);
    try {
      await onSave({
        employee_id: employeeId,
        date: dateStr,
        shift_type: null,
        absence_type: null,
        start_time: null,
        end_time: null,
        note: null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kunde inte ta bort passet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-150 transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-terracotta" />
            <div>
              <h2 className="text-sm font-bold text-gray-900 leading-tight">Korrigera schema</h2>
              <p className="text-[11px] text-gray-400 font-medium">{employeeName} · {dateLabel}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-gray-400 hover:text-gray-650 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Välj typ */}
          <div className="flex bg-gray-150 p-1 rounded-xl">
            <button
              onClick={() => { setMode("preset"); if (!selectedPreset && presets[0]) setSelectedPreset(presets[0].shift_type); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "preset" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-905"}`}
            >
              Standardpass
            </button>
            <button
              onClick={() => { setMode("custom"); if (!selectedPreset && presets[0]) setSelectedPreset(presets[0].shift_type); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-905"}`}
            >
              Annan tid
            </button>
            <button
              onClick={() => { setMode("absence"); if (!selectedAbsence) setSelectedAbsence("sem"); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "absence" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-905"}`}
            >
              Frånvaro
            </button>
          </div>

          {/* Standardpass options */}
          {mode === "preset" && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Välj arbetspass</label>
              <div className="grid grid-cols-2 gap-1.5">
                {presets.map(p => (
                  <button
                    key={p.shift_type}
                    onClick={() => setSelectedPreset(p.shift_type)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer border ${
                      selectedPreset === p.shift_type
                        ? "bg-terracotta border-terracotta text-white shadow-md shadow-terracotta/10"
                        : "bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className={`text-[10px] font-mono ${selectedPreset === p.shift_type ? "text-blue-200" : "text-gray-400"}`}>
                      {p.start_time}–{p.end_time}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom time options */}
          {mode === "custom" && (
            <div className="space-y-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Passtyp (aktivitet)</label>
                <select
                  value={selectedPreset}
                  onChange={e => setSelectedPreset(e.target.value)}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                >
                  {presets.filter(p => p.shift_type !== "delad_tur").map(p => (
                    <option key={p.shift_type} value={p.shift_type}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tidsintervall</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="flex-1 border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                  <span className="text-gray-300">—</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="flex-1 border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Absence options */}
          {mode === "absence" && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Välj frånvarotyp</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ABSENCE_TYPES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setSelectedAbsence(a.value)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                      selectedAbsence === a.value
                        ? "bg-amber border-amber text-white shadow-md shadow-amber/10"
                        : "bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notering */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Kommentar / Notering</label>
            <input
              type="text"
              placeholder="Frivillig orsak eller notering"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg font-medium">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border border-gray-200 text-gray-650 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || (mode === "preset" && !selectedPreset) || (mode === "absence" && !selectedAbsence)}
                className="flex-1 flex items-center justify-center bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                {loading ? "Sparar…" : "Spara ändring"}
              </button>
            </div>

            {currentDay && (currentDay.shift || currentDay.absence) && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-semibold py-2 transition-colors cursor-pointer"
              >
                <Trash2 size={12} /> Gör ledig (Ta bort pass/frånvaro)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
