"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { acceptInvite } from "@/lib/api";
import { setToken, setUser, redirectAfterLogin } from "@/lib/auth";

const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME ?? "Schemaläggningssystem";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Lösenorden matchar inte."); return; }
    if (password.length < 6) { setError("Lösenordet måste vara minst 6 tecken."); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await acceptInvite(token, password);
      setToken(data.access_token);
      setUser({
        user_id: data.user_id,
        username: "",
        full_name: data.full_name,
        role: data.role as "superadmin" | "schemaansvarig" | "personal",
        employee_id: data.employee_id,
      });
      router.push(redirectAfterLogin(data.role, data.employee_id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Länken är ogiltig eller redan använd.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-20 -right-16 w-96 h-96 rounded-full bg-sage/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-96 h-96 rounded-full bg-terracotta/15 blur-3xl pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-terracotta rounded-2xl shadow-lg shadow-terracotta/20 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="display text-3xl text-ink">Välkommen!</h1>
          <p className="text-sm text-ink-soft mt-1">Du har bjudits in till {ORG_NAME}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-sm border border-ink/8 rounded-3xl shadow-xl shadow-clay/10 p-8 space-y-5">
          <p className="text-sm text-gray-600">Välj ett lösenord för att aktivera ditt konto.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              placeholder="Minst 6 tecken"
              className="w-full bg-paper/60 border border-ink/12 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bekräfta lösenord</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="Upprepa lösenordet"
              className="w-full bg-paper/60 border border-ink/12 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terracotta hover:bg-clay disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-lg shadow-terracotta/20"
          >
            {loading ? "Aktiverar…" : "Aktivera konto och logga in"}
          </button>
        </form>
      </div>
    </div>
  );
}
