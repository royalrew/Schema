"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";
import { setToken, setUser, redirectAfterLogin } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(username.trim(), password);
      setToken(data.access_token);
      setUser({
        user_id: data.user_id,
        username,
        full_name: data.full_name,
        role: data.role as "superadmin" | "schemaansvarig" | "personal",
        employee_id: data.employee_id,
      });
      router.push(redirectAfterLogin(data.role, data.employee_id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Inloggning misslyckades");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col relative overflow-hidden">
      {/* mjuka oliv-cirklar i bakgrunden */}
      <div className="absolute -top-20 -right-16 w-96 h-96 rounded-full bg-terracotta/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-96 h-96 rounded-full bg-sage/15 blur-3xl pointer-events-none" />

      {/* Logo / tillbaka */}
      <div className="relative z-10 p-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-7 h-7 bg-terracotta rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-paper rounded-full" />
          </div>
          <span className="font-display text-xl">Sintari</span>
        </Link>
      </div>

      {/* Formulär */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-24">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="mono-label text-terracotta mb-3">Kundlogin</p>
            <h1 className="display text-3xl">Välkommen tillbaka</h1>
          </div>

          <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-sm border border-ink/8 rounded-3xl p-8 space-y-5 shadow-xl shadow-clay/10">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Användarnamn</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
                className="w-full bg-paper/60 border border-ink/12 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition"
                placeholder="ditt.namn"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">Lösenord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full bg-paper/60 border border-ink/12 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition"
                placeholder="••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/8 border border-red-500/20 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-terracotta hover:bg-clay disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition shadow-lg shadow-terracotta/20"
            >
              {loading ? "Loggar in…" : "Logga in"}
            </button>
          </form>

          <p className="text-center text-xs text-ink-soft/60 mt-6">
            Har du inget konto? Kontakta din schemaansvarig.
          </p>
        </div>
      </div>
    </div>
  );
}
