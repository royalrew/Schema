"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, Mail, Send, Check } from "lucide-react";

export default function AboutPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Skicka intresseanmälan till jimmy@sintari.se (simuleras säkert här)
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
    setEmail("");
    setTimeout(() => setSubmitted(false), 5000);
  }

  return (
    <div className="bg-paper min-h-screen text-ink pb-24 overflow-hidden relative">
      {/* ── Bakgrundsdekorationer (Varma, natursköna toner) ── */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-amber/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -left-20 w-[600px] h-[600px] rounded-full bg-sage/15 blur-3xl pointer-events-none" />

      {/* ── Nav ── */}
      <nav className="max-w-4xl mx-auto px-6 pt-8 pb-12 flex justify-between items-center relative z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-terracotta rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-paper rounded-full" />
          </div>
          <span className="font-display text-xl">Sintari</span>
        </Link>
        <Link href="/" className="text-sm text-ink-soft hover:text-ink transition flex items-center gap-1">
          ← Tillbaka
        </Link>
      </nav>

      {/* ── Huvudinnehåll ── */}
      <main className="max-w-3xl mx-auto px-6 relative z-10 space-y-16">
        
        {/* ── Header ── */}
        <header className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracotta/10 text-terracotta text-xs font-semibold">
            <Sparkles size={12} />
            <span>Framtidens schemasystem</span>
          </div>
          <h1 className="display text-4xl md:text-[3.5rem] leading-[1.05] tracking-tight">
            Vi bygger scheman runt <span className="text-terracotta">er verklighet</span>.
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed pt-2">
            De flesta system tvingar din verksamhet att anpassa sig efter mjukvarans begränsningar. Sintari gör tvärtom. Vi formar tekniken efter er personal, era kollektivavtal och era unika önskemål.
          </p>
        </header>

        {/* ── Sintari i siffror ── */}
        <section className="space-y-6">
          <p className="mono-label text-ink-soft/60">Sintari i siffror</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { val: "90 %", title: "Minskad administration", desc: "Arbetstiden för att lägga och korrigera scheman krymper från dagar till minuter." },
              { val: "100 %", title: "Lagbunden validering", desc: "Automatiska kontroller mot dygnsvila, veckovila och lokala kollektivavtalsregler." },
              { val: "< 2 min", title: "Klar generering", desc: "En knapptryckning räknar ut det mest rättvisa och optimala schemat för hela gruppen." }
            ].map((s, i) => (
              <div key={i} className="bg-white/50 backdrop-blur-sm border border-black/5 rounded-3xl p-6 shadow-sm shadow-clay/5 relative">
                <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-sage" />
                <p className="display text-4xl text-terracotta mb-1">{s.val}</p>
                <h4 className="font-semibold text-sm text-ink mb-1">{s.title}</h4>
                <p className="text-xs text-ink-soft/70 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Grundare & Idé (Uppdaterad med Jimmy Berndtsson) ── */}
        <section className="grid md:grid-cols-[1fr_1.1fr] gap-10 items-start border-t border-black/5 pt-12">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-ink tracking-tight">Grundare & Idé</h2>
            <div className="flex items-center gap-3.5 pb-2">
              <div className="w-11 h-11 rounded-full bg-amber text-white flex items-center justify-center font-display text-lg font-bold shadow-md shadow-amber/20 shrink-0">
                JB
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Jimmy Berndtsson</p>
                <p className="text-xs text-ink-soft/60">Grundare & Chefsarkitekt, Sintari</p>
              </div>
            </div>
            <p className="text-sm text-ink-soft/80 leading-relaxed">
              Med basen i Töreboda föddes idén om Sintari ur en vilja att hjälpa svensk välfärd. Genom att kombinera avancerad matematik med användarvänlig och vacker design vill vi underlätta vardagen för chefer och medarbetare inom vården.
            </p>
          </div>
          <div className="space-y-4 text-sm text-ink-soft/80 leading-relaxed">
            <h3 className="font-bold text-ink text-base">Varför startade vi?</h3>
            <p>
              Svensk vård och omsorg bärs upp av fantastiska medarbetare. Ändå tillbringar samordnare och enhetschefer orimligt mycket tid med att manuellt pussla och justera scheman i system som Medvind för att uppfylla lagstadgad dygnsvila, kollektivavtalsregler och medarbetares behov.
            </p>
            <p>
              Därför utvecklade vi Sintari tillsammans med **Töreboda hemvård** som vår primära samarbetspartner. Genom att kombinera en helt lokal, matematisk schemamotor med total integritet (med Presidio-PII-tvätt innan AI-analys) har vi skapat ett verktyg som gör schemaläggning enkelt, rättvist och lagligt.
            </p>
          </div>
        </section>

        {/* ── Citat från Töreboda ── */}
        <section className="bg-cream/20 border border-dashed border-ink/20 rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-sage/5 blur-2xl" />
          
          <div className="relative space-y-6">
            <p className="text-base md:text-lg italic text-ink-soft/60 leading-relaxed">
              ”[Här kommer omdömen och utlåtanden från Törebodas utvärdering att infogas efter att systemet har tagits i drift och utvärderats av verksamheten.]”
            </p>
            
            <div className="flex items-center gap-3.5 pt-2 border-t border-dashed border-ink/10">
              <div className="w-10 h-10 rounded-full bg-ink/10 text-ink-soft flex items-center justify-center font-display text-base font-bold shrink-0">
                T
              </div>
              <div>
                <p className="text-sm font-bold text-ink-soft/60">[Töreboda Hemvård]</p>
                <p className="text-xs text-ink-soft/40">[Enhetschef / Medarbetare]</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Interaktivt Boka Demo-formulär (Kopplat till jimmy@sintari.se) ── */}
        <section id="demo" className="bg-white/70 backdrop-blur-md border border-white/40 rounded-[2.25rem] p-8 shadow-xl shadow-clay/10 space-y-6 relative">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-ink">Se Sintari med din egen verksamhetsdata</h3>
            <p className="text-xs text-ink-soft/80 leading-relaxed max-w-xl">
              Vi skräddarsyr en demomiljö utifrån er personals anställningsformer och visar exakt hur mycket tid ni kan spara. Fyll i din e-postadress nedan så kontaktar vi dig från <strong>jimmy@sintari.se</strong>.
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl px-5 py-4 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
                <Check size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Förfrågan har skickats!</h4>
                <p className="text-xs text-green-700/90 mt-0.5">Tack! Vi har mottagit din förfrågan och återkommer till dig inom kort.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleDemoSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-lg">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft/60" />
                <input
                  type="email"
                  required
                  placeholder="din.epost@kommun.se"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white border border-ink/10 rounded-full pl-10 pr-5 py-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-terracotta hover:bg-clay disabled:opacity-50 text-white font-semibold px-8 py-3.5 rounded-full text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-terracotta/15 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? "Skickar..." : <><span>Boka demo</span><Send size={12} /></>}
              </button>
            </form>
          )}
        </section>

        {/* ── Sidfot ── */}
        <footer className="pt-6 border-t border-black/5 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-soft/50">© 2026 Sintari · Töreboda, 545 91 · Innehar FA-skattsedel</p>
          <Link
            href="/"
            className="text-xs font-semibold text-terracotta hover:text-clay transition"
          >
            ← Tillbaka till startsidan
          </Link>
        </footer>
      </main>
    </div>
  );
}
