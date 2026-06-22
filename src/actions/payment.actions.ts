"use server";

import { revalidatePath } from "next/cache";
import { paymentSchema } from "@/validations/payment.schema";
import { recordPayment } from "@/services/payment.service";
import { logActivity } from "@/services/activity-log.service";
import { formatCurrency } from "@/lib/utils";
import {
  requireActionPermission,
  parseInput,
  ok,
  runAction,
} from "@/lib/action-utils";

export async function recordPaymentAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("payment:write");
    const parsed = parseInput(paymentSchema, input);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    const payment = await recordPayment({
      loanId: data.loanId,
      emiScheduleId: data.emiScheduleId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate as Date,
      reference: data.reference,
      notes: data.notes,
      collectedById: user.id,
    });

    await logActivity({
      userId: user.id,
      action: "COLLECT",
      entity: "Payment",
      entityId: payment.id,
      description: `Collected ${formatCurrency(payment.amount)} on loan ${data.loanId}`,
    });

    revalidatePath(`/loans/${data.loanId}`);
    revalidatePath("/collections");
    revalidatePath("/emi");
    revalidatePath("/dashboard");
    return ok(payment, "Payment recorded.");
  });
}
