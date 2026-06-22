import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { getCustomerOptions } from "@/services/customer.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { MigrationForm } from "@/features/migration/migration-form";

export const metadata: Metadata = { title: "Migrate loan" };

export default async function MigrateLoanPage() {
  // Importing historical loans is an admin-level operation.
  const user = await requireRole("ADMIN");
  const scope = agentScope(user.role as Role, user.id);
  const customers = await getCustomerOptions(scope);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/loans">
          <ArrowLeft className="h-4 w-4" /> Back to loans
        </Link>
      </Button>
      <PageHeader
        title="Migrate loan"
        description="Import an existing loan from a physical register with its historical data."
      />
      <MigrationForm customers={customers} />
    </div>
  );
}
