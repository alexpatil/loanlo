import type {
  Customer,
  Loan,
  EmiSchedule,
  Payment,
  User,
  Role,
  LoanStatus,
} from "@prisma/client";

/** Discriminated result returned by every server action. */
export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export interface DashboardStats {
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  overdueLoans: number;
  pendingLoans: number;
  totalCustomers: number;
  totalDisbursed: number;
  totalCollection: number;
  monthlyDisbursement: number;
  monthlyCollection: number;
  outstandingPrincipal: number;
}

export interface ChartPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface CollectionTrendPoint {
  month: string;
  collection: number;
  disbursement: number;
}

export interface LoanStatusBreakdown {
  status: LoanStatus;
  count: number;
  amount: number;
}

export type CustomerWithRelations = Customer & {
  assignedAgent: Pick<User, "id" | "name" | "email"> | null;
  _count?: { loans: number };
};

export type LoanWithRelations = Loan & {
  customer: Pick<Customer, "id" | "firstName" | "lastName" | "customerCode" | "phone">;
  assignedAgent: Pick<User, "id" | "name"> | null;
  _count?: { emiSchedules: number; payments: number };
};

export type LoanDetail = Loan & {
  customer: Customer;
  emiSchedules: EmiSchedule[];
  payments: (Payment & { collectedBy: Pick<User, "id" | "name"> | null })[];
  assignedAgent: Pick<User, "id" | "name"> | null;
  approvedBy: Pick<User, "id" | "name"> | null;
};

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
}
