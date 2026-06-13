"use client";
import { useState, useEffect } from "react";
import { ShiftConfigEditor } from "@/components/ShiftConfigEditor";
import { BillingConfigEditor } from "@/components/BillingConfigEditor";
import { SaraReviewPanel } from "@/components/SaraReviewPanel";
import { fetchGroups, fetchShiftConfigs, type ShiftConfig } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminLayout } from "@/components/AdminLayout";
import { Clock, CreditCard, ListChecks } from "lucide-react";

type Tab = "passtider" | "fakturering" | "genomgang";

export default function InstallningarPage() {
  const [configs, setConfigs] = useState<ShiftConfig[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("passtider");

  // Läs ?tab= från URL (t.ex. länk från dashboarden: /installningar?tab=genomgang)
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "genomgang" || tab === "fakturering" || tab === "passtider") {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    fetchGroups()
      .then(async (groupList) => {
        setGroups(groupList);
        if (groupList[0]) {
          setConfigs(await fetchShiftConfigs(groupList[0]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tabs: { id: Tab; label: string; icon: typeof Clock }[] = [
    { id: "passtider", label: "Passtider", icon: Clock },
    { id: "fakturering", label: "Fakturering & Organisation (B2G)", icon: CreditCard },
    { id: "genomgang", label: "Genomgång med Sara", icon: ListChecks },
  ];

  return (
    <AuthGuard requiredRole="admin">
      <AdminLayout>
        <div className="min-h-screen bg-paper p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Unified Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inställningar</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Administrera systeminställningar, passtider och faktureringsinformation för er organisation.
                </p>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex flex-wrap border-b border-gray-200">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                      activeTab === t.id
                        ? "border-terracotta text-terracotta"
                        : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-350"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === "passtider" ? (
                loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <ShiftConfigEditor initialConfigs={configs} groups={groups} />
                )
              ) : activeTab === "fakturering" ? (
                <BillingConfigEditor />
              ) : (
                <SaraReviewPanel />
              )}
            </div>

          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
