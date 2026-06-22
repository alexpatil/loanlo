import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, AlertTriangle, CheckCircle2, IndianRupee } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { can } from "@/lib/rbac";
import { listEmiSchedules, getEmiStats } from "@/services/emi.service";
import { EMI_STATUS } from "@/lib/constants";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { CollectPaymentDialog } from "@/features/loans/collect-payment-dialog";

export const metadata: Metadata = { title: "EMI Schedule" };

export default async function EmiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);
  const sp = await searchParams;

  const [data, stats] = await Promise.all([
    listEmiSchedules({
      status: sp.status,
      page: Number(sp.page) || 1,
      scopeAgentId: scope,
      onlyDue: !sp.status,
    }),
    getEmiStats(scope),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="EMI Schedule"
        description="Track installments, dues and overdue collections."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Pending EMIs" value={formatNumber(stats.pending)} icon={CalendarClock} accent="amber" />
        <StatCard title="Overdue EMIs" value={formatNumber(stats.overdue)} icon={AlertTriangle} accent="rose" />
        <StatCard title="Paid EMIs" value={formatNumber(stats.paid)} icon={CheckCircle2} accent="emerald" />
        <StatCard title="Outstanding Due" value={formatCurrency(stats.outstandingDue)} icon={IndianRupee} accent="violet" />
      </div>

      <Card className="p-4">
        <div className="mb-4">
          <FilterSelect
            paramKey="status"
            placeholder="Due & overdue"
            options={EMI_STATUS.map((s) => ({ label: s.toLowerCase(), value: s }))}
          />
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing due"
            description="There are no EMIs matching this filter."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>EMI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((emi) => {
                  const c = emi.loan.customer;
                  return (
                    <TableRow key={emi.id}>
                      <TableCell className="text-sm">
                        {c.firstName} {c.lastName}
                        <span className="block text-xs text-muted-foreground">{c.phone}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/loans/${emi.loan.id}`} className="hover:text-violet-600">
                          {emi.loan.loanNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">#{emi.installmentNumber}</TableCell>
                      <TableCell className="text-sm">{formatDate(emi.dueDate)}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatCurrency(emi.emiAmount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emi.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {emi.status !== "PAID" && can(role, "payment:write") ? (
                          <CollectPaymentDialog
                            loanId={emi.loan.id}
                            emiScheduleId={emi.id}
                            suggestedAmount={Math.max(
                              0,
                              emi.emiAmount + emi.penaltyAmount - emi.paidAmount,
                            )}
                            trigger={
                              <Button variant="outline" size="sm">
                                Collect
                              </Button>
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} />
          </>
        )}
      </Card>
    </div>
  );
}
