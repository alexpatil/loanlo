"use server";

import { revalidatePath } from "next/cache";
import { loanSchema, updateLoanStatusSchema, editLoanSchema } from "@/validations/loan.schema";
import { assignSchema } from "@/validations/user.schema";
import {
  createLoan,
  updateLoanStatus,
  editLoan,
  deleteLoan,
  assignLoanAgent,
  refreshOverdueStatuses,
} from "@/services/loan.service";
import { nextLoanNumber } from "@/services/sequence.service";
import { logActivity } from "@/services/activity-log.service";
import {
  requireActionPermission,
  parseInput,
  ok,
  fail,
  runAction,
} from "@/lib/action-utils";

export async function createLoanAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("loan:write");
    const parsed = parseInput(loanSchema, input);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    const loanNumber = await nextLoanNumber();
    const loan = await createLoan({
      loanNumber,
      customerId: data.customerId,
      loanKind: data.loanKind,
      principalAmount: data.principalAmount,
      interestRate: data.interestRate,
      processingFee: data.processingFee ?? 0,
      tenureMonths: data.tenureMonths,
      calculationMethod: data.calculationMethod,
      interestFrequency: data.interestFrequency,
      durationValue: data.durationValue,
      durationUnit: data.durationUnit,
      repaymentMode: data.repaymentMode,
      expectedPaymentDate: data.expectedPaymentDate as Date | undefined,
      gracePeriodDays: data.gracePeriodDays ?? 0,
      purpose: data.purpose,
      assignedAgentId: data.assignedAgentId ?? user.id,
      createdById: user.id,
    });

    await logActivity({
      userId: user.id,
      action: "CREATE",
      entity: "Loan",
      entityId: loan.id,
      description: `Created loan ${loan.loanNumber}`,
    });

    revalidatePath("/loans");
    return ok(loan, "Loan application created.");
  });
}

export async function updateLoanStatusAction(input: unknown) {
  return runAction(async () => {
    const parsed = parseInput(updateLoanStatusSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, status, disbursementDate } = parsed.data;

    // Approvals/rejections/disbursement require ADMIN+.
    const elevated = ["APPROVED", "REJECTED", "ACTIVE"].includes(status);
    const user = await requireActionPermission(elevated ? "loan:approve" : "loan:write");

    const loan = await updateLoanStatus({
      id,
      status,
      approvedById: user.id,
      disbursementDate: disbursementDate as Date | undefined,
    });

    await logActivity({
      userId: user.id,
      action: "STATUS_CHANGE",
      entity: "Loan",
      entityId: id,
      description: `Loan ${loan.loanNumber} → ${status}`,
    });

    revalidatePath("/loans");
    revalidatePath(`/loans/${id}`);
    revalidatePath("/dashboard");
    return ok(loan, `Loan marked ${status.toLowerCase()}.`);
  });
}

export async function editLoanAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("loan:edit");
    const parsed = parseInput(editLoanSchema, input);
    if (!parsed.ok) return parsed.result;

    const loan = await editLoan(parsed.data);

    await logActivity({
      userId: user.id,
      action: "EDIT",
      entity: "Loan",
      entityId: loan.id,
      description: `Edited loan ${loan.loanNumber}${parsed.data.editReason ? ` — ${parsed.data.editReason}` : ""}`,
    });

    revalidatePath("/loans");
    revalidatePath(`/loans/${loan.id}`);
    revalidatePath("/dashboard");
    return ok({ id: loan.id }, "Loan updated.");
  });
}

export async function deleteLoanAction(id: string) {
  return runAction(async () => {
    const user = await requireActionPermission("loan:delete");
    if (!id) return fail("Loan id is required.");
    await deleteLoan(id);
    await logActivity({
      userId: user.id,
      action: "DELETE",
      entity: "Loan",
      entityId: id,
      description: `Deleted loan ${id}`,
    });
    revalidatePath("/loans");
    return ok(null, "Loan deleted.");
  });
}

export async function assignLoanAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("user:assign");
    const parsed = parseInput(assignSchema, input);
    if (!parsed.ok) return parsed.result;
    await assignLoanAgent(parsed.data.entityId, parsed.data.agentId);
    await logActivity({
      userId: user.id,
      action: "ASSIGN",
      entity: "Loan",
      entityId: parsed.data.entityId,
      description: `Assigned loan to agent ${parsed.data.agentId}`,
    });
    revalidatePath("/loans");
    return ok(null, "Loan reassigned.");
  });
}

export async function refreshOverdueAction() {
  return runAction(async () => {
    const user = await requireActionPermission("loan:approve");
    const result = await refreshOverdueStatuses();
    await logActivity({
      userId: user.id,
      action: "REFRESH_OVERDUE",
      entity: "Loan",
      description: `Marked ${result.overdueEmis} EMIs / ${result.overdueLoans} loans overdue`,
    });
    revalidatePath("/dashboard");
    revalidatePath("/collections");
    return ok(result, "Overdue statuses refreshed.");
  });
}
