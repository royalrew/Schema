"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Settings as SettingsIcon, Check, X, ToggleLeft, ToggleRight } from "lucide-react";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Toggles för cookie-kategorier (enbart nödvändiga är sanna och låsta)
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("sintari_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    function handleOpen() {
      setShow(true);
      setShowSettings(true);
    }
    window.addEventListener("open-cookie-settings", handleOpen);
    return () => window.removeEventListener("open-cookie-settings", handleOpen);
  }, []);

  function handleAcceptAll() {
    localStorage.setItem("sintari_cookie_consent", "accepted_all");
    setShow(false);
    setShowSettings(false);
  }

  function handleSaveSelection() {
    localStorage.setItem(
      "sintari_cookie_consent",
      JSON.stringify({ essential: true, analytics, marketing })
    );
    setShow(false);
    setShowSettings(false);
  }

  if (!show) return null;

  return (
    <>
      {/* ── 1. Huvudbanner (Flytande kort i botten) ── */}
      {!showSettings && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[420px] z-50 animate-[slideUp_0.5s_ease-out]">
          <div className="bg-white/80 backdrop-blur-xl border border-black/5 rounded-[1.75rem] p-6 shadow-2xl shadow-clay/15 relative overflow-hidden">
            {/* Dekorativa bakgrunds-effekter */}
            <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-amber/10 blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-24 h-24 rounded-full bg-terracotta/10 blur-xl pointer-events-none" />

            <div className="relative space-y-4">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-terracotta" />
                <span className="mono-label text-ink-soft/70">Information om cookies</span>
              </div>

              <h3 className="text-base font-bold text-ink">Vi värnar om din integritet</h3>
              
              <p className="text-xs text-ink-soft/80 leading-relaxed">
                Sintari använder enbart <strong>nödvändiga cookies</strong> för inloggnings-sessioner. Vi använder inga spårnings- eller annonspixlar.
              </p>

              <div className="flex gap-4 text-[10px] text-ink-soft/50">
                <Link href="/cookiepolicy" className="text-terracotta hover:underline hover:text-clay font-medium">
                  Cookiepolicy
                </Link>
                <span>·</span>
                <Link href="/integritetspolicy" className="text-terracotta hover:underline hover:text-clay font-medium">
                  Integritetspolicy
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-terracotta hover:bg-clay text-white py-2.5 rounded-full text-xs font-semibold shadow-md shadow-terracotta/15 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Acceptera alla
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 border border-ink/10 hover:bg-ink/5 text-ink py-2.5 rounded-full text-xs font-semibold transition flex items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <SettingsIcon size={12} />
                  <span>Inställningar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Inställningar-Modal (Frostat glas i mitten av skärmen) ── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/50 rounded-[2.25rem] p-8 max-w-md w-full shadow-2xl shadow-black/10 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Kryssknapp längst upp till höger */}
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-6 right-6 p-1 text-ink-soft/50 hover:text-ink hover:bg-black/5 rounded-full transition"
            >
              <X size={16} />
            </button>

            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-terracotta" />
                <h3 className="text-lg font-bold text-ink">Cookie-inställningar</h3>
              </div>

              <p className="text-xs text-ink-soft/85 leading-relaxed">
                Här kan du anpassa vilka cookies du tillåter Sintari att spara i din webbläsare. Nödvändiga cookies krävs för att plattformen överhuvudtaget ska fungera säkert.
              </p>

              {/* Toggles */}
              <div className="space-y-4 border-y border-black/5 py-5">
                
                {/* 1. Nödvändiga */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-ink">Nödvändiga cookies</h4>
                      <span className="text-[9px] bg-sage/10 text-sage px-1.5 py-0.5 rounded font-bold">Alltid aktiv</span>
                    </div>
                    <p className="text-[11px] text-ink-soft/70 leading-relaxed">
                      Krävs för att verifiera din inloggning och behörighet (JWT i LocalStorage). Kan inte stängas av.
                    </p>
                  </div>
                  <div className="text-sage pt-0.5">
                    <ToggleRight size={28} className="opacity-60 cursor-not-allowed" />
                  </div>
                </div>

                {/* 2. Analys */}
                <div className="flex items-start justify-between gap-4 pt-1">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">Statistik & Analys</h4>
                    <p className="text-[11px] text-ink-soft/70 leading-relaxed">
                      Används för att förstå hur plattformen används så att vi kan förbättra designen. Sintari använder för närvarande inga analysverktyg.
                    </p>
                  </div>
                  <button
                    onClick={() => setAnalytics(prev => !prev)}
                    className="text-ink-soft/40 hover:text-ink transition pt-0.5"
                  >
                    {analytics ? <ToggleRight size={28} className="text-terracotta" /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                {/* 3. Marknadsföring */}
                <div className="flex items-start justify-between gap-4 pt-1">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-ink">Marknadsföring</h4>
                    <p className="text-[11px] text-ink-soft/70 leading-relaxed">
                      Används för att visa riktad reklam. Sintari är helt fritt från reklam och spårningscookies.
                    </p>
                  </div>
                  <button
                    onClick={() => setMarketing(prev => !prev)}
                    className="text-ink-soft/40 hover:text-ink transition pt-0.5"
                  >
                    {marketing ? <ToggleRight size={28} className="text-terracotta" /> : <ToggleLeft size={28} />}
                  </button>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={handleSaveSelection}
                  className="flex-1 bg-ink text-paper py-3 rounded-full text-xs font-semibold hover:bg-ink-soft transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Spara mina val
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-terracotta text-white py-3 rounded-full text-xs font-semibold hover:bg-clay transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Acceptera alla
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
