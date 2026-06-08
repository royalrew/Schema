"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getUser, redirectAfterLogin } from "@/lib/auth";
import { Sparkles, Calendar, User, Send, ChevronDown } from "lucide-react";


/* ── Abstrakt vecko-komposition: antyder schema utan riktiga namn ── */
function WeekArt() {
  // Varje kolumn = en dag. Block = pass, i varma toner. Rent dekorativt.
  const cols: { float: string; blocks: { h: number; c: string }[] }[] = [
    { float: "float-a", blocks: [{ h: 56, c: "bg-terracotta" }, { h: 32, c: "bg-cream" }] },
    { float: "float-b", blocks: [{ h: 32, c: "bg-amber" }, { h: 56, c: "bg-sage" }] },
    { float: "float-c", blocks: [{ h: 72, c: "bg-clay" }] },
    { float: "float-d", blocks: [{ h: 40, c: "bg-sage" }, { h: 40, c: "bg-terracotta/80" }] },
    { float: "float-a", blocks: [{ h: 56, c: "bg-amber" }, { h: 32, c: "bg-cream" }] },
    { float: "float-b", blocks: [{ h: 44, c: "bg-terracotta" }] },
    { float: "float-c", blocks: [{ h: 32, c: "bg-cream" }, { h: 48, c: "bg-clay/80" }] },
  ];

  return (
    <div className="relative">
      {/* mjuka bakgrundscirklar */}
      <div className="absolute -top-8 -right-6 w-40 h-40 rounded-full bg-amber/20 blur-2xl" />
      <div className="absolute bottom-0 -left-8 w-48 h-48 rounded-full bg-sage/20 blur-2xl" />

      <div className="relative bg-white/60 backdrop-blur-sm border border-ink/5 rounded-4xl p-7 shadow-xl shadow-clay/10">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2 h-2 rounded-full bg-terracotta" />
          <span className="w-2 h-2 rounded-full bg-amber" />
          <span className="w-2 h-2 rounded-full bg-sage" />
          <span className="mono-label text-ink-soft/50 ml-2">En vecka</span>
        </div>
        <div className="grid grid-cols-7 gap-2.5">
          {cols.map((col, i) => (
            <div key={i} className={`flex flex-col gap-2.5 ${col.float}`}>
              {col.blocks.map((b, j) => (
                <div key={j} className={`rounded-xl ${b.c}`} style={{ height: b.h }} />
              ))}
              {/* fyll resten med mjuk tom yta */}
              <div className="rounded-xl bg-cream/40 flex-1 min-h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Mjuka linje-ikoner ── */
const Icon = {
  scale: (c: string) => (
    <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18m-7-4 7-11 7 11M5 18a3 3 0 0 0 6 0M13 18a3 3 0 0 0 6 0" />
    </svg>
  ),
  heart: (c: string) => (
    <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
    </svg>
  ),
  phone: (c: string) => (
    <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="3" width="10" height="18" rx="3" /><path d="M11 18h2" />
    </svg>
  ),
  chart: (c: string) => (
    <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16M7 16v-4m5 4V8m5 8v-6" />
    </svg>
  ),
  shield: (c: string) => (
    <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" /><path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  ),
  spark: (c: string) => (
    <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-5.5L14.5 8.5m-5 5L7.5 15.5m9 0-2-2m-5-5-2-2" />
    </svg>
  ),
};

/**
 * A client-side component that animates a count up from 0 to a target number
 * when it scrolls into view, formatted using Swedish locale formatting.
 */
function CountUp({ end, duration = 2000, prefix = "", suffix = "" }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );
    const currentRef = elementRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const start = 0;
    const startTime = performance.now();

    const updateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const current = Math.floor(start + easeProgress * (end - start));
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(updateCount);
  }, [isVisible, end, duration]);

  return (
    <span ref={elementRef} className="tabular-nums font-semibold">
      {prefix}{count.toLocaleString("sv-SE")}{suffix}
    </span>
  );
}

export default function LandingPage() {
  const router = useRouter();

  // FAQ States & Data
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  const faqData = [
    {
      q: "Vad skiljer Sintari från Excel eller andra generella planeringsverktyg?",
      a: "Sintari är inte bara ett ritverktyg. Systemet har en inbyggd deterministisk regelmotor (Constraint Solver) som räknar ut och validerar schemaalternativ. Den kontrollerar i realtid att alla lagar, avtal och era lokala bemanningskrav är uppfyllda till 100 %, vilket sparar hundratals timmar av manuellt pussel."
    },
    {
      q: "Hur hanterar schemamotorn kollektivavtal (t.ex. dygnsvila och veckovila)?",
      a: "Vår lokala schemamotor validerar schemat mot arbetstidslagens hårda regler: 11 timmars sammanhängande dygnsvila (pauser i delade turer exkluderas automatiskt), minst 36 timmars veckovila (måndag–söndag), samt minst 9 lediga dagar under en 28-dagarsperiod. Den tar även hänsyn till anställningskontraktens veckoarbetstid (t.ex. 40h för dagtid, 37h för varierande, 30h för kväll, 26h för helg och 34.33h för natt)."
    },
    {
      q: "Hur skyddas medarbetarnas personuppgifter (Sovereign & Secure)?",
      a: "Datasäkerhet är grundläggande i Sintari. Vår schemamotor körs helt lokalt med deterministisk matematik. Den AI-hjälp som finns (RAG-assistenten) är helt anonymiserad — inga personnamn, personnummer eller känsliga medborgar- och patientuppgifter skickas någonsin utanför systemet."
    },
    {
      q: "Hur styrs behörigheter, och sparas bevis på vem som ändrat i schemat?",
      a: "Systemet använder rollbaserad behörighetskontroll (RBAC). Medarbetare ser bara sitt eget schema och sina egna saldon, medan samordnare kan planera för sin grupp. Alla ändringar av arbetspass och saldon loggas automatiskt i en oföränderlig historik med tidpunkt och namnet på den som utförde ändringen. Det ger full spårbarhet och bevis för alla schemabeslut."
    }
  ];

  // RAG Simulator States
  const [activePersona, setActivePersona] = useState<"sara" | "personal">("sara");
  const [demoMessages, setDemoMessages] = useState<any[]>([
    {
      sender: "system",
      text: "Hej! Jag är din Sintari-assistent. Jag kan svara på frågor om hur du navigerar i systemet och visa arbetspass för din personal. Vad vill du veta?",
    }
  ]);
  const [demoTyping, setDemoTyping] = useState(false);
  const [demoSelectedQuestion, setDemoSelectedQuestion] = useState<string | null>(null);

  const saraQuestions = [
    {
      q: "Hur jobbar Maria den 25e maj?",
      a: {
        text: "Maria Svensson jobbar **Morgonpass (tidig)** (DAG_TIDIG) på 2026-05-25 mellan kl. **06:45–15:30** i grupp **Norra**.",
        shiftDetails: {
          employee_name: "Maria Svensson",
          date_str: "2026-05-25",
          shift_type: "dag_tidig",
          start_time: "06:45",
          end_time: "15:30",
          is_unbooked: false,
          group_name: "Norra",
          label: "Morgonpass (tidig)"
        }
      }
    },
    {
      q: "Hur lägger jag in ett önskeschema?",
      a: {
        text: "Här är stegen för att lägga in önskeschema i Sintari:",
        steps: [
          "Gå till **Önskeschema** i huvudmenyn.",
          "Klicka på de datum i kalendern du vill önska pass för.",
          "Välj önskade passtyper (Fm, Em, Natt) eller fyll i anpassade tider.",
          "Klicka på **Spara önskemål**. Systemet validerar automatiskt dygnsvila och veckovila i realtid!"
        ]
      }
    },
    {
      q: "Vad säger arbetstidslagen om övertid?",
      a: {
        text: "Jag kan tyvärr inte svara på frågor om arbetstidslagen, löner eller fackliga avtal på grund av GRC-skyddsregler. Vänligen vänd dig till HR-avdelningen eller din fackliga representant."
      }
    }
  ];

  const personalQuestions = [
    {
      q: "När jobbar jag den 12 juni?",
      a: {
        text: "Du jobbar **Kort kvällspass** (KVAL_KORT) på 2026-06-12 mellan kl. **13:45–20:00** i grupp **Södra**.",
        shiftDetails: {
          employee_name: "Ditt Arbetspass (Inloggad)",
          date_str: "2026-06-12",
          shift_type: "kval_kort",
          start_time: "13:45",
          end_time: "20:00",
          is_unbooked: false,
          group_name: "Södra",
          label: "Kort kvällspass"
        }
      }
    },
    {
      q: "Var ser jag mitt timsaldo?",
      a: {
        text: "Här är hur du enkelt hittar ditt aktuella timsaldo i systemet:",
        steps: [
          "Klicka på ditt namn eller profilbild i sidhuvudet.",
          "Välj fliken **Timsaldon & Historik**.",
          "Där ser du ditt ingående saldo från Medvind samt dina ackumulerade timmar för den aktiva schemaperioden."
        ]
      }
    },
    {
      q: "Är det lagligt att tvinga mig till delad tur?",
      a: {
        text: "Jag kan tyvärr inte svara på frågor om lagstiftning, löner eller fackliga avtal på grund av GRC-skyddsregler. Vänligen vänd dig till HR-avdelningen eller din fackliga representant."
      }
    }
  ];

  const handleDemoQuestionClick = (q: string, a: any) => {
    if (demoTyping) return;
    setDemoSelectedQuestion(q);
    
    // Lägg till användarens meddelande
    const newMsgs = [...demoMessages, { sender: "user" as const, text: q }];
    setDemoMessages(newMsgs);
    setDemoTyping(true);

    setTimeout(() => {
      setDemoTyping(false);
      setDemoMessages(prev => [
        ...prev,
        {
          sender: "system" as const,
          text: a.text,
          shiftDetails: a.shiftDetails || null,
          steps: a.steps || null
        }
      ]);
    }, 1200);
  };

  const handlePersonaSwitch = (persona: "sara" | "personal") => {
    setActivePersona(persona);
    setDemoSelectedQuestion(null);
    setDemoMessages([
      {
        sender: "system",
        text: persona === "sara"
          ? "Hej! Jag är din Sintari-assistent. Jag kan svara på frågor om hur du navigerar i systemet och visa arbetspass för din personal. Vad vill du veta?"
          : "Hej! Som medarbetare kan jag visa dina personliga pass, timsaldon och hjälpa dig att lägga önskemål. Klicka på en fråga till vänster för att testa!",
      }
    ]);
  };

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      const user = getUser();
      if (user) router.push(redirectAfterLogin(user.role, user.employee_id));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -60px 0px" }
    );

    const animatedElements = document.querySelectorAll(
      ".reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale"
    );
    animatedElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-paper text-ink relative overflow-hidden min-h-screen">
      {/* Flytande dekorativa gradient-cirklar i bakgrunden för att ge "liv" vid scroll */}
      <div className="absolute top-[18%] left-[-15%] w-180 h-180 rounded-full bg-sage/12 blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: "0s" }} />
      <div className="absolute top-[45%] right-[-15%] w-200 h-200 rounded-full bg-amber/12 blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: "2.5s" }} />
      <div className="absolute top-[75%] left-[-10%] w-160 h-160 rounded-full bg-terracotta/8 blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: "5s" }} />

      {/* ════════ NAV ════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "pt-2" : "pt-4"}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className={`flex items-center justify-between rounded-full border transition-all duration-500 pl-5 pr-2.5 ${
            scrolled 
              ? "bg-paper/95 backdrop-blur-xl border-ink/12 py-2 shadow-md" 
              : "bg-paper/70 backdrop-blur-md border-ink/6 py-3 shadow-xs"
          }`}>
            <Link href="#" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 bg-terracotta rounded-full flex items-center justify-center transition-transform duration-500 group-hover:rotate-180">
                <div className="w-2.5 h-2.5 bg-paper rounded-full" />
              </div>
              <span className="font-display text-xl hover-underline-expand">Sintari</span>
            </Link>
            <div className="flex items-center gap-6 mr-2">
              <Link href="/systembeskrivning" className="text-sm text-ink-soft hover:text-ink hover-underline-expand py-1 transition-colors">Systembeskrivning</Link>
              <a href="#hur" className="text-sm text-ink-soft hover:text-ink hover-underline-expand py-1 transition-colors">Hur det funkar</a>
              <a href="#varde" className="hidden sm:block text-sm text-ink-soft hover:text-ink hover-underline-expand py-1 transition-colors">Värde</a>
              <a href="#faq" className="hidden sm:block text-sm text-ink-soft hover:text-ink hover-underline-expand py-1 transition-colors">FAQ</a>
              <Link href="/login" className="ml-2 text-sm font-semibold bg-ink text-paper px-5 py-2 rounded-full hover:bg-ink-soft transition-all duration-300 hover:scale-105 active:scale-95 shadow-xs">
                Logga in
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ════════ HERO ════════ */}
      <header className="relative warm-glow overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 pt-40 pb-28">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
            <div>
              <p className="mono-label text-terracotta mb-6 rise rise-1">Specialbyggda schemasystem</p>
              <h1 className="display text-5xl md:text-[4.3rem] leading-[1.02] mb-7 rise rise-2">
                Ditt schema.<br />
                Dina regler.<br />
                <span className="text-terracotta">Klart på minuter.</span>
              </h1>
              <p className="text-lg text-ink-soft max-w-md mb-10 leading-relaxed rise rise-3">
                Inte ett generellt system du tvingas anpassa dig efter — utan ett som byggs
                runt hur just din verksamhet och din personal faktiskt arbetar.
              </p>
              <div className="flex flex-wrap gap-3 rise rise-4">
                <a href="#kontakt" className="bg-terracotta hover:bg-clay text-white font-semibold px-7 py-3.5 rounded-full transition shadow-lg shadow-terracotta/25">
                  Boka demo
                </a>
                <a href="#hur" className="border border-ink/15 hover:bg-ink/5 text-ink font-semibold px-7 py-3.5 rounded-full transition">
                  Se hur det funkar
                </a>
              </div>
            </div>

            <div className="rise rise-4">
              <WeekArt />
            </div>
          </div>
        </div>

        <div className="relative border-t border-ink/8">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 justify-center text-ink-soft/60">
              <span className="mono-label">Tar hänsyn till</span>
              <span>Dygnsvila</span><span className="text-ink/15">·</span>
              <span>Veckovila</span><span className="text-ink/15">·</span>
              <span>Kollektivavtal</span><span className="text-ink/15">·</span>
              <span>Lokala regler</span>
            </div>
            
            <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md border border-ink/8 px-5 py-3.5 rounded-2xl text-xs text-ink-soft max-w-xl md:max-w-md shadow-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <p className="leading-relaxed">
                Sintari är byggt enligt principen <strong>'Sovereign & Secure'</strong>. Vår schemamotor är lokal matematik, och den AI-hjälp som finns är helt anonymiserad. Inte ett enda namn eller känsligt medborgardata skickas någonsin utanför systemet.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ════════ VÄRDE ════════ */}
      <section id="varde" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-left">
            <p className="mono-label text-terracotta mb-4">Vad det kostar idag</p>
            <h2 className="display text-4xl md:text-5xl leading-tight">
              Tiden att lägga schema är dyrare än man tror.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { end: 1248, prefix: "", suffix: "", unit: "timmar / år", desc: "läggs på att skapa och rätta scheman i en verksamhet med sex grupper." },
              { end: 307000, prefix: "", suffix: "", unit: "kronor / år", desc: "i ren arbetstid — innan en enda brukartimme är utförd." },
              { end: 2, prefix: "< ", suffix: "", unit: "timmar / grupp", desc: "med Sintari. En knapptryckning ersätter en hel arbetsdag." },
            ].map((s, i) => (
              <div key={i} className={`bg-white/60 border border-ink/8 rounded-3xl p-8 hover:-translate-y-1.5 hover:bg-white hover:border-terracotta/30 hover:shadow-xl hover:shadow-terracotta/5 transition-all duration-500 reveal-up ${
                i === 0 ? "delay-100" : i === 1 ? "delay-200" : "delay-300"
              }`}>
                <p className="display text-5xl mb-1 tabular-nums text-terracotta font-semibold">
                  <CountUp end={s.end} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="mono-label text-ink-soft/60 mb-4">{s.unit}</p>
                <p className="text-sm text-ink-soft leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ HUR DET FUNKAR ════════ */}
      <section id="hur" className="bg-cream py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-20 reveal-left">
            <p className="mono-label text-terracotta mb-4">Tre steg</p>
            <h2 className="display text-4xl md:text-5xl leading-tight">
              Från tomt schema till klart — på en eftermiddag.
            </h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-10">
            {/* Anslutande linje */}
            <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-px border-t border-dashed border-ink/20 z-0" />

            {[
              { n: "01", t: "Personalen önskar", d: "Varje anställd lägger in sina önskade tider i mobilen. Systemet visar direkt vad som redan är bemannat.", c: "bg-terracotta", delay: "delay-100" },
              { n: "02", t: "Systemet genererar", d: "En knapptryckning. Schemat byggs på sekunder — med full hänsyn till lag, avtal och era lokala regler.", c: "bg-amber", delay: "delay-200" },
              { n: "03", t: "Chefen attesterar", d: "Systemet flaggar direkt om något saknas. Chefen justerar, godkänner och exporterar. Klart.", c: "bg-sage", delay: "delay-300" },
            ].map((s) => (
              <div key={s.n} className={`relative z-10 reveal-up ${s.delay} group`}>
                <div className={`w-12 h-12 ${s.c} text-white rounded-2xl flex items-center justify-center font-display text-xl mb-5 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  {s.n}
                </div>
                <h3 className="text-xl font-semibold mb-2">{s.t}</h3>
                <p className="text-ink-soft text-sm leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FEATURES ════════ */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-left">
            <p className="mono-label text-terracotta mb-4">Byggt för er verklighet</p>
            <h2 className="display text-4xl md:text-5xl leading-tight">
              Allt ett generellt system saknar.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Icon.scale, t: "Lagenligt automatiskt", d: "11h dygnsvila, 36h veckovila, 9 lediga dagar per 28 — kontrolleras vid varje generering.", c: "text-terracotta bg-terracotta/10" },
              { icon: Icon.heart, t: "Era regler, inte generella", d: "Passtider, bemanningskrav och lokala undantag konfigureras för just er verksamhet.", c: "text-sage bg-sage/10" },
              { icon: Icon.phone, t: "Personal i mobilen", d: "Anställda lägger önskeschema och ser ditt schema direkt — ingen app att installera.", c: "text-amber bg-amber/10" },
              { icon: Icon.chart, t: "Timsaldo & export", d: "Plus- och minustid per anställd, export till Excel och PDF för löneunderlag.", c: "text-clay bg-clay/10" },
              { icon: Icon.shield, t: "Trygg åtkomst", d: "Personal ser bara ditt eget. Schemaläggaren sin grupp. Chefen helheten.", c: "text-terracotta bg-terracotta/10" },
              { icon: Icon.spark, t: "AI som granskar", d: "Föreslår förbättringar utifrån personalens livsmönster — men ändrar aldrig själv.", c: "text-sage bg-sage/10" },
            ].map((f, i) => (
              <div key={i} className={`bg-white/60 border border-ink/8 rounded-3xl p-7 hover:-translate-y-1.5 hover:bg-white hover:border-terracotta/30 hover:shadow-xl hover:shadow-terracotta/5 transition-all duration-500 reveal-up ${
                i % 3 === 0 ? "delay-100" : i % 3 === 1 ? "delay-200" : "delay-300"
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${f.c}`}>
                  {f.icon("w-5 h-5")}
                </div>
                <h3 className="font-semibold text-lg mb-1.5">{f.t}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ POSITIONERING ════════ */}
      <section className="px-6 pb-28 reveal-scale">
        <div className="max-w-4xl mx-auto rounded-[2.5rem] bg-ink text-paper p-12 md:p-16 relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-ink/20 hover:scale-[1.01]">
          <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-terracotta/20 blur-3xl" />
          <div className="relative">
            <p className="display text-3xl md:text-4xl leading-snug mb-8">
              ”De generella systemen får verksamheten att anpassa sig efter mjukvaran.
              <span className="text-paper/45"> Vi gör tvärtom.”</span>
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-terracotta/25 border border-terracotta/40 flex items-center justify-center mono-label text-terracotta">S</div>
              <div>
                <p className="text-sm font-semibold">Sintari</p>
                <p className="text-xs text-paper/40">Specialbyggda schemasystem</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ SINTARI ASSISTENT SIMULATOR ════════ */}
      <section className="bg-cream/40 py-24 px-6 border-y border-ink/8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 reveal-up">
            <p className="mono-label text-terracotta mb-4">Testa assistenten live</p>
            <h2 className="display text-4xl md:text-5xl leading-tight mb-4">
              Konversationshjälp med inbyggda guardrails
            </h2>
            <p className="text-sm text-ink-soft">
              Upplev hur personalen får pedagogisk navigationshjälp, medan schemaläggare kan ställa direkta schemafrågor — helt skyddade från laghallucinationer (GRC).
            </p>
          </div>

          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-stretch">
            {/* Vänster panel: Persona & Frågeval */}
            <div className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm reveal-left">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg text-ink mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-terracotta" />
                    Välj ett test-scenario:
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Assistenten anpassar sina svar och behörigheter utifrån vem som frågar (RBAC).
                  </p>
                </div>

                {/* Persona Tabs */}
                <div className="flex bg-ink/5 p-1 rounded-2xl">
                  <button
                    onClick={() => handlePersonaSwitch("sara")}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activePersona === "sara"
                        ? "bg-white text-ink shadow-sm"
                        : "text-ink-soft/75 hover:text-ink"
                    }`}
                  >
                    Sara (Schemaansvarig)
                  </button>
                  <button
                    onClick={() => handlePersonaSwitch("personal")}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activePersona === "personal"
                        ? "bg-white text-ink shadow-sm"
                        : "text-ink-soft/75 hover:text-ink"
                    }`}
                  >
                    Medarbetare
                  </button>
                </div>

                {/* Frågelista */}
                <div className="space-y-3 pt-2">
                  <span className="mono-label text-[10px] text-ink-soft/50">Klicka på en fråga:</span>
                  <div className="flex flex-col gap-2">
                    {(activePersona === "sara" ? saraQuestions : personalQuestions).map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleDemoQuestionClick(item.q, item.a)}
                        disabled={demoTyping || demoSelectedQuestion === item.q}
                        className={`text-left text-xs p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          demoSelectedQuestion === item.q
                            ? "bg-terracotta border-terracotta text-white shadow-sm"
                            : "bg-white hover:bg-ink/5 border-ink/8 text-ink hover:border-ink/20"
                        } disabled:opacity-60`}
                      >
                        {item.q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nedre info: GRC Guardrail */}
              <div className="mt-8 pt-6 border-t border-ink/8 bg-terracotta/5 border-dashed rounded-2xl p-4 text-[11px] text-ink-soft leading-relaxed">
                <span className="font-bold text-terracotta block mb-1">🛡️ Inbyggda GRC-barriärer</span>
                Testa den sista frågan! Sintari blockerar fackliga turer och lagtolkningar deterministiskt i realtid och förhindrar därmed alla riskfyllda hallucinationer.
              </div>
            </div>

            {/* Höger panel: Glassmorphic Chat Widget mock */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-125 shadow-2xl relative reveal-right">
              {/* Header */}
              <div className="flex items-center gap-2 p-4 bg-slate-800 border-b border-slate-700 shrink-0">
                <div className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terracotta opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-terracotta"></span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1">
                    Sintari Assistent
                    <Sparkles size={11} className="text-terracotta" />
                  </h4>
                  <p className="text-[9px] text-slate-400">Roll: {activePersona === "sara" ? "Sara (Admin)" : "Personal (Elin)"}</p>
                </div>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
                {demoMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-350`}>
                    <div className="max-w-[85%] space-y-1.5">
                      {msg.sender === "system" && (
                        <span className="text-[9px] font-semibold text-slate-500 ml-1 flex items-center gap-0.5">
                          <Sparkles size={8} /> Assistent
                        </span>
                      )}
                      
                      <div
                        className={`text-xs p-3 rounded-2xl leading-relaxed whitespace-pre-line ${
                          msg.sender === "user"
                            ? "bg-[#D95D39] text-white rounded-tr-none"
                            : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none"
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Simulated Generative UI Shift Card */}
                      {msg.sender === "system" && msg.shiftDetails && (
                        <div className="bg-linear-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-md space-y-2.5 animate-in slide-in-from-bottom-2 duration-300">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-terracotta uppercase tracking-wider">
                            <Calendar size={11} />
                            Arbetspass
                          </div>
                          
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-slate-100 flex items-center gap-1">
                              <User size={11} className="text-slate-400" />
                              {msg.shiftDetails.employee_name}
                            </h5>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {msg.shiftDetails.date_str}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800">
                            <span className="flex items-center justify-center w-8 h-8 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-bold">
                              {msg.shiftDetails.shift_type.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-200">
                                {msg.shiftDetails.label}
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono">
                                Kl. {msg.shiftDetails.start_time} – {msg.shiftDetails.end_time}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1.5">
                            <span>Grupp: {msg.shiftDetails.group_name}</span>
                          </div>
                        </div>
                      )}

                      {/* Simulated Step List */}
                      {msg.sender === "system" && msg.steps && (
                        <div className="space-y-1.5 pt-1">
                          {msg.steps.map((step: string, sIdx: number) => (
                            <div key={sIdx} className="flex gap-2 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 shadow-xs animate-in slide-in-from-bottom-1 duration-200">
                              <div className="w-5 h-5 bg-[#D95D39] text-white rounded-full font-bold flex items-center justify-center text-[10px] shrink-0">
                                {sIdx + 1}
                              </div>
                              <div className="leading-relaxed">
                                {step.split("**").map((part: string, pIdx: number) => 
                                  pIdx % 2 === 1 ? <strong key={pIdx} className="text-slate-100 font-bold">{part}</strong> : part
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Simulated typing loader */}
                {demoTyping && (
                  <div className="flex justify-start animate-in fade-in duration-100">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-semibold text-slate-500 ml-1 flex items-center gap-0.5">
                        <Sparkles size={8} /> Assistent skriver...
                      </span>
                      <div className="bg-slate-800 border border-slate-700 px-3.5 py-3 rounded-2xl rounded-tl-none flex items-center gap-1 w-14 justify-center">
                        <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                        <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                        <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input placeholder */}
              <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2 shrink-0">
                <input
                  type="text"
                  readOnly
                  placeholder="Välj en fråga till vänster för att testa..."
                  className="flex-1 text-xs px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl outline-none text-slate-500 font-medium"
                />
                <button disabled className="w-8 h-8 rounded-xl bg-slate-850 text-slate-650 flex items-center justify-center shrink-0">
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ FAQ SEKTION ════════ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 reveal-up">
            <p className="mono-label text-terracotta mb-4">Vanliga frågor</p>
            <h2 className="display text-4xl md:text-5xl leading-tight mb-4">
              Vanliga frågor och svar
            </h2>
            <p className="text-sm text-ink-soft">
              Hitta svar på tekniska och praktiska frågor om Sintaris schemamotor, regelverk och säkerhet.
            </p>
          </div>

          <div className="space-y-4">
            {faqData.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={idx}
                  className="bg-white/60 backdrop-blur-md border border-ink/8 rounded-3xl transition-all duration-300 hover:bg-white hover:border-terracotta/30 reveal-up"
                >
                  <button
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-6 md:p-8 text-left cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className={`font-semibold text-base md:text-lg transition-colors duration-250 ${isOpen ? "text-terracotta" : "text-ink"}`}>
                      {faq.q}
                    </span>
                    <span className={`p-1.5 rounded-full bg-ink/5 text-ink-soft shrink-0 ml-4 transition-transform duration-300 ${isOpen ? "rotate-180 text-terracotta bg-terracotta/10" : ""}`}>
                      <ChevronDown size={18} />
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-6 md:pb-8 px-6 md:px-8">
                        <p className="text-sm md:text-base text-ink-soft leading-relaxed pt-4 border-t border-ink/5">
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ KONTAKT ════════ */}
      <section id="kontakt" className="px-6 pb-28 reveal-scale">
        <div className="max-w-2xl mx-auto text-center">
          <p className="mono-label text-terracotta mb-4">Nästa steg</p>
          <h2 className="display text-4xl md:text-5xl leading-tight mb-4">
            Vill du se det med er egen data?
          </h2>
          <p className="text-ink-soft mb-10 max-w-md mx-auto">
            Vi bygger ett anpassat system och visar exakt hur mycket tid ni kan spara.
          </p>
          <form className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
            <input
              type="email"
              placeholder="din@epost.se"
              className="flex-1 bg-white border border-ink/12 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
            />
            <button type="submit" className="bg-terracotta hover:bg-clay hover:scale-105 active:scale-95 text-white font-semibold px-7 py-3.5 rounded-full transition-all duration-300 whitespace-nowrap">
              Boka demo
            </button>
          </form>
          <p className="text-xs text-ink-soft/60 mt-3">Svar inom 24 timmar. Inga förpliktelser.</p>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="border-t border-ink/8 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-terracotta rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-paper rounded-full" />
            </div>
            <span className="font-display text-lg">Sintari</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-ink-soft/60">
            <Link href="/om-oss" className="hover:text-terracotta hover-underline-expand transition-colors py-0.5">Om oss</Link>
            <Link href="/integritetspolicy" className="hover:text-terracotta hover-underline-expand transition-colors py-0.5">Integritetspolicy</Link>
            <Link href="/cookiepolicy" className="hover:text-terracotta hover-underline-expand transition-colors py-0.5">Cookiepolicy</Link>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-settings"))}
              className="hover:text-terracotta hover-underline-expand transition-colors py-0.5 cursor-pointer text-left font-sans"
            >
              Cookie-inställningar
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <p className="text-xs text-ink-soft/40">© 2026 Sintari</p>
            <Link href="/login" className="text-ink-soft hover:text-terracotta hover-underline-expand transition-colors font-semibold py-0.5">Kundlogin →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
