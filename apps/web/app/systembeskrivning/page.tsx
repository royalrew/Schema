"use client";
import { useState } from "react";
import Link from "next/link";
import {
  BookOpen, User, ShieldAlert, Sparkles, Percent, Layers, Info, ListChecks
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminLayout } from "@/components/AdminLayout";

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
      "Ett obokad-pass är som mest 8 timmar och 30 minuter (07:00–15:30), eller kortare om det är det sista som behövs för att nå målet.",
      "Detta säkerställer att alla medarbetare alltid når exakt sitt kontrakterade sysselsättningsmål per schemaperiod."
    ]
  },
  {
    id: "hours-obokad-counts",
    category: "hours",
    title: "OBOKAD tid räknas som arbetade kontraktstimmar",
    desc: "OBOKAD tid räknas som schemalagd närvaro mot personens kontraktstimmar — personen är på jobbet och tillgänglig. Tiden kan tas i anspråk av den egna gruppen eller lånas ut till en annan grupp som behöver hjälp. När systemet fyllt på med obokad anses timbalansen alltså vara uppfylld.",
    bullets: [
      "Både obokad och kontorstid räknas in i månadens timmar — det är arbetstid, inte en lucka i schemat.",
      "Om en person ligger under sitt timmål kan AI-assistenten i korrigeringsläget föreslå att fylla på med obokad tid på lediga dagar och deldagar, med hänsyn till 11h dygnsvila och kontraktets tillåtna veckodagar.",
      "Tanken är att detta ska samspela med kontorstid — vissa personer ska kunna få kontorstid ibland istället för ren obokad.",
      "Detta motsvarar hur samordnarna idag fyller de små hålen manuellt efter att alla grupper lagts; i värsta fall används vikarier."
    ]
  },
  {
    id: "hours-balance-threshold",
    category: "hours",
    title: "Varning vid stor timavvikelse i schemat",
    desc: "När schemat är genererat räknar systemet ihop varje persons schemalagda timmar och jämför med vad de ska jobba enligt sin tjänstgöringsgrad. Om det skiljer mer än 15 timmar åt något håll slår systemet larm.",
    bullets: [
      "Exempel: En person ska jobba 159 timmar i juni men schemat ger henne bara 140 timmar — det är 19 timmar för lite och systemet flaggar detta direkt.",
      "Systemet föreslår då automatiskt att lägga in 'obokad tid' (administrationstid) på hennes lediga dagar för att täcka upp.",
      "Om schemat istället ger henne 178 timmar — 19 timmar för mycket — varnar systemet så att du kan justera manuellt."
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
    desc: "Hur systemet löser 'tokigheter' när för många har önskat samma passtyp en viss dag.",
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

const SECTIONS = [
  { id: "overview", label: "Systemöversikt", icon: BookOpen },
  { id: "roles", label: "Roller & Behörigheter", icon: User },
  { id: "contracts", label: "Anställningsformer", icon: Layers },
  { id: "hours", label: "Tim- & Tjänstgöringsberäkning", icon: Percent },
  { id: "hard-rules", label: "Hårda regler (Lagar/Avtal)", icon: ShieldAlert },
  { id: "soft-rules", label: "Mjuka regler (Rättvisa/Önskemål)", icon: Sparkles },
] as const;

export default function SystembeskrivningPage() {
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const currentSpecs = SPECIFICATIONS.filter(s => s.category === activeSection);

  return (
    <AuthGuard requiredRole="superadmin">
      <AdminLayout>
        <div className="bg-paper min-h-screen text-ink pb-24 relative overflow-x-hidden w-full">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-amber/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-sage/10 blur-3xl pointer-events-none" />

          <main className="max-w-4xl mx-auto px-6 relative z-10 space-y-10">
            {/* Page Title */}
            <header className="space-y-4 pt-2">
              <div className="space-y-2">
                <h1 className="display text-3xl md:text-4xl tracking-tight">
                  Systembeskrivning & <span className="text-terracotta">Schema-specifikation</span>
                </h1>
                <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
                  Detta är dokumentationen över alla regler, behörigheter och beräkningsmodeller som ligger till grund för Töreboda hemtjänstschema i Sintari. Sidan är en ren referens — den ändras inte härifrån.
                </p>
              </div>

              {/* Hänvisning till genomgången */}
              <div className="bg-white/70 border border-ink/8 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ListChecks size={18} className="text-terracotta shrink-0 mt-0.5" />
                  <p className="text-xs text-ink-soft leading-relaxed max-w-xl">
                    Ska du gå igenom reglerna med Sara och notera vad som behöver ändras? Det görs i
                    <span className="font-semibold text-ink"> Genomgång med Sara</span> under Inställningar.
                  </p>
                </div>
                <Link
                  href="/installningar?tab=genomgang"
                  className="shrink-0 bg-terracotta hover:bg-clay text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors text-center"
                >
                  Öppna genomgång
                </Link>
              </div>
            </header>

            {/* ── Tabs / Navigation ── */}
            <div className="flex flex-wrap gap-2 border-b border-ink/8 pb-4">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeSection === s.id
                        ? "bg-terracotta text-white shadow-sm"
                        : "bg-white border border-ink/8 text-ink-soft hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    <Icon size={14} />
                    {s.label}
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
                  {currentSpecs.map((spec) => (
                    <div
                      key={spec.id}
                      className="border border-ink/8 rounded-2xl p-5 md:p-6 bg-white shadow-xs space-y-4"
                    >
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-ink">{spec.title}</h3>
                        <p className="text-xs text-ink-soft leading-relaxed">{spec.desc}</p>
                      </div>

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
                    </div>
                  ))}
                </div>

                {/* Informative advice at bottom of hours section */}
                {activeSection === "hours" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                    <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-800 leading-relaxed space-y-1">
                      <span className="font-bold text-amber-900 block">Om timberäkningen</span>
                      <p>Kontrollera att tim-beräkningen (formeln) stämmer med hur ni räknar i Töreboda kommun — särskilt hur ni gör när personal har deltid (gått ner i sysselsättningsgrad).</p>
                      <p>Sintaris metod är att <strong>automatiskt fyllnadsschemalägga OBOKAD tid</strong> på lediga dagar för att täcka upp eventuella timunderskott, vilket garanterar att de landar på exakt rätt planerade timmar vid månadens slut.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <footer className="pt-6 border-t border-black/5 text-center">
              <p className="text-xs text-ink-soft/50">© 2026 Sintari · Töreboda schema-dokumentation</p>
            </footer>
          </main>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
