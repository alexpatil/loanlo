import { round2 } from "./utils";

/**
 * Reusable interest calculation engine.
 *
 * Supports DAILY / WEEKLY / MONTHLY / YEARLY accrual periods with SIMPLE or
 * COMPOUND interest. Used by FLEXIBLE_LOAN to derive outstanding balances and
 * statements dynamically from elapsed time and payment history.
 */

export type InterestPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type InterestMethod = "SIMPLE" | "COMPOUND";
/** How interest accrues on a non-EMI loan. */
export type AccrualMethod = "FLAT" | "SIMPLE" | "COMPOUND";
export type DurationUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";

/** Average days per period — used to convert elapsed time into period counts. */
export const DAYS_PER_PERIOD: Record<InterestPeriod, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365,
};

export const DAYS_PER_UNIT: Record<DurationUnit, number> = {
  DAYS: 1,
  WEEKS: 7,
  MONTHS: 30,
  YEARS: 365,
};

/** Maps the UI "calculation method" to the engine accrual method. */
export const CALC_TO_ACCRUAL: Record<"FLAT" | "REDUCING" | "COMPOUND", AccrualMethod> = {
  FLAT: "FLAT",
  REDUCING: "SIMPLE",
  COMPOUND: "COMPOUND",
};

export function durationToDays(value: number, unit: DurationUnit): number {
  return value * DAYS_PER_UNIT[unit];
}

/** Number of interest periods spanned by a duration, given the frequency. */
export function periodsForDuration(
  value: number,
  unit: DurationUnit,
  frequency: InterestPeriod,
): number {
  return durationToDays(value, unit) / DAYS_PER_PERIOD[frequency];
}

export const PERIODS_PER_YEAR: Record<InterestPeriod, number> = {
  DAILY: 365,
  WEEKLY: 52,
  MONTHLY: 12,
  YEARLY: 1,
};

const MS_PER_DAY = 86_400_000;

/** Number of (possibly fractional) periods elapsed between two instants. */
export function periodsBetween(period: InterestPeriod, from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  if (days <= 0) return 0;
  return days / DAYS_PER_PERIOD[period];
}

/**
 * Interest accrued on `base` at `ratePct` per period over `periods` periods.
 * - SIMPLE:   base · r · n
 * - COMPOUND: base · ((1+r)^n − 1)
 */
export function accrue(
  base: number,
  ratePct: number,
  method: InterestMethod,
  periods: number,
): number {
  if (periods <= 0 || base <= 0) return 0;
  const r = ratePct / 100;
  const interest =
    method === "SIMPLE" ? base * r * periods : base * (Math.pow(1 + r, periods) - 1);
  return round2(interest);
}

/** Convert a per-period rate to an effective annual rate (for display). */
export function effectiveAnnualRate(
  ratePct: number,
  period: InterestPeriod,
  method: InterestMethod,
): number {
  const r = ratePct / 100;
  const n = PERIODS_PER_YEAR[period];
  const annual = method === "SIMPLE" ? r * n : Math.pow(1 + r, n) - 1;
  return round2(annual * 100);
}

// ─── Flexible loan dynamic computation ───────────────────────────────────────

export interface FlexibleTerms {
  principal: number;
  ratePerPeriod: number; // % per period
  period: InterestPeriod;
  method: AccrualMethod; // FLAT | SIMPLE (reducing) | COMPOUND
  disbursementDate: Date;
}

export interface FlexiblePayment {
  date: Date;
  amount: number;
}

export interface StatementLine {
  date: Date;
  type: "DISBURSEMENT" | "INTEREST" | "PAYMENT";
  description: string;
  interest: number;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  principalBalance: number;
  interestBalance: number;
  balance: number; // total outstanding after this line
}

export interface FlexibleState {
  asOf: Date;
  principalOutstanding: number;
  interestOutstanding: number;
  totalOutstanding: number;
  totalInterestAccrued: number;
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
  statement: StatementLine[];
}

/**
 * Replay disbursement → interest accruals → payments to derive the live state.
 * Interest accrues segment-by-segment between events; payments are applied
 * interest-first, then principal. Works for any period/method combination.
 */
