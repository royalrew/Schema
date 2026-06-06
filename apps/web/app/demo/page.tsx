"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDemoSandbox } from "@/lib/api";
import { setToken, setUser, redirectAfterLogin } from "@/lib/auth";
import { Sparkles } from "lucide-react";

export default function DemoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function startDemo() {
      try {
        const data = await createDemoSandbox();
        setToken(data.access_token);
        setUser({
          user_id: 999, // Tillfälligt ID för demoanvändare
          username: data.username,
          full_name: "Demo Planerare",
          role: "schemaansvarig",
          employee_id: null,
        });
        
        // Vänta 1.5 sekunder för visuell bekräftelse, sedan omdirigera till dashboarden
        setTimeout(() => {
          router.push(redirectAfterLogin("schemaansvarig", null));
        }, 1500);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Det gick inte att starta demo-miljön.");
        setLoading(false);
      }
    }
    startDemo();
  }, [router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative overflow-hidden">
      {/* Mjuka bakgrundscirklar för rätt stämning */}
      <div className="absolute -top-20 -right-16 w-96 h-96 rounded-full bg-sage/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-96 h-96 rounded-full bg-terracotta/15 blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-terracotta rounded-2xl shadow-xl shadow-terracotta/20 animate-pulse">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="display text-3xl font-semibold text-ink">Sintari Sandlåda</h1>
        
        {loading ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft animate-pulse">
              Förbereder din personliga 7-dagars testmiljö...
            </p>
            <p className="text-xs text-ink-soft/60 leading-relaxed max-w-xs mx-auto">
              Sår personal för Granbackens Hemtjänst, kontraktstyper och bemanningskrav...
            </p>
            <div className="flex justify-center gap-1.5 pt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-terracotta animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4 max-w-sm mx-auto space-y-3 shadow-md">
            <p className="font-medium">Ett fel uppstod</p>
            <p className="text-xs text-red-600">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-xs"
            >
              Försök igen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
