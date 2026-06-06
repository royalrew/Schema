"use client";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="bg-paper min-h-screen text-ink pb-20">
      {/* ── Bakgrundsdekoration ── */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-sage/10 blur-3xl pointer-events-none" />

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
          <p className="mono-label text-terracotta">Rättslig information</p>
          <h1 className="display text-4xl leading-tight">
            Integritetspolicy
          </h1>
          <p className="text-sm text-ink-soft/70">
            Senast uppdaterad: 1 juni 2026
          </p>
        </header>

        <section className="space-y-6 text-sm text-ink-soft/90 leading-relaxed border-t border-black/5 pt-8">
          <p>
            Denna integritetspolicy beskriver hur Sintari (”vi”, ”vår” eller ”oss”) samlar in, använder, skyddar och delar personuppgifter i samband med användningen av vår schemaläggningstjänst. Tjänsten tillhandahålls som ett anpassat verktyg för **Töreboda hemvård** och tillhörande grupper.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">1. Personuppgiftsansvarig</h2>
            <p>
              Ansvarig för behandlingen av personuppgifter på denna plattform är:
            </p>
            <div className="bg-cream/30 border border-black/5 rounded-2xl p-4 text-xs space-y-1 text-ink-soft/80 font-medium">
              <p className="text-ink font-semibold">Sintari (Enskild firma)</p>
              <p>Innehavare & chefsarkitekt: Jimmy Berndtsson</p>
              <p>Adress: Töreboda, 545 91</p>
              <p>Kontakt och DPO: <a href="mailto:jimmy@sintari.se" className="text-terracotta hover:underline">jimmy@sintari.se</a></p>
              <p>Godkänd för FA-skatt</p>
            </div>
            <p className="text-xs text-ink-soft/60 italic pt-1">
              *Notera: För att värna om enskildas integritet och motverka identitetsstöld publiceras inte personuppgiftsansvarigs personnummer offentligt på hemsidan. Organisationsnummer lämnas ut på begäran vid affärsrelationer.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">2. Vilka uppgifter vi samlar in</h2>
            <p>
              För att plattformen ska kunna beräkna och verifiera optimala arbetsscheman behandlas följande kategorier av uppgifter om personalen:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Grundläggande identifiering:</strong> Fullständigt namn och internt medarbetar-ID.</li>
              <li><strong>Anställningsuppgifter:</strong> Tjänstgöringsgrad (t.ex. 50 % eller 75 %) och avtalstyp (t.ex. dagtid, natt, varierande).</li>
              <li><strong>Schemapreferenser & Önskemål:</strong> Önskade arbetspass, inlagda önskemål och personliga scheman.</li>
              <li><strong>Frånvaro & Ledighet:</strong> Registrerad semester, föräldraledighet, tjänstledighet och sjukfrånvaro (krävs för korrekt lagbunden bemanningsberäkning).</li>
              <li><strong>Inloggning & Säkerhet:</strong> Användarnamn, hashat lösenord och loggar över senaste inloggningar.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">3. Rättslig grund och ändamål</h2>
            <p>
              Behandlingen av personuppgifter görs med stöd av <strong>fullgörande av avtal</strong> samt <strong>rättslig förpliktelse</strong>. Syftet är att:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Generera lagliga arbetsscheman som uppfyller svensk arbetstidslagstiftning (dygnsvila, veckovila).</li>
              <li>Hantera inbjudningar och erbjuda personliga, säkra kalendervyer för medarbetare.</li>
              <li>Låta schemaansvariga beräkna och följa upp timsaldon och bemanningskrav.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">4. AI och Data-sanering (Zero Hallucination & Presidio-PII-tvätt)</h2>
            <p>
              När vi använder intelligenta AI-modeller för att analysera scheman eller ge rekommendationer värnar vi extremt hårt om din integritet:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Presidio PII-sanering:</strong> All data tvättas helt från personliga identifierare (namn, ID) *innan* den skickas till externa språkmotorer (t.ex. OpenAI). AI:n ser enbart anonyma mönster (t.ex. ”Anställd A”, ”Anställd B”).</li>
              <li><strong>Lokal generering:</strong> Den huvudsakliga schemamotorn som beräknar och validerar alla arbetspass körs helt lokalt på våra säkra servrar. Inga personuppgifter eller schemafiler skickas till externa molntjänster för schemaläggning.</li>
              <li><strong>Ingen träningsdata:</strong> Ingen data som behandlas av Sintari används för att träna kommersiella modeller.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">5. Säkerhet och behörighet (RBAC)</h2>
            <p>
              Vi skyddar din data genom avancerade arkitektoniska och tekniska skydd:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Behörighetsbegränsning (RBAC):</strong> Vanliga medarbetare (`personal`-roll) kan enbart se sin egen kalender och inte granska andras uppgifter eller hämta medarbetarlistor från API:t.</li>
              <li><strong>Säker lagring:</strong> Alla lösenord hashas med en modern och säker algoritm (bcrypt). Ingen känslig information skickas i klartext.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">6. Dina rättigheter (Rätten att bli glömd)</h2>
            <p>
              Enligt GDPR har du rätt att:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Begära ett utdrag av de personuppgifter vi sparar om dig.</li>
              <li>Begära rättelse av felaktiga uppgifter.</li>
              <li>Begära att din profil och dina inloggningsuppgifter raderas ur systemet (”rätten att bli glömd”), förutsatt att det inte strider mot lagstadgade krav på arkivering av bemanningsdokumentation.</li>
            </ul>
            <p className="text-xs pt-1">
              Kontakta din lokala samordnare eller din DPO Jimmy Berndtsson på <a href="mailto:jimmy@sintari.se" className="text-terracotta hover:underline">jimmy@sintari.se</a> för att utöva dina rättigheter.
            </p>
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
