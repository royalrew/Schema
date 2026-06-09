"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Renders the RollerRedirect component, which automatically redirects
 * the user from the deprecated `/roller` path to the unified `/medarbetare` path.
 *
 * @returns The rendered redirect loading screen.
 */
export default function RollerRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/medarbetare");
  }, [router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
