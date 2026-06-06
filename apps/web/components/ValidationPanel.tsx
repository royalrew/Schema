"use client";
import { ValidationResult } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface Props {
  validation: ValidationResult;
}

export function ValidationPanel({ validation }: Props) {
  const hard = validation.errors.filter((e) => e.severity === "hard");
  const soft = validation.errors.filter((e) => e.severity === "soft");

  if (validation.is_valid && soft.length === 0) {
    return (
      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
        <CheckCircle2 size={16} />
        <span>Schemat är giltigt — inga regelbrott.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hard.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-red-700 font-semibold text-sm mb-2">
            <AlertTriangle size={15} />
            {hard.length} hårda regelbrott
          </div>
          <ul className="space-y-1">
            {hard.slice(0, 10).map((e, i) => (
              <li key={i} className="text-xs text-red-800">
                <span className="font-mono bg-red-100 px-1 rounded mr-1">{e.date}</span>
                {e.message}
              </li>
            ))}
            {hard.length > 10 && (
              <li className="text-xs text-red-600 italic">... och {hard.length - 10} till</li>
            )}
          </ul>
        </div>
      )}
      {soft.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-yellow-700 font-semibold text-sm mb-2">
            <Info size={15} />
            {soft.length} varningar
          </div>
          <ul className="space-y-1">
            {soft.slice(0, 5).map((e, i) => (
              <li key={i} className="text-xs text-yellow-800">
                <span className="font-mono bg-yellow-100 px-1 rounded mr-1">{e.date}</span>
                {e.message}
              </li>
            ))}
            {soft.length > 5 && (
              <li className="text-xs text-yellow-600 italic">... och {soft.length - 5} till</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
