export type ContractType =
  | "dagtid"
  | "varierande"
  | "kval"
  | "helg_fre_man"
  | "natt"
  | "vikarie";

export type ShiftType =
  | "dag_tidig"
  | "dag"
  | "kval_kort"
  | "kval_lang"
  | "delad_tur"
  | "natt"
  | "obokad"
  | "APT"
  | "kontorstid"
  | "planeringstid";

export type AbsenceType = "sem" | "FL" | "TJL" | "sjuk" | "VAB" | "KOM" | "STU";

export type Group =
  | "Norra"
  | "Södra"
  | "Östra"
  | "Centrum 1"
  | "Centrum 2"
  | "Centrum 3"
  | "Moholm"
  | "Natten";

export interface ShiftSegment {
  start_time: string; // ISO datetime
  end_time: string;
  activity?: ShiftType;
}

export interface Shift {
  shift_type: ShiftType;
  segments: ShiftSegment[];
  is_unbooked: boolean;
  note?: string;
}

export interface Absence {
  date: string; // ISO date
  absence_type: AbsenceType;
}

export interface Employee {
  id: string;
  name: string;
  contract_type: ContractType;
  group: Group;
  absences: Absence[];
  wishes: string[];
  vetos: string[];
  is_dagansvarig?: boolean;
  is_planerare?: boolean;
  percentage?: number;
  target_days_per_month?: number | null;
  target_evenings_per_month?: number | null;
}

export interface ScheduleDay {
  date: string; // ISO date
  employee_id: string;
  shift: Shift | null;
  absence: Absence | null;
  assigned_group?: string;
  note?: string | null;
}

export interface ValidationError {
  rule_name: string;
  employee_id: string;
  date: string;
  message: string;
  severity: "hard" | "soft";
}

export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
}

export type Phase = "wish" | "correction" | "attested";

export interface PeriodInfo {
  phase: Phase;
  has_schedule: boolean;
  apt_date: string | null;
  apt_time: string | null;
  wish_deadline: string | null;
  decisions: string[];
}

export interface GenerateResponse {
  schedule_days: ScheduleDay[];
  validation: ValidationResult;
  stats: {
    total_shifts: number;
    obokad_days: number;
    hard_errors: number;
    soft_warnings: number;
  };
  phase: Phase;
  decisions: string[];
}

export interface HourlyRequirement {
  start_time: string;
  end_time: string;
  needed_heads: number;
  prioritized_activities: string[];
}

export interface FixStep {
  step_id: string;
  op: string | null;
  employee_id: string | null;
  employee_name: string | null;
  date: string | null;
  slot: string | null;
  added_hours: number | null;
  description: string;
  resolves_rule: string;
}

export interface UnresolvedItem {
  rule_name: string;
  date: string;
  message: string;
}

export interface FixPlan {
  steps: FixStep[];
  warnings_before: number;
  warnings_after_if_all: number;
  new_hard_errors: number;
  unresolved: UnresolvedItem[];
  explanation: string;
}

export interface ApplyPlanResult {
  ok: boolean;
  applied_count: number;
  warnings_after: number;
  hard_errors_after: number;
}

export interface Bemanningskrav {
  group: Group;
  date: string; // ISO date "YYYY-MM-DD"
  fm_heads: number;
  em_heads: number;
  kval_heads: number;
  natt_heads: number;
  hourly_requirements?: HourlyRequirement[];
}
