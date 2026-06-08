"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BookOpen, Scale, User, ShieldAlert, Sparkles, Percent, HelpCircle, Check, ArrowLeft, Layers, Info, ThumbsUp, ThumbsDown, Copy, CheckCircle, MessageSquare
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";

type Section = "overview" | "roles" | "contracts" | "hours" | "hard-rules" | "soft-rules";

interface SpecItem {
  id: string;
  category: Section;
  title: string;
  desc: string;
  details?: string;
  bullets?: string[];
}

const SPECIFICATIONS: SpecItem[] = [
  // ── OVERVIEW ──
  {
    id: "overview-engine",
    category: "overview",
    title: "Constraint Solver & Automatisering",
    desc: "Sintari använder en deterministisk regelmotor som genererar ett juridiskt korrekt hemtjänstschema på under 1 sekund. Planeraren slipper lägga tid på manuellt pusslande.",
    bullets: [
      "100 % regelstyrt: Ingen risk för mänskliga räknefel.",
      "Komplement till Medvind: Schemat genereras här och exporteras sedan (Medvind förblir lönesystem).",
      "Beslutslogg: Systemet motiverar på svenska varför vissa val och flyttar gjorts."
    ]
  },
  {
    id: "overview-wishes",
    category: "overview",
    title: "Önskeschemaprincipen",
    desc: "Personalen lägger själva in sina önskade pass och lediga dagar in i kalern. Generatorn respekterar dessa önskemål i första hand, så länge bemanningskraven tillåter det.",
    bullets: [
      "Visar underbemanning i realtid så personalen kan anpassa sina önskemål.",
      "Möjlighet att lägga veto (max 2 st per period) för att garantera ledighet.",
      "Om önskemålen inte går ihop fördelas passen automatiskt enligt prioriteringsregler."
    ]
  },

  // ── ROLES ──
  {
    id: "role-superadmin",
    category: "roles",
    title: "Superadmin (t.ex. Sara Arnham)",
    desc: "Har full behörighet i hela systemet.",
    bullets: [
      "Hanterar personalregistret (lägger till/tar bort medarbetare).",
      "Ställer in sysselsättningsgrad och kontraktstyper.",
      "Hanterar globala passtider, bemanningskrav och låser/låser upp perioder."
    ]
  },
  {
    id: "role-planner",
    category: "roles",
    title: "Schemaansvarig (Planerare / Samordnare)",
    desc: "Den roll som ansvarar för att skapa, granska och godkänna det månatliga schemat.",
    bullets: [
      "Kan redigera bemanningskraven för en specifik månad (t.ex. extra personal vid högtider).",
      "Kör autoschemat och granskar resultatet i en färgkodad kalender/gridvy.",
      "Kan manuellt ändra pass, godkänna mjuka varningar (autofix) samt exportera till PDF/Excel."
    ]
  },
  {
    id: "role-dagansvarig",
    category: "roles",
    title: "Dagansvarig (is_dagansvarig)",
    desc: "En särskild flagga på medarbetare som har ett fast ansvar dagtid.",
    bullets: [
      "De schemaläggs enbart på dagpass (t.ex. DAG eller DAG_TIDIG).",
      "De får ALDRIG kvällspass eller nattpass av generatorn.",
      "Vid krockar (om för många har önskat dagpass en dag) har dagansvariga och dagtidskontrakt högsta prioritet att behålla sina dagpass."
    ]
  },
  {
    id: "role-planerare-emp",
    category: "roles",
    title: "Planerare (medarbetare, is_planerare)",
    desc: "Personal som har ett samordnings- eller planeringsuppdrag.",
    bullets: [
      "När det blir överbemanning på ett pass (fler anställda än vad som krävs) delas passet upp automatiskt.",
      "En del av passet omvandlas till kontors- eller planeringstid.",
      "Generatorn prioriterar personer som är markerade som planerare (is_planerare = true) för att få denna planeringstid."
    ]
  },
  {
    id: "role-kvallspersonal",
    category: "roles",
    title: "Kvällspersonal (Kvällskontrakt)",
    desc: "Personal som anställts specifikt för att arbeta kvällar.",
    bullets: [
      "De schemaläggs enbart på kvällspass (KVAL_KORT eller KVAL_LANG).",
      "De får ALDRIG dagpass eller nattpass.",
      "Vid krockar där för många anställda har önskat kvällspass på samma dag, prioriteras kvällspersonalen för kvällspassen, och ordinarie personal flyttas till dagpass."
    ]
  },
  {
    id: "role-medarbetare",
    category: "roles",
    title: "Medarbetare (Ordinarie personal)",
    desc: "Har begränsad behörighet.",
    bullets: [
      "Loggar in för att se sitt eget och gruppens schema.",
      "Lägger in sina önskemål och veton i kalendern under önskefasen.",
      "Kan inte göra ändringar i det slutgiltiga schemat."
    ]
  },

  // ── CONTRACTS ──
  {
    id: "contract-varierande",
    category: "contracts",
    title: "Varierande (ordinarie)",
    desc: "Detta är standardkontraktet för merparten av hemvårdens personal.",
    bullets: [
      "Kontraktsmått vid heltid: 37 timmar per vecka.",
      "Kan schemaläggas alla veckodagar (måndag till söndag).",
      "Kan jobba både dagpass och kvällspass. Får ej nattpass.",
      "Har stöd för individuella målantal för antal dag- respektive kvällspass per månad."
    ]
  },
  {
    id: "contract-dagtid",
    category: "contracts",
    title: "Dagtid",
    desc: "Personal som enbart arbetar kontorstid/vardagar.",
    bullets: [
      "Kontraktsmått vid heltid: 40 timmar per vecka.",
      "Kan enbart schemaläggas måndag till fredag.",
      "Kan enbart arbeta dagpass. Får ALDRIG kvälls-, helg- eller nattpass."
    ]
  },
  {
    id: "contract-kval",
    category: "contracts",
    title: "Kväll",
    desc: "Personal som enbart arbetar kvällar.",
    bullets: [
      "Kontraktsmått vid heltid: 30 timmar per vecka.",
      "Kan schemaläggas alla veckodagar.",
      "Arbetar enbart kvällspass (KVAL_KORT eller KVAL_LANG). Får ALDRIG dagpass eller nattpass."
    ]
  },
  {
    id: "contract-helg",
    category: "contracts",
    title: "Helg fre–mån",
    desc: "Specialkontrakt för helgpersonal (Sara: 'Fred-Mån').",
    bullets: [
      "Kontraktsmått vid heltid: 26 timmar per vecka.",
      "Kan enbart schemaläggas på fredagar, lördagar, söndagar och måndagar.",
      "Arbetar varje helg enligt kontrakt, max 3 pass per helgblock (fre-mån)."
    ]
  },
  {
    id: "contract-natt",
    category: "contracts",
    title: "Natt",
    desc: "Personal som uteslutande arbetar nattpass.",
    bullets: [
      "Kontraktsmått vid heltid: 34.33 timmar per vecka.",
      "Kan schemaläggas alla veckodagar.",
      "Schemaläggs enbart på nattpass och enbart inom gruppen 'Natten'."
    ]
  },
  {
    id: "contract-vikarie",
    category: "contracts",
    title: "Timvikarie",
    desc: "Personal utan fastställt timmål.",
    bullets: [
      "Kontraktsmått: 0 timmar per vecka.",
      "Schemaläggs enbart vid behov (t.ex. manuellt av planeraren för att täcka luckor).",
      "Får ingen automatisk påfyllnad med OBOKAD tid."
    ]
  },

  // ── HOURS ──
  {
    id: "hours-formula",
    category: "hours",
    title: "Uträkning av heltidstimmar",
    desc: "Måltimmar för en schemaperiod beräknas dynamiskt baserat på anställningsformens veckoarbetstid och antalet dagar i den aktuella kalendermånaden.",
    details: "Formel: Måltimmar = (Veckoarbetstid * Antal dagar i månaden) / 7\n\nExempel för Varierande (37 h/v) under en månad med 30 dagar:\n(37 * 30) / 7 = 158.6 timmar i måltid för perioden."
  },
  {
    id: "hours-reduction",
    category: "hours",
    title: "Gå ner i tjänstgöring (Sysselsättningsgrad)",
    desc: "När en medarbetare arbetar deltid (t.ex. 75 % eller 50 %) justerar planeraren sysselsättningsgraden i medarbetarens profil. Systemet skalar då automatiskt ner måltimmarna linjärt.",
    details: "Formel: Sysselsättningsmål = Måltimmar * Sysselsättningsgrad\n\nExempel för Varierande (37 h/v) under 30 dagar på 75 % tjänstgöring:\n158.57h * 0.75 = 118.9 timmar i mål för månaden.\n\nPlaneraren slipper all manuell saldoräkning eller omräkning i Excel — allt sker i bakgrunden."
  },
  {
    id: "hours-obokad",
    category: "hours",
    title: "Automatisk fyllnad med OBOKAD tid",
    desc: "Efter att önskemål och bemanningskrav har schemalagts räknar generatorn ut hur många timmar varje person har schemalagts. Om de har ett timunderskott (under sitt måltimstal), fyller systemet automatiskt på med 'OBOKAD' tid.",
    bullets: [
      "OBOKAD tid läggs ut på personens lediga och tillåtna dagar.",
      "Standardstorleken på ett fyllnadspass är 8.0 timmar (eller mindre om det är det sista som behövs för att nå målet).",
      "Detta säkerställer att alla medarbetare alltid når exakt sitt kontrakterade sysselsättningsmål per schemaperiod."
    ]
  },

  // ── HARD RULES ──
  {
    id: "hard-dygnsvila",
    category: "hard-rules",
    title: "11 timmars dygnsvila",
    desc: "Minst 11 timmars sammanhängande vila under varje 24-timmarsperiod.",
    bullets: [
      "Bryts ALDRIG av generatorn.",
      "Spärrar manuella ändringar som bryter regeln (t.ex. att lägga ett morgonpass kl 06:45 dagen efter ett kvällspass som slutade 21:30, då detta endast ger 9h 15m vila).",
      "Minsta tillåtna starttid efter ett kvällspass till 21:30 är därmed kl 08:30."
    ]
  },
  {
    id: "hard-veckovila",
    category: "hard-rules",
    title: "36 timmars veckovila",
    desc: "Varje medarbetare måste ha minst 36 timmars sammanhängande ledighet under varje kalendervecka (mån-sön).",
    bullets: [
      "Systemet flaggar det som ett hårt fel om vilan understiger 33 timmar.",
      "Ligger vilan mellan 33 och 36 timmar visas en mjuk varning (för att hantera kortare dispenser)."
    ]
  },
  {
    id: "hard-ledig28",
    category: "hard-rules",
    title: "Ledighetspolicy (9 av 28 dagar)",
    desc: "Enligt Törebodas riktlinjer måste varje medarbetare ha minst 9 helt lediga dagar (helt utan pass eller OBOKAD tid) under varje rullande 28-dagarsperiod.",
    bullets: [
      "Detta kontrolleras löpande och generatorn lämnar tillräckligt med helt lediga dagar."
    ]
  },
  {
    id: "hard-veto",
    category: "hard-rules",
    title: "Max 2 veton per period",
    desc: "Medarbetare kan lägga veto mot att arbeta på max 2 specifika datum under en månad.",
    bullets: [
      "Generatorn schemalägger ALDRIG personal på dagar där de lagt veto.",
      "Detta är en hård regel som inte kan brytas av motorn."
    ]
  },
  {
    id: "hard-absence",
    category: "hard-rules",
    title: "Frånvarospärr",
    desc: "Spärr mot schemaläggning på dagar med registrerad frånvaro.",
    bullets: [
      "Frånvaro (semester, VAB, sjukskrivning, facklig tid) läggs in i systemet.",
      "Generatorn lägger aldrig pass på dessa dagar, och planeraren kan inte manuellt schemalägga dem där utan att ta bort frånvaron först."
    ]
  },
  {
    id: "hard-contract-limits",
    category: "hard-rules",
    title: "Kontraktsbegränsningar för passtider",
    desc: "Hårda begränsningar kopplade till anställningsformen som spärrar felaktig schemaläggning.",
    bullets: [
      "Dagansvarig får aldrig kväll eller natt.",
      "Kvällskontrakt får aldrig dagpass eller nattpass.",
      "Nattkontrakt får enbart schemaläggas nattpass i Natten-gruppen.",
      "Helgkontrakt får enbart jobba fredag till måndag."
    ]
  },

  // ── SOFT RULES ──
  {
    id: "soft-shift-targets",
    category: "soft-rules",
    title: "Månadsmål för pass per personal",
    desc: "Planerare kan ställa in hur många dagpass respektive kvällspass varje vanlig personal bör ha under en månad.",
    bullets: [
      "Detta är en mjuk regel (t.ex. att Karin vill ha 10 dagpass och 4 kvällspass).",
      "Generatorn prioriterar att schemalägga personer på den passtyp de har kvar å jobba till sitt målantal.",
      "När schemat valideras ges en mjuk varning om målen inte uppfylls."
    ]
  },
  {
    id: "soft-wish-clashes",
    category: "soft-rules",
    title: "Önskemålskorrigering (Clash resolution)",
    desc: "How systemet löser 'tokigheter' när för många har önskat samma passtyp en viss dag.",
    bullets: [
      "Överskott av dag-önskemål: Dagansvariga och dagtidskontrakt prioriteras för dagpassen. Ordinarie personal (varierande) flyttas automatiskt till kvällspass om det behövs för att täcka kvällsbehovet.",
      "Överskott av kvälls-önskemål: Kvällskontrakt prioriteras för kvällspassen. Ordinarie personal flyttas automatiskt till dagpass.",
      "Alla sådana korrigeringar loggas på svenska i beslutsloggen så planeraren kan spåra varför önskemål ändrats."
    ]
  },
  {
    id: "soft-helgrotation",
    category: "soft-rules",
    title: "Helgrotation (Max 2 helger/månad)",
    desc: "Systemet eftersträvar en rättvis helgfördelning.",
    bullets: [
      "Ordinarie personal och kvällspersonal schemaläggs på max 2 helger per månad.",
      "Undantag: Helgkontrakt (HELG_FRE_MAN) jobbar varje helg enligt kontrakt."
    ]
  },
  {
    id: "soft-nattrapport",
    category: "soft-rules",
    title: "Nattrapporttäckning (DAG_TIDIG kl 06:45)",
    desc: "Varje dag måste minst en person i gruppen schemaläggas på det tidiga dagpasset (DAG_TIDIG) för att ta emot nattrapporten.",
    bullets: [
      "Generatorn roterar detta pass deterministiskt bland ordinarie personal för rättvisa.",
      "Om det saknas en person kl 06:45 flaggar solver-motorn med en täckningsvarning."
    ]
  },
  {
    id: "soft-planering",
    category: "soft-rules",
    title: "Planeringstid & Kontorstid",
    desc: "Vid överbemanning under ett pass delas passet upp automatiskt för att ge personalen tid för administrativa uppgifter.",
    bullets: [
      "Passet delas upp och tilldelas planeringstid eller kontorstid.",
      "Personal med planeringsansvar (is_planerare = true) prioriteras alltid för denna planeringstid."
    ]
  }
];

