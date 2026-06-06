"use client";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { saveShiftConfigs, fetchShiftConfigs, type ShiftConfig } from "@/lib/api";

const GROUPS = ["Norra", "Södra", "Östra", "Centrum 1", "Centrum 2", "Centrum 3", "Moholm", "Natten"];

const SHIFT_LABELS: Record<string, string> = {
  dag_tidig: "Dag tidig (06:45-regeln)",
  dag:       "Dag",
  kval_kort: "Kväll kort",
  kval_lang: "Kväll lång",
  natt:      "Natt",
};

interface Props {
  initialConfigs: ShiftConfig[];
}

export function ShiftConfigEditor({ initialConfigs }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<string>("Norra");
  const [configs, setConfigs] = useState<ShiftConfig[]>(initialConfigs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadGroup(group: string) {
    setSelectedGroup(group);
    const loaded = await fetchShiftConfigs(group).catch(() => []);
    setConfigs(loaded.map(c => ({ ...c, group_name: group })));
    setSaved(false);
  }

  function update(shift_type: string, field: "start_time" | "end_time", value: string) {
    setConfigs(prev => prev.map(c =>
      c.shift_type === shift_type ? { ...c, [field]: value } : c
    ));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveShiftConfigs(configs.map(c => ({ ...c, group_name: selectedGroup })));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    // Ta bort gruppsspecifika overrides → återgå till grundtider
    if (!selectedGroup) return;
    setSaving(true);
    try {
      // Ladda globala grundtider och visa dem (utan att spara som override)
      const global = await fetchShiftConfigs(undefined);
      setConfigs(global.map(c => ({ ...c, group_name: selectedGroup })));
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Gruppval */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Redigera tider för</p>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map(g => (
            <button
              key={g}
              onClick={() => loadGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedGroup === g ? "bg-terracotta text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Tider */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">
            {selectedGroup} — passtider
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Lämna tomt för att använda systemets grundtider. Fyll i för att anpassa tiderna för {selectedGroup}.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {Object.entries(SHIFT_LABELS).map(([shift_type, label]) => {
            const cfg = configs.find(c => c.shift_type === shift_type);
            return (
              <div key={shift_type} className="flex items-center gap-4 px-4 py-3">
                <div className="w-40">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 font-mono">{shift_type}</p>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={cfg?.start_time ?? ""}
                    onChange={e => update(shift_type, "start_time", e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40 w-28"
                  />
                  <span className="text-gray-300">–</span>
                  <input
                    type="time"
                    value={cfg?.end_time ?? ""}
                    onChange={e => update(shift_type, "end_time", e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terracotta/40 w-28"
                  />
                  {cfg && (
                    <span className="text-xs text-gray-400 font-mono ml-2">
                      {cfg.start_time} – {cfg.end_time}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Knappar */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {saved ? <Check size={15} /> : null}
          {saving ? "Sparar..." : saved ? "Sparat!" : "Spara tider"}
        </button>
        {selectedGroup && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RotateCcw size={14} />
            Återställ till grundtider
          </button>
        )}
      </div>
    </div>
  );
}
