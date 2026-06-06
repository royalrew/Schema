"use client";
import { useState, useEffect, use } from "react";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { fetchEmployees, fetchSchedule } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import type { Employee, ScheduleDay } from "@/lib/types";

interface Props {
  params: Promise<{ group: string }>;
}

export default function SchemaPage({ params }: Props) {
  const { group } = use(params);
  const decodedGroup = decodeURIComponent(group);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    async function load() {
      try {
        const [all, sched] = await Promise.all([
          fetchEmployees("").catch(() => []),
          fetchSchedule(decodedGroup, year, month).catch(() => []),
        ]);
        setEmployees(all);
        setSchedule(sched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [decodedGroup]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <AuthGuard requiredRole="admin">
      {loading ? (
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ScheduleGrid
          employees={employees}
          initialSchedule={schedule}
          group={decodedGroup}
          year={year}
          month={month}
        />
      )}
    </AuthGuard>
  );
}
