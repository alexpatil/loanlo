import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Plus, Calculator, Upload } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { isAdminLike } from "@/lib/rbac";
import { listLoans } from "@/services/loan.service";
import { LOAN_STATUS, LOAN_TYPES, LOAN_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";

export const metadata: Metadata = { title: "Loans" };

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    loanType?: string;
    migrated?: string;
    page?: string;
  }>;
}) {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);
  const sp = await searchParams;

  const data = await listLoans({
    search: sp.search,
    status: sp.status,
    loanType: sp.loanType,
    isMigrated: sp.migrated === "yes" ? true : sp.migrated === "no" ? false : undefined,
    page: Number(sp.page) || 1,
    scopeAgentId: scope,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loans"
        description="Originate, approve and disburse loans."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/loans/calculator">
                <Calculator className="h-4 w-4" /> Calculator
              </Link>
            </Button>
            {isAdminLike(role) && (
              <Button asChild variant="outline">
                <Link href="/loans/migrate">
                  <Upload className="h-4 w-4" /> Migrate
                </Link>
              </Button>
            )}
            <Button asChild variant="gradient">
              <Link href="/loans/new">
                <Plus className="h-4 w-4" /> New loan
              </Link>
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput placeholder="Search by loan number or customer…" />
          <FilterSelect
            paramKey="status"
            placeholder="All statuses"
            options={LOAN_STATUS.map((s) => ({ label: s.toLowerCase(), value: s }))}
          />
          <FilterSelect
            paramKey="loanType"
            placeholder="All types"
            options={LOAN_TYPES.map((t) => ({ label: LOAN_TYPE_LABELS[t], value: t }))}
          />
          <FilterSelect
            paramKey="migrated"
            placeholder="All sources"
            options={[
              { label: "Migrated only", value: "yes" },
              { label: "Originated only", value: "no" },
            ]}
          />
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No loans found"
            description="Create a loan application to get started."
            action={
              <Button asChild variant="gradient">
                <Link href="/loans/new">New loan</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>EMI</TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>Disbursed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((loan) => (
                  <TableRow key={loan.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/loans/${loan.id}`} className="font-medium hover:text-violet-600">
                        {loan.loanNumber}
                      </Link>
                      {loan.isMigrated && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Migrated</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {loan.customer.firstName} {loan.customer.lastName}
                      <span className="block text-xs text-muted-foreground">
                        {loan.customer.customerCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {loan.loanType.replace(/_/g, " ").toLowerCase()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(loan.principalAmount)}
                    </TableCell>
                    <TableCell className="text-sm">{formatCurrency(loan.emiAmount)}</TableCell>
                    <TableCell className="text-sm">{loan.tenureMonths} mo</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(loan.disbursementDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={loan.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} />
          </>
        )}
      </Card>
    </div>
  );
}
