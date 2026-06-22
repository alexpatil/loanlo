import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { getLoanById } from "@/services/loan.service";
import { getAgentOptions } from "@/services/user.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EditLoanForm, type EditLoanDefaults } from "@/features/loans/edit-loan-form";

export const metadata: Metadata = { title: "Edit loan" };

const toDateInput = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : undefined;

export default async function EditLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Only ADMIN / SUPER_ADMIN may correct loans (no agent scope).
  await requirePermission("loan:edit");
  const { id } = await params;

  const [loan, agents] = await Promise.all([getLoanById(id), getAgentOptions()]);
  if (!loan) notFound();

  const hasPayments = loan.payments.length > 0;

  const defaults: EditLoanDefaults = {
    id: loan.id,
    loanType: loan.loanType,
    interestPeriod: loan.interestPeriod,
    interestMethod: loan.interestMethod,
    repaymentMode: loan.repaymentMode,
    expectedPaymentDate: toDateInput(loan.expectedPaymentDate),
    gracePeriodDays: loan.gracePeriodDays,
    principalAmount: loan.principalAmount,
    interestRate: loan.interestRate,
    processingFee: loan.processingFee,
    tenureMonths: loan.tenureMonths,
    disbursementDate: toDateInput(loan.disbursementDate),
    purpose: loan.purpose ?? undefined,
    assignedAgentId: loan.assignedAgent?.id ?? undefined,
  };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={`/loans/${loan.id}`}>
          <ArrowLeft className="h-4 w-4" /> Back to loan
        </Link>
      </Button>
      <PageHeader
        title={`Edit ${loan.loanNumber}`}
        description={`${loan.customer.firstName} ${loan.customer.lastName} · correct loan details`}
      />
      <EditLoanForm defaults={defaults} agents={agents} hasPayments={hasPayments} />
    </div>
  );
}