export function computeFlexible(
  terms: FlexibleTerms,
  payments: FlexiblePayment[],
  asOf: Date = new Date(),
): FlexibleState {
  const originalPrincipal = round2(terms.principal);
  let principal = round2(terms.principal);
  let interest = 0;
  let lastDate = terms.disbursementDate;

  let totalInterestAccrued = 0;
  let totalPaid = 0;
  let principalPaid = 0;
  let interestPaid = 0;

  const statement: StatementLine[] = [
    {
      date: terms.disbursementDate,
      type: "DISBURSEMENT",
      description: "Loan disbursed",
      interest: 0,
      payment: 0,
      principalPaid: 0,
      interestPaid: 0,
      principalBalance: principal,
      interestBalance: 0,
      balance: principal,
    },
  ];

  const accrueTo = (date: Date) => {
    const periods = periodsBetween(terms.period, lastDate, date);
    if (periods > 0 && principal > 0) {
      // FLAT: on the original principal (never reduces).
      // SIMPLE (reducing): on the outstanding principal.
      // COMPOUND: on principal + accrued interest.
      const r = terms.ratePerPeriod / 100;
      let charged: number;
      if (terms.method === "COMPOUND") {
        charged = round2((principal + interest) * (Math.pow(1 + r, periods) - 1));
      } else {
        const base = terms.method === "FLAT" ? originalPrincipal : principal;
        charged = round2(base * r * periods);
      }
      if (charged > 0) {
        interest = round2(interest + charged);
        totalInterestAccrued = round2(totalInterestAccrued + charged);
        statement.push({
          date,
          type: "INTEREST",
          description: `Interest accrued (${periods.toFixed(2)} ${terms.period.toLowerCase()} periods)`,
          interest: charged,
          payment: 0,
          principalPaid: 0,
          interestPaid: 0,
          principalBalance: principal,
          interestBalance: interest,
          balance: round2(principal + interest),
        });
      }
    }
    lastDate = new Date(Math.max(lastDate.getTime(), date.getTime()));
  };

  const sorted = [...payments].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const p of sorted) {
    if (p.date > terms.disbursementDate) accrueTo(p.date);

    let amount = round2(p.amount);
    const intPay = round2(Math.min(amount, interest));
    interest = round2(interest - intPay);
    amount = round2(amount - intPay);
    const prinPay = round2(Math.min(amount, principal));
    principal = round2(principal - prinPay);

    interestPaid = round2(interestPaid + intPay);
    principalPaid = round2(principalPaid + prinPay);
    totalPaid = round2(totalPaid + p.amount);

    statement.push({
      date: p.date,
      type: "PAYMENT",
      description: "Payment received",
      interest: 0,
      payment: round2(p.amount),
      principalPaid: prinPay,
      interestPaid: intPay,
      principalBalance: principal,
      interestBalance: interest,
      balance: round2(principal + interest),
    });
  }

  accrueTo(asOf);

  return {
    asOf,
    principalOutstanding: principal,
    interestOutstanding: interest,
    totalOutstanding: round2(principal + interest),
    totalInterestAccrued,
    totalPaid,
    principalPaid,
    interestPaid,
    statement,
  };
}

/** Interest over a fixed number of periods with no prepayments. */
function projectInterest(
  principal: number,
  ratePct: number,
  method: AccrualMethod,
  periods: number,
): number {
  if (periods <= 0 || principal <= 0) return 0;
  const r = ratePct / 100;
  // FLAT and SIMPLE (reducing) coincide when there are no prepayments.
  const interest =
    method === "COMPOUND" ? principal * (Math.pow(1 + r, periods) - 1) : principal * r * periods;
  return round2(interest);
}

/** Projected interest at maturity for a flexible loan assuming no prepayments. */
export function projectFlexibleAtMaturity(terms: FlexibleTerms, tenureMonths: number) {
  const maturity = new Date(terms.disbursementDate);
  maturity.setMonth(maturity.getMonth() + tenureMonths);
  const periods = periodsBetween(terms.period, terms.disbursementDate, maturity);
  const interest = projectInterest(terms.principal, terms.ratePerPeriod, terms.method, periods);
  return {
    periods: round2(periods),
    totalInterest: interest,
    totalPayable: round2(terms.principal + interest),
  };
}

export interface NonEmiProjection {
  periods: number;
  totalInterest: number;
  totalPayable: number;
  durationDays: number;
}

/**
 * Project a non-EMI loan from its calculation method, interest frequency and
 * duration (value + unit). The rate is expressed per the chosen frequency.
 */
export function projectNonEmi(params: {
  principal: number;
  ratePerPeriod: number;
  calc: "FLAT" | "REDUCING" | "COMPOUND";
  frequency: InterestPeriod;
  durationValue: number;
  durationUnit: DurationUnit;
}): NonEmiProjection {
  const periods = periodsForDuration(params.durationValue, params.durationUnit, params.frequency);
  const interest = projectInterest(
    params.principal,
    params.ratePerPeriod,
    CALC_TO_ACCRUAL[params.calc],
    periods,
  );
  return {
    periods: round2(periods),
    totalInterest: interest,
    totalPayable: round2(params.principal + interest),
    durationDays: durationToDays(params.durationValue, params.durationUnit),
  };
}
