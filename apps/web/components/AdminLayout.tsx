"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  BookOpen, 
  Settings, 
  Scale, 
  HeartHandshake,
  LogOut, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  Menu
} from "lucide-react";
import { getUser, clearToken, isLoggedIn } from "@/lib/auth";
import { ChangePasswordModal } from "./ChangePasswordModal";

const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME ?? "Schemamotor";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(false);
    
    // Check if collapsed state was stored previously
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }
    setMounted(true);
  }, []);

  if (mounted && !isLoggedIn()) {
    router.push("/login");
    return null;
  }

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar-collapsed", String(nextState));
  };

  const logout = () => {
    clearToken();
    router.push("/login");
  };

  const navItems = [
    { label: "Översikt", href: "/dashboard", icon: LayoutDashboard },
    { label: "Bemanningskrav", href: "/schemalagga", icon: ClipboardList },
    { label: "Personal & Behörigheter", href: "/medarbetare", icon: Users },
    { label: "Livssituationer", href: "/livssituationer", icon: HeartHandshake },
    { label: "RAG & Kunskap", href: "/rag", icon: BookOpen },
    { label: "Passtider & Mallar", href: "/installningar", icon: Settings },
  ];

  // Only show Systembeskrivning to superadmins
  if (user?.role === "superadmin") {
    navItems.push({ label: "Systembeskrivning", href: "/systembeskrivning", icon: Scale });
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-paper flex text-ink">
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      {/* ── Mobile Header Bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-ink/8 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-terracotta rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-paper rounded-full" />
          </div>
          <span className="font-display text-base font-bold">{ORG_NAME}</span>
        </div>
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)} 
          className="p-2 text-ink-soft hover:text-ink hover:bg-ink/5 rounded-lg transition-colors cursor-pointer"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Collapsible Left Sidebar (Desktop) ── */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-ink/8 h-screen sticky top-0 transition-all duration-300 z-20 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-5 border-b border-ink/5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 overflow-hidden select-none">
            <div className="w-8 h-8 bg-terracotta rounded-full flex items-center justify-center shrink-0">
              <div className="w-3 h-3 bg-paper rounded-full" />
            </div>
            {!isCollapsed && (
              <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap animate-fade-in">
                {ORG_NAME}
              </span>
            )}
          </Link>
          <button 
            onClick={toggleSidebar} 
            className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
            title={isCollapsed ? "Expandera meny" : "Dölj meny"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                  active 
                    ? "bg-terracotta text-white shadow-md shadow-terracotta/10" 
                    : "text-ink-soft hover:text-ink hover:bg-ink/5"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} className={`shrink-0 transition-transform ${active ? "" : "group-hover:scale-105"}`} />
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (User details & Logout) */}
        <div className="p-4 border-t border-ink/5 space-y-3 bg-cream/10">
          {!isCollapsed && user && (
            <div className="px-1 py-1">
              <p className="text-xs font-bold truncate text-ink">{user.full_name}</p>
              <p className="text-[10px] text-ink-soft font-medium capitalize">
                {user.role === "superadmin" ? "Superadmin" : user.role === "schemaansvarig" ? "Schemaansvarig" : "Personal"}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => setShowPasswordModal(true)} 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-ink-soft hover:text-terracotta hover:bg-cream/40 transition-colors cursor-pointer w-full text-left`}
              title={isCollapsed ? "Byt lösenord" : undefined}
            >
              <Shield size={14} className="shrink-0" />
              {!isCollapsed && <span>Byt lösenord</span>}
            </button>
            <button 
              onClick={logout} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-ink-soft hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer w-full text-left"
              title={isCollapsed ? "Logga ut" : undefined}
            >
              <LogOut size={14} className="shrink-0" />
              {!isCollapsed && <span>Logga ut</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Collapsible Left Sidebar (Mobile Drawer) ── */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-xs z-40 md:hidden" onClick={() => setIsMobileOpen(false)}>
          <aside 
            className="w-64 bg-white h-full border-r border-ink/8 flex flex-col z-50 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 border-b border-ink/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 bg-terracotta rounded-full flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-paper rounded-full" />
                </div>
                <span className="font-display text-base font-bold">{ORG_NAME}</span>
              </div>
              <button onClick={() => setIsMobileOpen(false)} className="p-2 text-ink-soft hover:text-ink hover:bg-ink/5 rounded-lg">
                ✕
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      active 
                        ? "bg-terracotta text-white shadow-md" 
                        : "text-ink-soft hover:text-ink hover:bg-ink/5"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-ink/5 space-y-3 bg-cream/10">
              {user && (
                <div className="px-1">
                  <p className="text-xs font-bold truncate text-ink">{user.full_name}</p>
                  <p className="text-[10px] text-ink-soft font-medium capitalize">{user.role}</p>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setShowPasswordModal(true); setIsMobileOpen(false); }} 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-ink-soft hover:text-terracotta hover:bg-cream/40 transition-colors cursor-pointer w-full text-left"
                >
                  <Shield size={14} />
                  <span>Byt lösenord</span>
                </button>
                <button 
                  onClick={logout} 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-ink-soft hover:text-red-500 hover:bg-red-55 transition-colors cursor-pointer w-full text-left"
                >
                  <LogOut size={14} />
                  <span>Logga ut</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 min-w-0 flex flex-col md:pt-0 pt-14 max-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
