"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getUserRole, getEmployeeId } from "@/lib/auth";

interface Props {
  children: React.ReactNode;
  requiredRole?: "superadmin" | "admin" | "personal" | "any";
}

export function AuthGuard({ children, requiredRole = "any" }: Props) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    const role = getUserRole();
    if (requiredRole === "superadmin" && role !== "superadmin") {
      router.push("/dashboard");
      return;
    }
    if (requiredRole === "admin" && role !== "superadmin" && role !== "schemaansvarig") {
      const empId = getEmployeeId();
      if (empId) {
        router.push(`/personal/${empId}`);
      } else {
        router.push("/login");
      }
      return;
    }
    setAuthorized(true);
  }, [router, requiredRole]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
