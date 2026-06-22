import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoanCalculator } from "@/features/loans/loan-calculator";

export const metadata: Metadata = { title: "Loan Calculator" };

export default async function LoanCalculatorPage() {
  await requireAuth();
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/loans">
          <ArrowLeft className="h-4 w-4" /> Back to loans
        </Link>
      </Button>
      <PageHeader
        title="Loan Calculator"
        description="Compare EMI, flat-interest and reducing-balance repayments side by side."
      />
      <LoanCalculator />
    </div>
  );
}
