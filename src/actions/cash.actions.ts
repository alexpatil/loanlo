"use server";

import { revalidatePath } from "next/cache";
import { cashEntrySchema } from "@/validations/cash.schema";
import { recordCashTransaction } from "@/services/cash.service";
import { logActivity } from "@/services/activity-log.service";
import { CASH_TYPE_LABELS, type CashTransactionTypeKey } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  requireActionPermission,
  parseInput,
  ok,
  runAction,
} from "@/lib/action-utils";

/**
 * Manually record capital added, a capital withdrawal, or an expense.
 * Loan disbursements and collections are recorded automatically elsewhere.
 */
export async function createCashEntryAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("cash:manage");
    const parsed = parseInput(cashEntrySchema, input);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    const entry = await recordCashTransaction({
      type: data.type,
      amount: data.amount,
      note: data.note,
      transactionDate: data.transactionDate as Date,
      createdById: user.id,
    });

    await logActivity({
      userId: user.id,
      action: data.type,
      entity: "Cash",
      entityId: entry.id,
      description: `${CASH_TYPE_LABELS[data.type as CashTransactionTypeKey]}: ${formatCurrency(data.amount)}`,
    });

    revalidatePath("/cash");
    revalidatePath("/dashboard");
    return ok({ id: entry.id }, "Cash entry recorded.");
  });
}
