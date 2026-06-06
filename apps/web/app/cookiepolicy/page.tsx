"use client";
import Link from "next/link";

export default function CookiesPage() {
  return (
    <div className="bg-paper min-h-screen text-ink pb-20">
      {/* ── Bakgrundsdekoration ── */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-amber/10 blur-3xl pointer-events-none" />

      {/* ── Nav ── */}
      <nav className="max-w-4xl mx-auto px-6 pt-8 pb-12 flex justify-between items-center relative z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-terracotta rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-paper rounded-full" />
          </div>
          <span className="font-display text-xl">Sintari</span>
        </Link>
        <Link href="/" className="text-sm text-ink-soft hover:text-ink transition">
          ← Tillbaka
        </Link>
      </nav>

      {/* ── Main Content ── */}
      <main className="max-w-2xl mx-auto px-6 relative z-10 space-y-10">
        <header className="space-y-4">
          <p className="mono-label text-terracotta">Användarvillkor</p>
          <h1 className="display text-4xl leading-tight">
            Cookiepolicy
          </h1>
          <p className="text-sm text-ink-soft/70">
            Senast uppdaterad: 1 juni 2026
          </p>
        </header>

        <section className="space-y-6 text-sm text-ink-soft/90 leading-relaxed border-t border-black/5 pt-8">
          <p>
            Denna policy beskriver hur Sintari använder cookies och lokal lagring (LocalStorage) på vår plattform. Vi tror på full transparens och samlar enbart in den information som är absolut nödvändig för att verktyget ska fungera.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">Vad är cookies och LocalStorage?</h2>
            <p>
              Cookies och lokal lagring (LocalStorage) är små textfiler som sparas i din webbläsare när du besöker en webbplats. De används för att komma ihåg inställningar och hålla dig inloggad mellan sidladdningar så att du inte behöver logga in igen varje gång du klickar på en ny länk.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">Vilken lagring använder Sintari?</h2>
            <p>
              Plattformen använder **enbart funktionella (nödvändiga) nycklar** i din webbläsares LocalStorage. Vi har **inga spårningscookies**, reklamcookies eller tredjeparts-analyspixlar (såsom Google Analytics eller Facebook Pixels).
            </p>
            <p>
              Följande nycklar lagras lokalt i din webbläsare för att tjänsten ska fungera:
            </p>
            
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/10 text-ink-soft font-semibold">
                    <th className="py-2 pr-4">Nyckel (Key)</th>
                    <th className="py-2 px-4">Typ</th>
                    <th className="py-2 pl-4">Ändamål (Funktion)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-ink-soft/80">
                  <tr>
                    <td className="py-3 pr-4 font-mono font-bold text-ink">auth_token</td>
                    <td className="py-3 px-4">LocalStorage</td>
                    <td className="py-3 pl-4 leading-relaxed">Lagrar din krypterade JWT-säkerhetstoken. Krävs för att identifiera dig och hålla dig inloggad på plattformen. Raderas när du klickar på ”Logga ut”.</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-bold text-ink">auth_user</td>
                    <td className="py-3 px-4">LocalStorage</td>
                    <td className="py-3 pl-4 leading-relaxed">Sparar grundläggande detaljer om ditt inloggade konto (namn, roll och medarbetar-ID) så att gränssnittet laddas snabbare och visar rätt knappar.</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono font-bold text-ink">sintari_cookie_consent</td>
                    <td className="py-3 px-4">LocalStorage</td>
                    <td className="py-3 pl-4 leading-relaxed">Kommer ihåg om du har läst och godkänt denna information så att du inte ser Cookie-bannern längst ned på skärmen vid varje besök.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">Hur tar jag bort lagrad information?</h2>
            <p>
              Eftersom vår lokala lagring enbart används av funktionella skäl upphör de flesta nycklar att gälla eller rensas när du loggar ut från applikationen.
            </p>
            <p>
              Om du ändå vill ta bort LocalStorage helt kan du göra detta när som helst i dina webbläsarinställningar:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Öppna webbläsarens inställningar eller historikmeny.</li>
              <li>Sök efter ”Rensa webbplatsdata” eller ”Cookies och webbplatsdata”.</li>
              <li>Välj att rensa data för domänen eller lokalt på din enhet.</li>
            </ul>
            <p className="text-xs pt-1">
              <em>Notera: Om du rensar LocalStorage kommer du att loggas ut omedelbart och du kommer att se Cookie-bannern igen vid nästa besök.</em>
            </p>

            <div className="bg-white/60 border border-black/5 rounded-2xl p-5 space-y-3 mt-4">
              <h3 className="text-sm font-bold text-ink">Hantera dina val direkt</h3>
              <p className="text-xs text-ink-soft/80">
                Du behöver inte rensa webbläsardata manuellt. Du kan när som helst öppna inställningarna direkt här för att ändra eller återkalla dina val.
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-settings"))}
                className="bg-terracotta hover:bg-clay text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Öppna cookie-inställningar
              </button>
            </div>
          </div>
        </section>

        <footer className="pt-8 text-center">
          <Link
            href="/"
            className="inline-block bg-terracotta hover:bg-clay text-white font-semibold px-7 py-3 rounded-full text-xs transition shadow-lg shadow-terracotta/15 hover:scale-[1.02]"
          >
            Tillbaka till startsidan
          </Link>
        </footer>
      </main>
    </div>
  );
}
