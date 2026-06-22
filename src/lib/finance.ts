import { addDays, addMonths } from "date-fns";
import { round2 } from "./utils";

export type LoanMethod = "EMI" | "FLAT_INTEREST" | "REDUCING_BALANCE";

export interface LoanTerms {
  principal: number;
  annualInterestRate: number; // e.g. 18 for 18%
  tenureMonths: number;
  processingFee?: number;
}

export interface LoanComputation {
  emiAmount: number;
  totalPayable: number;
  totalInterest: number;
  processingFee: number;
  netDisbursed: number;
}

export interface EmiInstallment {
  installmentNumber: number;
  dueDate: Date;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
}

const monthlyRateOf = (annualInterestRate: number) => annualInterestRate / 12 / 100;

/**
 * Reducing-balance EMI (also used as the starting point for REDUCING_BALANCE):
 *   EMI = P · r · (1+r)^n / ((1+r)^n − 1)
 */
export function calculateEmi(terms: LoanTerms): LoanComputation {
  const { principal, annualInterestRate, tenureMonths } = terms;
  const processingFee = terms.processingFee ?? 0;
  const monthlyRate = monthlyRateOf(annualInterestRate);

  let emiAmount: number;
  if (monthlyRate === 0) {
    emiAmount = principal / tenureMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    emiAmount = (principal * monthlyRate * factor) / (factor - 1);
  }

  emiAmount = round2(emiAmount);
  const totalPayable = round2(emiAmount * tenureMonths);
  const totalInterest = round2(totalPayable - principal);

  return {
    emiAmount,
    totalPayable,
    totalInterest,
    processingFee: round2(processingFee),
    netDisbursed: round2(principal - processingFee),
  };
}

/**
 * Flat-interest: interest is charged on the original principal for the whole
 * tenure and never reduces, regardless of (partial) prepayments.
 *   Interest = P · r · n
 */
export function calculateFlat(terms: LoanTerms): LoanComputation {
  const { principal, annualInterestRate, tenureMonths } = terms;
  const processingFee = terms.processingFee ?? 0;
  const monthlyRate = monthlyRateOf(annualInterestRate);

  const totalInterest = round2(principal * monthlyRate * tenureMonths);
  const totalPayable = round2(principal + totalInterest);
  const emiAmount = round2(totalPayable / tenureMonths);

  return {
    emiAmount,
    totalPayable,
    totalInterest,
    processingFee: round2(processingFee),
    netDisbursed: round2(principal - processingFee),
  };
}

/** Method-aware summary used by forms, the calculator and loan creation. */
export function calculateLoan(terms: LoanTerms, method: LoanMethod): LoanComputation {
  return method === "FLAT_INTEREST" ? calculateFlat(terms) : calculateEmi(terms);
}

/**
 * Reducing-balance amortization. The final installment absorbs any rounding
 * remainder so the outstanding balance closes exactly at zero.
 */
export function generateAmortizationSchedule(
  terms: LoanTerms,
  startDate: Date,
): EmiInstallment[] {
  const { principal, annualInterestRate, tenureMonths } = terms;
  const monthlyRate = monthlyRateOf(annualInterestRate);
  const { emiAmount } = calculateEmi(terms);

  const schedule: EmiInstallment[] = [];
  let balance = principal;

  for (let i = 1; i <= tenureMonths; i++) {
    const interestComponent = round2(balance * monthlyRate);
    let principalComponent = round2(emiAmount - interestComponent);
    let installmentEmi = emiAmount;

    if (i === tenureMonths) {
      principalComponent = round2(balance);
      installmentEmi = round2(principalComponent + interestComponent);
    }

    balance = round2(balance - principalComponent);
    if (balance < 0) balance = 0;

    schedule.push({
      installmentNumber: i,
      dueDate: addMonths(startDate, i),
      emiAmount: installmentEmi,
      principalComponent,
      interestComponent,
      remainingBalance: balance,
    });
  }

  return schedule;
}

