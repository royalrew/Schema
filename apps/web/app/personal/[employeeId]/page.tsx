"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { PersonalCalendar } from "@/components/PersonalCalendar";
import { fetchEmployee, fetchSchedule, fetchPeriodInfo } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import { getUser, getEmployeeId } from "@/lib/auth";
import type { Employee, ScheduleDay } from "@/lib/types";

interface Props {
  params: Promise<{ employeeId: string }>;
}

export default function PersonalPage({ params }: Props) {
  const router = useRouter();
  const { employeeId } = use(params);

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [mySchedule, setMySchedule] = useState<ScheduleDay[]>([]);
  const [phase, setPhase] = useState<"wish" | "correction" | "attested">("wish");

  useEffect(() => {
    // 1. Roll-kontroll: Anställda får enbart titta på sin egen kalender!
    const user = getUser();
    const currentEmpId = getEmployeeId();
    if (user && user.role === "personal" && currentEmpId !== employeeId) {
      if (currentEmpId) {
        router.push(`/personal/${currentEmpId}`);
      } else {
        router.push("/login");
      }
      return;
    }

    // 2. Ladda data
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    async function load() {
      try {
        const emp = await fetchEmployee(employeeId);
        setEmployee(emp);

        const periodInfo = await fetchPeriodInfo("", year, month).catch(() => ({ phase: "wish" as const, has_schedule: false }));
        setPhase(periodInfo.phase);

        const schedule = await fetchSchedule(emp.group, year, month).catch(() => []);
        const filtered = schedule.filter(sd => sd.employee_id === employeeId);
        setMySchedule(filtered);
      } catch (err) {
        console.error("Fel vid laddning av kalenderdata:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [employeeId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-gray-500">Anställd hittades inte.</p>
      </div>
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <AuthGuard requiredRole="any">
      <PersonalCalendar
        employee={employee}
        initialSchedule={mySchedule}
        initialPhase={phase}
        year={year}
        month={month}
      />
    </AuthGuard>
  );
}
