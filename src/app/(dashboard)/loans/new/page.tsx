import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { getCustomerOptions } from "@/services/customer.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoanForm } from "@/features/loans/loan-form";

export const metadata: Metadata = { title: "New loan" };

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await requireAuth();
  const scope = agentScope(user.role as Role, user.id);
  const sp = await searchParams;
  const customers = await getCustomerOptions(scope);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/loans">
          <ArrowLeft className="h-4 w-4" /> Back to loans
        </Link>
      </Button>
      <PageHeader
        title="New loan application"
        description="Originate a loan and auto-calculate the EMI schedule."
      />
      <LoanForm customers={customers} defaultCustomerId={sp.customerId} />
    </div>
  );
}