export default function SystembeskrivningPage() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [feedback, setFeedback] = useState<Record<string, { status: "ok" | "fail"; comment: string }>>({});
  const [saraNotes, setSaraNotes] = useState<string>("");
  const [showFeedbackSummary, setShowFeedbackSummary] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load feedback and notes from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sara_schema_feedback");
    if (saved) {
      try {
        setFeedback(JSON.parse(saved));
      } catch (e) {
        console.error("Kunde inte ladda sparad feedback", e);
      }
    }
    const savedNotes = localStorage.getItem("sara_general_notes");
    if (savedNotes) {
      setSaraNotes(savedNotes);
    }
  }, []);

  // Save feedback when it changes
  const updateFeedback = (id: string, status: "ok" | "fail", comment: string = "") => {
    const next = {
      ...feedback,
      [id]: { status, comment }
    };
    setFeedback(next);
    localStorage.setItem("sara_schema_feedback", JSON.stringify(next));
  };

  const updateNotes = (val: string) => {
    setSaraNotes(val);
    localStorage.setItem("sara_general_notes", val);
  };

  const clearAllFeedback = () => {
    if (window.confirm("Vill du rensa all feedback och anteckningar du lagt in?")) {
      setFeedback({});
      setSaraNotes("");
      localStorage.removeItem("sara_schema_feedback");
      localStorage.removeItem("sara_general_notes");
    }
  };

  const getSummaryText = () => {
    let text = `=== SYSTEMFEEDBACK FRÅN MÖTE MED SARA ===\n`;
    text += `Datum: ${new Date().toLocaleDateString("sv-SE")}\n\n`;

    if (saraNotes) {
      text += `=== SARA'S ALLMÄNNA ÖNSKEMÅL & ANTECKNINGAR ===\n`;
      text += `${saraNotes}\n\n`;
    }

    text += `=== DETALJERADE PUNKTER ===\n`;
    SPECIFICATIONS.forEach(s => {
      const fb = feedback[s.id];
      if (fb) {
        const statusText = fb.status === "ok" ? "STÄMMER [✓]" : "BEHÖVER ÄNDRAS [⚠]";
        text += `- ${s.title} (${s.category})\n`;
        text += `  Status: ${statusText}\n`;
        if (fb.comment) {
          text += `  Kommentar: "${fb.comment}"\n`;
        }
        text += `\n`;
      }
    });

    const unanswered = SPECIFICATIONS.filter(s => !feedback[s.id]);
    if (unanswered.length > 0) {
      text += `Ej granskade punkter:\n`;
      unanswered.forEach(u => {
        text += `- ${u.title}\n`;
      });
    }

    return text;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getSummaryText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SECTIONS = [
    { id: "overview", label: "Systemöversikt", icon: BookOpen },
    { id: "roles", label: "Roller & Behörigheter", icon: User },
    { id: "contracts", label: "Anställningsformer", icon: Layers },
    { id: "hours", label: "Tim- & Tjänstgöringsberäkning", icon: Percent },
    { id: "hard-rules", label: "Hårda regler (Lagar/Avtal)", icon: ShieldAlert },
    { id: "soft-rules", label: "Mjuka regler (Rättvisa/Önskemål)", icon: Sparkles },
  ] as const;

  const currentSpecs = SPECIFICATIONS.filter(s => s.category === activeSection);
  const reviewedCount = Object.keys(feedback).length;
  const totalCount = SPECIFICATIONS.length;
  const percentReviewed = Math.round((reviewedCount / totalCount) * 100);

  return (
    <AuthGuard requiredRole="superadmin">
      <div className="bg-paper min-h-screen text-ink pb-24 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-amber/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-sage/10 blur-3xl pointer-events-none" />

        {/* ── Header / Nav ── */}
        <nav className="max-w-4xl mx-auto px-6 pt-8 pb-6 flex justify-between items-center relative z-10">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-terracotta rounded-full flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-paper rounded-full" />
            </div>
            <span className="font-display text-xl">Sintari</span>
          </Link>
          <Link href="/dashboard" className="text-xs font-semibold text-ink-soft hover:text-ink transition flex items-center gap-1">
            <ArrowLeft size={14} /> Till översikten
          </Link>
        </nav>

        <main className="max-w-4xl mx-auto px-6 relative z-10 space-y-10">
          {/* Page Title */}
          <header className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <h1 className="display text-3xl md:text-4xl tracking-tight">
                  Systembeskrivning & <span className="text-terracotta">Schema-specifikation</span>
                </h1>
                <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
                  Denna sida sammanfattar alla regler, behörigheter och beräkningsmodeller som ligger till grund för Töreboda hemtjänstschema i Sintari. Gå igenom dessa steg för steg med Sara under er demonstration.
                </p>
              </div>

              {/* Progress Card */}
              <div className="bg-white/80 border border-ink/8 rounded-2xl p-4 min-w-[200px] space-y-2 shrink-0 shadow-sm">
                <div className="flex justify-between text-xs font-bold text-ink">
                  <span>Gransknings-framsteg</span>
                  <span>{reviewedCount} / {totalCount} ({percentReviewed}%)</span>
                </div>
                <div className="w-full bg-ink/10 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-terracotta h-full transition-all duration-300" 
                    style={{ width: `${percentReviewed}%` }} 
                  />
                </div>
                <p className="text-[10px] text-ink-soft">
                  Klicka på <span className="text-green-700 font-bold">Ja, stämmer</span> eller <span className="text-amber-700 font-bold">Behöver ändras</span> för varje specifikation.
                </p>
              </div>
            </div>
          </header>

          {/* ── Tabs / Navigation ── */}
          <div className="flex flex-wrap gap-2 border-b border-ink/8 pb-4">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isCompleted = SPECIFICATIONS.filter(sp => sp.category === s.id).every(sp => feedback[sp.id]);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                    activeSection === s.id
                      ? "bg-terracotta text-white shadow-sm"
                      : "bg-white border border-ink/8 text-ink-soft hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  <Icon size={14} />
                  {s.label}
                  {isCompleted && (
                    <span className="w-2 h-2 rounded-full bg-green-500 absolute -top-1 -right-1 border border-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Content Area ── */}
          <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6 md:p-8 shadow-xl shadow-clay/5 space-y-8 min-h-[400px]">
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-ink/8">
                <h2 className="text-lg font-bold text-ink flex items-center gap-2 capitalize">
                  {activeSection === "overview" && <BookOpen size={18} className="text-terracotta" />}
                  {activeSection === "roles" && <User size={18} className="text-terracotta" />}
                  {activeSection === "contracts" && <Layers size={18} className="text-terracotta" />}
                  {activeSection === "hours" && <Percent size={18} className="text-terracotta" />}
                  {activeSection === "hard-rules" && <ShieldAlert size={18} className="text-red-600" />}
                  {activeSection === "soft-rules" && <Sparkles size={18} className="text-amber-500" />}
                  {SECTIONS.find(s => s.id === activeSection)?.label}
                </h2>
              </div>

              {/* List of current section specs */}
              <div className="space-y-6">
                {currentSpecs.map((spec) => {
                  const itemFeedback = feedback[spec.id];
                  
                  return (
                    <div 
                      key={spec.id} 
                      className={`border rounded-2xl p-5 md:p-6 transition-all bg-white shadow-xs space-y-4 ${
                        itemFeedback?.status === "ok" 
                          ? "border-green-300 bg-green-50/20" 
                          : itemFeedback?.status === "fail" 
                            ? "border-amber-300 bg-amber-50/20" 
                            : "border-ink/8"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                            {spec.title}
                            {itemFeedback?.status === "ok" && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-normal flex items-center gap-1">
                                <Check size={10} /> Stämmer
                              </span>
                            )}
                            {itemFeedback?.status === "fail" && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal flex items-center gap-1">
                                <AlertTriangle size={10} className="text-amber-700" /> Ändring önskas
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-ink-soft leading-relaxed">
                            {spec.desc}
                          </p>
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => updateFeedback(spec.id, "ok")}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                              itemFeedback?.status === "ok"
                                ? "bg-green-600 border-green-600 text-white"
                                : "bg-white border-green-200 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            <ThumbsUp size={12} /> Stämmer
                          </button>
                          <button
                            onClick={() => updateFeedback(spec.id, "fail", itemFeedback?.comment ?? "")}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                              itemFeedback?.status === "fail"
                                ? "bg-amber-600 border-amber-600 text-white"
                                : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
                            }`}
                          >
                            <ThumbsDown size={12} /> Behöver ändras
                          </button>
                        </div>
                      </div>

                      {/* Display bullets or details */}
                      {spec.bullets && (
                        <ul className="list-disc pl-5 space-y-1 text-xs text-ink-soft/80">
                          {spec.bullets.map((b, idx) => (
                            <li key={idx} className="leading-relaxed">{b}</li>
                          ))}
                        </ul>
                      )}

                      {spec.details && (
                        <div className="bg-cream/15 border border-ink/5 rounded-xl p-3 mt-2">
                          <h5 className="text-[10px] font-bold text-ink-soft uppercase tracking-wider mb-1">Beräkning & Logik</h5>
                          <pre className="text-xs font-mono text-terracotta whitespace-pre-wrap leading-relaxed">
                            {spec.details}
                          </pre>
                        </div>
                      )}

                      {/* Comment section when Behöver ändras is clicked */}
                      {itemFeedback?.status === "fail" && (
                        <div className="space-y-1.5 pt-2 border-t border-amber-200">
                          <label className="block text-[10px] font-bold text-amber-900 flex items-center gap-1">
                            <MessageSquare size={12} /> Vad stämmer inte? Skriv Saras synpunkter/ändringar här:
                          </label>
                          <textarea
                            value={itemFeedback.comment}
                            onChange={(e) => updateFeedback(spec.id, "fail", e.target.value)}
                            placeholder="T.ex: I Töreboda räknar vi heltid på 38,25h istället för 37h... eller dygnsvilan måste vara stenhård utan undantag."
                            className="w-full text-xs p-2.5 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 bg-white min-h-[60px]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Informative advice at bottom of section */}
              {activeSection === "hours" && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                  <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-800 leading-relaxed space-y-1">
                    <span className="font-bold text-amber-900 block">Viktig diskussionspunkt med Sara:</span>
                    <p>Kontrollera att tim-beräkningen (formeln) stämmer med hur ni räknar i Töreboda kommun. Särskilt hur ni gör när personal har deltid (gått ner i sysselsättningsgrad).</p>
                    <p>Sintaris metod är att <strong>automatiskt fyllnadsschemalägga OBOKAD tid</strong> på lediga dagar för att täcka upp eventuella timunderskott, vilket garanterar att de landar på exakt rätt planerade timmar vid månadens slut.</p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ── Feedback summary & Action buttons ── */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left: Summary checklist */}
            <section className="bg-cream/20 border border-dashed border-ink/20 rounded-[2rem] p-6 md:p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink">Sammanställning & Feedback</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Granska era svar löpande under mötet. När ni gått igenom punkterna kan du visa översikten eller kopiera all feedback till urklipp.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowFeedbackSummary(!showFeedbackSummary)}
                    className="px-4 py-2 bg-white border border-ink/8 text-ink text-xs font-bold rounded-xl hover:bg-ink/5 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <ClipboardList size={14} /> 
                    {showFeedbackSummary ? "Dölj översikt" : "Visa översikt"} ({reviewedCount})
                  </button>
                  <button
                    onClick={copyToClipboard}
                    disabled={reviewedCount === 0 && !saraNotes}
                    className="px-4 py-2 bg-terracotta text-white text-xs font-bold rounded-xl hover:bg-clay disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Copy size={14} /> 
                    {copied ? "Kopierat!" : "Kopiera feedback"}
                  </button>
                  {(reviewedCount > 0 || saraNotes) && (
                    <button
                      onClick={clearAllFeedback}
                      className="px-3 py-2 border border-red-200 text-red-600 bg-white text-xs font-bold rounded-xl hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      Rensa
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Feedback view */}
              {showFeedbackSummary && (
                <div className="bg-white border border-ink/8 rounded-2xl p-4 space-y-4 rise mt-4">
                  <h4 className="font-bold text-xs text-ink pb-2 border-b border-ink/8 flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-terracotta" /> 
                    Detaljerad granskning ({reviewedCount} av {totalCount} granskade)
                  </h4>

                  {reviewedCount === 0 ? (
                    <p className="text-xs text-ink-soft italic">Ingen specifik feedback har registrerats än. Klicka på knapparna vid reglerna ovan.</p>
                  ) : (
                    <div className="divide-y divide-ink/5 max-h-[200px] overflow-y-auto pr-2">
                      {SPECIFICATIONS.map(s => {
                        const fb = feedback[s.id];
                        if (!fb) return null;
                        return (
                          <div key={s.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-col justify-between gap-1 text-[11px]">
                            <div className="flex justify-between items-start">
                              <h5 className="font-bold text-ink">{s.title}</h5>
                              <div>
                                {fb.status === "ok" ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.2 rounded">
                                    Stämmer
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                                    Ändra
                                  </span>
                                )}
                              </div>
                            </div>
                            {fb.comment && (
                              <p className="text-[10px] text-amber-800 bg-amber-50/50 p-1.5 rounded border border-amber-100/50 mt-0.5">
                                &quot;{fb.comment}&quot;
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Right: Saras allmänna anteckningar & mail (disabled / kommer snart) */}
            <section className="bg-white border border-ink/8 rounded-[2rem] p-6 md:p-8 space-y-5 flex flex-col justify-between shadow-xs">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink">Saras Önskemålslogg & Anteckningar</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Skriv ner allmänna önskemål eller förändringsbehov som inte ryms i reglerna ovan. Allt sparas automatiskt lokalt hos dig.
                  </p>
                </div>

                <textarea
                  value={saraNotes}
                  onChange={(e) => updateNotes(e.target.value)}
                  placeholder="Skriv dina allmänna önskemål och anteckningar här... (dessa sparas automatiskt)"
                  className="w-full text-xs p-3 border border-ink/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/40 bg-white min-h-[120px]"
                />
              </div>

              {/* Greyed out email reporting segment */}
              <div className="bg-ink/5 border border-ink/10 rounded-2xl p-4 space-y-3 opacity-60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Kommer snart
                  </span>
                  <span className="text-xs font-bold text-ink flex items-center gap-1">
                    📧 E-postrapportering till Jimmy
                  </span>
                </div>
                <p className="text-[10px] text-ink-soft leading-relaxed">
                  I nästa steg kommer du kunna skicka denna logg med ett klick direkt till Jimmys e-post. Just nu är funktionen inaktiverad men synlig.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    disabled
                    value="jimmy@sintari.se"
                    className="flex-1 bg-ink/10 text-xs px-3 py-2 border border-ink/10 rounded-xl text-ink-soft cursor-not-allowed select-none font-mono"
                  />
                  <button
                    disabled
                    className="bg-ink/20 text-ink-soft/70 border border-ink/10 text-xs font-bold px-3 py-2 rounded-xl cursor-not-allowed select-none"
                  >
                    Skicka e-post
                  </button>
                </div>
              </div>
            </section>

          </div>

          {/* ── Footer ── */}
          <footer className="pt-6 border-t border-black/5 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-ink-soft/50">© 2026 Sintari · Töreboda schema-guide för Sara</p>
            <Link href="/dashboard" className="text-xs font-semibold text-terracotta hover:text-clay transition flex items-center gap-1">
              <ArrowLeft size={12} /> Tillbaka till översikten
            </Link>
          </footer>
        </main>
      </div>
    </AuthGuard>
  );
}

interface AlertTriangleProps {
  size?: number;
  className?: string;
}

function AlertTriangle({ size = 14, className = "" }: AlertTriangleProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

interface ClipboardListProps {
  size?: number;
  className?: string;
}

function ClipboardList({ size = 14, className = "" }: ClipboardListProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M9 14h6"/>
      <path d="M9 18h6"/>
      <path d="M9 10h6"/>
    </svg>
  );
}
