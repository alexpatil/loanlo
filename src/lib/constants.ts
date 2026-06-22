export const APP_NAME = "Loanlo";
export const APP_DESCRIPTION = "Modern loan management platform";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  AGENT: "AGENT",
} as const;

export type RoleKey = keyof typeof ROLES;

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  AGENT: "Agent",
};

export const LOAN_STATUS = ["PENDING", "APPROVED", "REJECTED", "ACTIVE", "CLOSED", "OVERDUE"] as const;
export type LoanStatusKey = (typeof LOAN_STATUS)[number];

export const LOAN_TYPES = ["EMI", "FLAT_INTEREST", "REDUCING_BALANCE", "FLEXIBLE_LOAN"] as const;
export type LoanTypeKey = (typeof LOAN_TYPES)[number];

export const LOAN_TYPE_LABELS: Record<LoanTypeKey, string> = {
  EMI: "EMI Loan",
  FLAT_INTEREST: "Flat Interest (legacy)",
  REDUCING_BALANCE: "Reducing Balance (legacy)",
  FLEXIBLE_LOAN: "Non-EMI Loan",
};

export const LOAN_TYPE_DESCRIPTIONS: Record<LoanTypeKey, string> = {
  EMI: "Equal monthly installments (EMI) over a fixed number of months.",
  FLAT_INTEREST: "Legacy flat-interest loan.",
  REDUCING_BALANCE: "Legacy reducing-balance loan.",
  FLEXIBLE_LOAN: "Single repayment with interest accruing over time.",
};

// ─── Simplified loan creation model ──────────────────────────────────────────
// The UI offers two kinds; "NON_EMI" maps to the time-based FLEXIBLE_LOAN type.
export const LOAN_KINDS = ["EMI", "NON_EMI"] as const;
export type LoanKindKey = (typeof LOAN_KINDS)[number];

export const LOAN_KIND_LABELS: Record<LoanKindKey, string> = {
  EMI: "EMI Loan",
  NON_EMI: "Non-EMI Loan",
};

export const LOAN_KIND_DESCRIPTIONS: Record<LoanKindKey, string> = {
  EMI: "Borrower repays the same amount every month.",
  NON_EMI: "Interest builds up over time; borrower repays when able.",
};

export const CALCULATION_METHODS = ["FLAT", "REDUCING", "COMPOUND"] as const;
export type CalculationMethodKey = (typeof CALCULATION_METHODS)[number];

export const CALCULATION_METHOD_LABELS: Record<CalculationMethodKey, string> = {
  FLAT: "Flat Interest",
  REDUCING: "Reducing Balance",
  COMPOUND: "Compound Interest",
};

export const CALCULATION_METHOD_DESCRIPTIONS: Record<CalculationMethodKey, string> = {
  FLAT: "Interest stays on the full amount the whole time.",
  REDUCING: "Interest is only on the remaining balance.",
  COMPOUND: "Interest is added on top of interest each period.",
};

export const DURATION_UNITS = ["DAYS", "WEEKS", "MONTHS", "YEARS"] as const;
export type DurationUnitKey = (typeof DURATION_UNITS)[number];

export const DURATION_UNIT_LABELS: Record<DurationUnitKey, string> = {
  DAYS: "Days",
  WEEKS: "Weeks",
  MONTHS: "Months",
  YEARS: "Years",
};

/** Default duration unit that pairs naturally with an interest frequency. */
export const FREQUENCY_TO_UNIT: Record<string, DurationUnitKey> = {
  DAILY: "DAYS",
  WEEKLY: "WEEKS",
  MONTHLY: "MONTHS",
  YEARLY: "YEARS",
};

export const INTEREST_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type InterestPeriodKey = (typeof INTEREST_PERIODS)[number];

export const INTEREST_METHODS = ["SIMPLE", "COMPOUND"] as const;
export type InterestMethodKey = (typeof INTEREST_METHODS)[number];

export const INTEREST_PERIOD_LABELS: Record<InterestPeriodKey, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const INTEREST_METHOD_LABELS: Record<InterestMethodKey, string> = {
  SIMPLE: "Simple",
  COMPOUND: "Compound",
};

export const REPAYMENT_MODES = ["DURATION_BASED", "FIXED_DATE", "OPEN_ENDED"] as const;
export type RepaymentModeKey = (typeof REPAYMENT_MODES)[number];

export const REPAYMENT_MODE_LABELS: Record<RepaymentModeKey, string> = {
  DURATION_BASED: "Duration based",
  FIXED_DATE: "Fixed date",
  OPEN_ENDED: "Open ended",
};

