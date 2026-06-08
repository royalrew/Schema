"use client";
import React, { useState } from "react";
import { X, Key, Check } from "lucide-react";
import { changePassword } from "@/lib/api";

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("De nya lösenorden matchar inte.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken långt.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Det gick inte att byta lösenord.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-150 transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-terracotta" />
            <h2 className="text-base font-bold text-gray-900">Byt lösenord</h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-gray-400 hover:text-gray-650 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-150 flex items-center justify-center text-green-600 animate-bounce">
              <Check size={24} />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Lösenordet har uppdaterats!</h3>
            <p className="text-xs text-gray-500">Stänger rutan...</p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Nuvarande lösenord
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Skriv ditt nuvarande lösenord"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Nytt lösenord
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minst 6 tecken"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Bekräfta nytt lösenord
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Skriv nytt lösenord igen"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg font-medium">{error}</p>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center bg-terracotta hover:bg-clay disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {loading ? "Sparar…" : "Spara ändringar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
