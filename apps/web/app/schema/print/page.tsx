"use client";
import { useState, useEffect, use } from "react";
import { fetchEmployees, fetchSchedule } from "@/lib/api";
import { PrintSchedule } from "@/components/PrintSchedule";
import { AuthGuard } from "@/components/AuthGuard";
import type { Employee, ScheduleDay } from "@/lib/types";

interface Props {
  searchParams: Promise<{ group?: string; year?: string; month?: string }>;
}

export default function PrintPage({ searchParams }: Props) {
  const resolvedSearchParams = use(searchParams);
  const group = resolvedSearchParams.group ?? "Norra";
  const year = resolvedSearchParams.year ?? "2026";
  const month = resolvedSearchParams.month ?? "6";

  const y = parseInt(year);
  const m = parseInt(month);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [all, sched] = await Promise.all([
          fetchEmployees("").catch(() => []),
          fetchSchedule(group, y, m).catch(() => []),
        ]);
        setEmployees(all.filter(e => e.group === group));
        setSchedule(sched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [group, y, m]);

  return (
    <AuthGuard requiredRole="admin">
      {loading ? (
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <PrintSchedule
          employees={employees}
          schedule={schedule}
          group={group}
          year={y}
          month={m}
        />
      )}
    </AuthGuard>
  );
}
