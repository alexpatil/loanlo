import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, CashTransactionType } from "@prisma/client";
import { round2 } from "@/lib/utils";
import {
  CASH_TRANSACTION_TYPES,
  CASH_TYPE_SIGN,
  type CashTransactionTypeKey,
} from "@/lib/constants";

type DbClient = Prisma.TransactionClient | typeof prisma;

interface RecordCashInput {
  type: CashTransactionType;
  amount: number;
  note?: string;
  loanId?: string;
  paymentId?: string;
  transactionDate?: Date;
  createdById?: string;
}

/**
 * Single entry point for every money movement. Pass a transaction client to
 * record the cash entry atomically alongside the source mutation (disbursement
 * or collection).
 */
export async function recordCashTransaction(input: RecordCashInput, client: DbClient = prisma) {
  return client.cashTransaction.create({
    data: {
      type: input.type,
      amount: round2(Math.abs(input.amount)),
      note: input.note,
      loanId: input.loanId,
      paymentId: input.paymentId,
      transactionDate: input.transactionDate ?? new Date(),
      createdById: input.createdById,
    },
  });
}

export interface CashSummary {
  cashAvailable: number;
  capitalAdded: number;
  collectionsReceived: number;
  loansDisbursed: number;
  expenses: number;
  capitalWithdrawals: number;
  outstandingAmount: number;
}

/**
 * Cash Available =
 *   Capital Added + Collections Received
 *   − Loans Disbursed − Expenses − Capital Withdrawals
 */
export async function getCashSummary(): Promise<CashSummary> {
  const [grouped, outstandingAgg] = await Promise.all([
    prisma.cashTransaction.groupBy({
      by: ["type"],
      where: { deletedAt: { isSet: false } },
      _sum: { amount: true },
    }),
    // Outstanding = money customers still owe (a portfolio asset, NOT cash).
    // Migrated loans are included here; they never affect Cash Available (which
    // is derived purely from cash transactions), only this informational figure.
    prisma.loan.aggregate({
      where: { deletedAt: { isSet: false }, status: { in: ["ACTIVE", "OVERDUE"] } },
      _sum: { outstandingPrincipal: true },
    }),
  ]);

  const sums = Object.fromEntries(
    CASH_TRANSACTION_TYPES.map((t) => [t, 0]),
  ) as Record<CashTransactionTypeKey, number>;
  for (const g of grouped) sums[g.type as CashTransactionTypeKey] = g._sum.amount ?? 0;

  const cashAvailable = round2(
    sums.CAPITAL_ADD +
      sums.COLLECTION_RECEIVED -
      sums.LOAN_DISBURSEMENT -
      sums.EXPENSE -
      sums.CAPITAL_WITHDRAWAL,
  );

  return {
    cashAvailable,
    capitalAdded: sums.CAPITAL_ADD,
    collectionsReceived: sums.COLLECTION_RECEIVED,
    loansDisbursed: sums.LOAN_DISBURSEMENT,
    expenses: sums.EXPENSE,
    capitalWithdrawals: sums.CAPITAL_WITHDRAWAL,
    outstandingAmount: outstandingAgg._sum.outstandingPrincipal ?? 0,
  };
}

interface ListCashParams {
  type?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

function cashWhere(params: ListCashParams): Prisma.CashTransactionWhereInput {
  return {
    deletedAt: { isSet: false },
    ...(params.type ? { type: params.type as CashTransactionType } : {}),
    ...(params.from || params.to
      ? {
          transactionDate: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };
}

export async function listCashTransactions(params: ListCashParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? 20);
  const where = cashWhere(params);

  const [items, total, grouped] = await Promise.all([
    prisma.cashTransaction.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cashTransaction.count({ where }),
    prisma.cashTransaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);

  let inflow = 0;
  let outflow = 0;
  for (const g of grouped) {
    const amt = g._sum.amount ?? 0;
    if (CASH_TYPE_SIGN[g.type as CashTransactionTypeKey] === 1) inflow += amt;
    else outflow += amt;
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    inflow: round2(inflow),
    outflow: round2(outflow),
    net: round2(inflow - outflow),
  };
}

/** All transactions in a range (ascending) — used to build PDF cash books. */
export async function getCashBookEntries(from?: Date, to?: Date) {
  return prisma.cashTransaction.findMany({
    where: cashWhere({ from, to }),
    include: { createdBy: { select: { name: true } } },
    orderBy: { transactionDate: "asc" },
  });
}

/** Net cash movement strictly before a date (opening balance for a period). */
export async function getOpeningBalance(before: Date): Promise<number> {
  const grouped = await prisma.cashTransaction.groupBy({
    by: ["type"],
    where: { deletedAt: { isSet: false }, transactionDate: { lt: before } },
    _sum: { amount: true },
  });
  let balance = 0;
  for (const g of grouped) {
    balance += (g._sum.amount ?? 0) * CASH_TYPE_SIGN[g.type as CashTransactionTypeKey];
  }
  return round2(balance);
}
