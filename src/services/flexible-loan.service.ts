import "server-only";
import { prisma } from "@/lib/prisma";
import type { Loan } from "@prisma/client";
import {
  computeFlexible,
  CALC_TO_ACCRUAL,
  type FlexibleState,
  type AccrualMethod,
  type InterestPeriod,
} from "@/lib/interest-engine";

/** Build the engine terms from a persisted loan row. */
export function flexibleTermsOf(loan: Loan) {
  // Prefer the explicit calculation method; fall back to the legacy simple/compound flag.
  const method: AccrualMethod = loan.calculationMethod
    ? CALC_TO_ACCRUAL[loan.calculationMethod]
    : loan.interestMethod === "COMPOUND"
      ? "COMPOUND"
      : "SIMPLE";

  return {
    principal: loan.principalAmount,
    ratePerPeriod: loan.interestRate,
    period: loan.interestPeriod as InterestPeriod,
    method,
    disbursementDate: loan.disbursementDate ?? loan.createdAt,
  };
}

/**
 * Dynamically compute a flexible loan's current state from its payment history.
 * Returns null for non-flexible / undisbursed loans.
 */
export async function getFlexibleState(
  loanId: string,
  asOf: Date = new Date(),
): Promise<FlexibleState | null> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.loanType !== "FLEXIBLE_LOAN" || !loan.disbursementDate) return null;
  return computeFlexibleForLoan(loan, asOf);
}

export async function computeFlexibleForLoan(
  loan: Loan,
  asOf: Date = new Date(),
): Promise<FlexibleState> {
  const payments = await prisma.payment.findMany({
    where: { loanId: loan.id, deletedAt: { isSet: false } },
    select: { amount: true, paymentDate: true },
    orderBy: { paymentDate: "asc" },
  });

  return computeFlexible(
    flexibleTermsOf(loan),
    payments.map((p) => ({ date: p.paymentDate, amount: p.amount })),
    asOf,
  );
}

/** Persist the recomputed live balances back onto the loan (after a payment). */
export async function syncFlexibleOutstanding(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.loanType !== "FLEXIBLE_LOAN" || !loan.disbursementDate) return;

  const state = await computeFlexibleForLoan(loan);
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      outstandingPrincipal: state.principalOutstanding,
      lastAccrualDate: state.asOf,
      ...(state.totalOutstanding <= 0 ? { status: "CLOSED" } : {}),
    },
  });
  return state;
}
