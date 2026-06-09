"use client";
import { useState, useEffect } from "react";
import { ShiftConfigEditor } from "@/components/ShiftConfigEditor";
import { BillingConfigEditor } from "@/components/BillingConfigEditor";
import { fetchShiftConfigs, type ShiftConfig } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminLayout } from "@/components/AdminLayout";
import Link from "next/link";
import { Clock, CreditCard } from "lucide-react";

export default function InstallningarPage() {
  const [configs, setConfigs] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"passtider" | "fakturering">("passtider");

  useEffect(() => {
    fetchShiftConfigs("Norra")
      .then(setConfigs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("passtider")}
              className={`flex items-center gap-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "passtider"
                  ? "border-terracotta text-terracotta"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-350"
              }`}
            >
              <Clock className="w-4 h-4" />
              Passtider
            </button>
            <button
              onClick={() => setActiveTab("fakturering")}
              className={`flex items-center gap-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "fakturering"
                  ? "border-terracotta text-terracotta"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-350"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Fakturering & Organisation (B2G)
            </button>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === "passtider" ? (
              loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <ShiftConfigEditor initialConfigs={configs} />
              )
            ) : (
              <BillingConfigEditor />
            )}
          </div>

        </div>
      </div>
      </AdminLayout>
    </AuthGuard>
  );
}