export const REPAYMENT_MODE_DESCRIPTIONS: Record<RepaymentModeKey, string> = {
  DURATION_BASED: "Due date is calculated from the loan duration (tenure).",
  FIXED_DATE: "You manually set the expected payment due date.",
  OPEN_ENDED: "No due date — the loan is never overdue by time.",
};

export const EMI_STATUS = ["PENDING", "PAID", "PARTIAL", "OVERDUE"] as const;
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "CARD"] as const;
export const KYC_STATUS = ["PENDING", "VERIFIED", "REJECTED"] as const;
export const DOCUMENT_TYPES = ["AADHAAR", "PAN", "PHOTO", "BANK_STATEMENT", "SALARY_SLIP", "ADDRESS_PROOF", "OTHER"] as const;
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

/** Tailwind classes for status badges. */
export const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-blue-100 text-blue-700 border-blue-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-indigo-100 text-indigo-700 border-indigo-200",
  VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const DEFAULT_PENALTY_RATE = 24; // %/yr on overdue EMIs

// ─── Cash management ─────────────────────────────────────────────────────────
export const CASH_TRANSACTION_TYPES = [
  "CAPITAL_ADD",
  "COLLECTION_RECEIVED",
  "LOAN_DISBURSEMENT",
  "EXPENSE",
  "CAPITAL_WITHDRAWAL",
] as const;
export type CashTransactionTypeKey = (typeof CASH_TRANSACTION_TYPES)[number];

export const CASH_TYPE_LABELS: Record<CashTransactionTypeKey, string> = {
  CAPITAL_ADD: "Capital added",
  COLLECTION_RECEIVED: "Collection received",
  LOAN_DISBURSEMENT: "Loan disbursed",
  EXPENSE: "Expense",
  CAPITAL_WITHDRAWAL: "Capital withdrawal",
};

/** +1 = cash in, −1 = cash out. */
export const CASH_TYPE_SIGN: Record<CashTransactionTypeKey, 1 | -1> = {
  CAPITAL_ADD: 1,
  COLLECTION_RECEIVED: 1,
  LOAN_DISBURSEMENT: -1,
  EXPENSE: -1,
  CAPITAL_WITHDRAWAL: -1,
};

export const CASH_TYPE_STYLES: Record<CashTransactionTypeKey, string> = {
  CAPITAL_ADD: "bg-emerald-100 text-emerald-700 border-emerald-200",
  COLLECTION_RECEIVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  LOAN_DISBURSEMENT: "bg-blue-100 text-blue-700 border-blue-200",
  EXPENSE: "bg-rose-100 text-rose-700 border-rose-200",
  CAPITAL_WITHDRAWAL: "bg-amber-100 text-amber-700 border-amber-200",
};

/** Transaction types an admin can create manually. */
export const MANUAL_CASH_TYPES = ["CAPITAL_ADD", "CAPITAL_WITHDRAWAL", "EXPENSE"] as const;

// ─── PDF templates ───────────────────────────────────────────────────────────
export const PDF_TEMPLATE_KEYS = ["MODERN", "PROFESSIONAL", "MINIMAL", "CLASSIC"] as const;
export type PdfTemplateKey = (typeof PDF_TEMPLATE_KEYS)[number];

export const PDF_TEMPLATE_LABELS: Record<PdfTemplateKey, string> = {
  MODERN: "Modern Fintech",
  PROFESSIONAL: "Professional Banking",
  MINIMAL: "Minimal Black & White",
  CLASSIC: "Rural Finance Print",
};

export const PDF_TEMPLATE_DESCRIPTIONS: Record<PdfTemplateKey, string> = {
  MODERN: "Dark premium hero with brand-coloured KPI cards — bold, app-like.",
  PROFESSIONAL: "Corporate navy with a formal accent rule — bank-grade and trustworthy.",
  MINIMAL: "Monochrome, typographic and ink-light — clean and print-friendly.",
  CLASSIC: "High-contrast, large type and heavy rules — built for cheap printers.",
};

/** Document types that branding/templates apply to. */
export const PDF_DOC_TYPES = ["agreement", "receipt", "statement", "daily"] as const;
export const PDF_DOC_LABELS: Record<(typeof PDF_DOC_TYPES)[number], string> = {
  agreement: "Loan Agreement",
  receipt: "Collection Receipt",
  statement: "Loan Statement",
  daily: "Daily Report",
};

