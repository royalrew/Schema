"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { getUser } from "@/lib/auth";

/**
 * DemoWarningBanner visas för användare som är inloggade i demomiljö (sandlåda).
 * Den informerar om att miljön raderas efter 7 dagar och erbjuder en länk till att boka en riktig demo.
 */
export function DemoWarningBanner() {
  const [isDemo, setIsDemo] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const user = getUser();
    if (user?.username?.startsWith("demo_")) {
      setIsDemo(true);
    }
  }, []);

  if (!mounted || !isDemo) return null;

  // Dölj på login och demo-laddare för att inte störa flödet
  if (pathname === "/login" || pathname === "/demo") return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:right-auto md:max-w-md z-45 animate-[slideUp_0.5s_ease-out]">
      <div className="bg-white/80 backdrop-blur-xl border border-amber/30 rounded-2xl p-5 shadow-xl shadow-clay/10 relative overflow-hidden flex items-start gap-4">
        {/* Pulsande dekorativ glöd */}
        <div className="absolute -top-6 -left-6 w-16 h-16 rounded-full bg-amber/10 blur-lg pointer-events-none animate-pulse" />
        
        <div className="w-10 h-10 bg-amber/10 rounded-xl flex items-center justify-center shrink-0 border border-amber/20 text-amber">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        
        <div className="flex-1 space-y-1">
          <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            Demoläge aktivt
          </h4>
          <p className="text-[11px] text-ink-soft/90 leading-relaxed">
            Du provkör Sintari i en tillfällig sandlåda för <strong>Granbackens Hemtjänst</strong>. Denna miljö och all tillhörande data raderas automatiskt om 7 dagar.
          </p>
          <div className="pt-2">
            <Link 
              href="/#kontakt"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:text-clay transition-colors"
            >
              <span>Boka demo för din kommun</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