/**
 * Flat-interest schedule: equal principal and equal interest every month.
 */
export function generateFlatSchedule(
  terms: LoanTerms,
  startDate: Date,
): EmiInstallment[] {
  const { principal, annualInterestRate, tenureMonths } = terms;
  const monthlyRate = monthlyRateOf(annualInterestRate);

  const interestPerMonth = round2(principal * monthlyRate);
  const principalPerMonth = round2(principal / tenureMonths);

  const schedule: EmiInstallment[] = [];
  let balance = principal;

  for (let i = 1; i <= tenureMonths; i++) {
    let principalComponent = principalPerMonth;
    if (i === tenureMonths) principalComponent = round2(balance);

    balance = round2(balance - principalComponent);
    if (balance < 0) balance = 0;

    schedule.push({
      installmentNumber: i,
      dueDate: addMonths(startDate, i),
      emiAmount: round2(principalComponent + interestPerMonth),
      principalComponent,
      interestComponent: interestPerMonth,
      remainingBalance: balance,
    });
  }

  return schedule;
}

/** Method-aware schedule generation. */
export function generateSchedule(
  terms: LoanTerms,
  method: LoanMethod,
  startDate: Date,
): EmiInstallment[] {
  return method === "FLAT_INTEREST"
    ? generateFlatSchedule(terms, startDate)
    : generateAmortizationSchedule(terms, startDate);
}

/**
 * Recompute the remaining (unpaid) installments of a REDUCING_BALANCE loan
 * after the outstanding principal changes. Keeps the existing due dates and
 * installment count; future interest shrinks with the lower balance.
 */
export interface RecalcInput {
  installmentNumber: number;
  dueDate: Date;
}
export function recalcReducingInstallments(
  outstandingPrincipal: number,
  annualInterestRate: number,
  remaining: RecalcInput[],
): EmiInstallment[] {
  const n = remaining.length;
  if (n === 0) return [];

  const monthlyRate = monthlyRateOf(annualInterestRate);
  const { emiAmount } = calculateEmi({
    principal: outstandingPrincipal,
    annualInterestRate,
    tenureMonths: n,
  });

  let balance = round2(outstandingPrincipal);
  return remaining.map((inst, idx) => {
    const interestComponent = round2(balance * monthlyRate);
    let principalComponent = round2(emiAmount - interestComponent);
    let installmentEmi = emiAmount;

    if (idx === n - 1) {
      principalComponent = round2(balance);
      installmentEmi = round2(principalComponent + interestComponent);
    }

    balance = round2(balance - principalComponent);
    if (balance < 0) balance = 0;

    return {
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate,
      emiAmount: installmentEmi,
      principalComponent,
      interestComponent,
      remainingBalance: balance,
    };
  });
}

/**
 * Daily-rate penalty on an overdue EMI, applied only after the grace period.
 * @param gracePeriodDays days after the due date before penalties start
 * @param penaltyRatePct annual penalty rate percentage (default 24%/yr)
 */
export function calculatePenalty(
  emiAmount: number,
  dueDate: Date,
  asOf: Date = new Date(),
  gracePeriodDays = 0,
  penaltyRatePct = 24,
): number {
  const graceEnd = addDays(new Date(dueDate), gracePeriodDays);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLate = Math.floor((asOf.getTime() - graceEnd.getTime()) / msPerDay);
  if (daysLate <= 0) return 0;
  const dailyRate = penaltyRatePct / 365 / 100;
  return round2(emiAmount * dailyRate * daysLate);
}

/** True once an installment is past its due date + grace period. */
export function isPastGrace(dueDate: Date, gracePeriodDays: number, asOf: Date = new Date()) {
  return asOf.getTime() > addDays(new Date(dueDate), gracePeriodDays).getTime();
}

export function calculateMaturityDate(startDate: Date, tenureMonths: number) {
  return addMonths(startDate, tenureMonths);
}
