"use client";
import { useState, useEffect } from "react";
import { X, ArrowRight, Calendar, Users, ClipboardList, Star, CheckCircle2, HelpCircle } from "lucide-react";
import Link from "next/link";
import { getUser } from "@/lib/auth";

const STORAGE_KEY = "sintari_onboarding_v1";

interface Step {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href?: string;
  cta?: string;
}

function getSteps(role: string, employeeId: string | null): Step[] {
  if (role === "superadmin" || role === "schemaansvarig") {
    return [
      {
        icon: <Users size={20} className="text-terracotta" />,
        title: "Bjud in din personal",
        desc: "Gå till Roller & Behörigheter, välj en anställd och tilldela rollen 'Personal'. En inbjudningslänk skapas automatiskt.",
        href: "/roller",
        cta: "Öppna Roller →",
      },
      {
        icon: <ClipboardList size={20} className="text-amber-600" />,
        title: "Ställ in bemanningskrav",
        desc: "Ange hur många personal som behövs varje dag och kväll för din grupp. Systemet använder detta när det genererar schemat.",
        href: "/schemalagga",
        cta: "Öppna Bemanning →",
      },
      {
        icon: <Calendar size={20} className="text-sage" />,
        title: "Kör ditt första autoschema",
        desc: "Gå till din grupp på dashboarden och klicka 'Kör autoschema'. Klart på under en sekund.",
        href: "/dashboard",
        cta: "Till dashboard →",
      },
    ];
  }

  if (role === "personal" && employeeId) {
    return [
      {
        icon: <Star size={20} className="text-terracotta" />,
        title: "Lägg in dina önsketider",
        desc: "Klicka på en dag i kalendern och välj vilken tid du vill jobba. Du kan välja förinställda tider eller ange egna.",
        cta: "Förstått!",
      },
      {
        icon: <Calendar size={20} className="text-sage" />,
        title: "Se ditt schema",
        desc: "När schemat är klart ser du dina pass direkt i kalendern. Färgerna visar vilken typ av pass det är.",
        cta: "Förstått!",
      },
      {
        icon: <CheckCircle2 size={20} className="text-amber-600" />,
        title: "Fyll i ditt personkort",
        desc: "Scrolla ner och fyll i återkommande livsmönster — t.ex. om du inte kan jobba varannan lördag. Systemet tar hänsyn till det.",
        cta: "Förstått!",
      },
    ];
  }

  return [];
}

interface Props {
  userId: number;
}

export function WelcomeGuide({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const user = getUser();

  const storageKey = `${STORAGE_KEY}_${userId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(storageKey);
    if (!done) {
      // Liten fördröjning så sidan hinner ladda klart
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [storageKey]);

  if (!user) return null;

  const steps = getSteps(user.role, user.employee_id);
  if (steps.length === 0) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    setOpen(false);
    setStep(0);
  }

  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <>
      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-ink/8 shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="bg-terracotta/8 border-b border-terracotta/12 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="mono-label text-terracotta mb-1">Välkommen till Sintari</p>
                <h2 className="display text-2xl text-ink">
                  {user.role === "personal" ? `Hej, ${user.full_name.split(" ")[0]}!` : `Hej, ${user.full_name.split(" ")[0]}!`}
                </h2>
                <p className="text-sm text-ink-soft mt-1">
                  {user.role === "personal"
                    ? "Här lägger du in dina önskade arbetstider."
                    : "Här är de tre första sakerna att göra."}
                </p>
              </div>
              <button onClick={dismiss} className="text-ink-soft hover:text-ink p-1 shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Steg-indikator */}
            <div className="flex gap-1.5 px-6 pt-5">
              {steps.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-terracotta" : "bg-ink/10"}`} />
              ))}
            </div>

            {/* Innehåll */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-terracotta/10 flex items-center justify-center shrink-0">
                  {current.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-soft mb-1">Steg {step + 1} av {steps.length}</p>
                  <h3 className="text-lg font-bold text-ink mb-1">{current.title}</h3>
                  <p className="text-sm text-ink-soft leading-relaxed">{current.desc}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {step > 0 && (
                  <button onClick={() => setStep(s => s - 1)}
                    className="px-4 py-2.5 border border-ink/10 text-ink-soft rounded-xl text-sm font-medium hover:bg-cream transition">
                    ← Tillbaka
                  </button>
                )}

                {isLast ? (
                  current.href ? (
                    <Link href={current.href} onClick={dismiss}
                      className="flex-1 flex items-center justify-center gap-2 bg-terracotta hover:bg-clay text-white py-2.5 rounded-xl text-sm font-semibold transition">
                      {current.cta ?? "Kom igång"} <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <button onClick={dismiss}
                      className="flex-1 bg-terracotta hover:bg-clay text-white py-2.5 rounded-xl text-sm font-semibold transition">
                      {current.cta ?? "Kom igång"} ✓
                    </button>
                  )
                ) : (
                  <button onClick={() => setStep(s => s + 1)}
                    className="flex-1 flex items-center justify-center gap-2 bg-terracotta hover:bg-clay text-white py-2.5 rounded-xl text-sm font-semibold transition">
                    Nästa <ArrowRight size={15} />
                  </button>
                )}
              </div>

              <button onClick={dismiss} className="w-full mt-3 text-xs text-ink-soft/60 hover:text-ink-soft transition py-1">
                Hoppa över — visa inte igen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alltid-synlig hjälpknapp */}
      {!open && (
        <button
          onClick={() => { setStep(0); setOpen(true); }}
          className="fixed bottom-6 right-6 z-40 w-11 h-11 bg-white border border-ink/10 rounded-full shadow-lg flex items-center justify-center text-ink-soft hover:text-terracotta hover:border-terracotta/30 hover:shadow-xl transition-all"
          title="Visa guide"
        >
          <HelpCircle size={20} />
        </button>
      )}
    </>
  );
}
