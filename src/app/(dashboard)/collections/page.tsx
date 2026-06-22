import type { Metadata } from "next";
import { startOfDay, startOfMonth } from "date-fns";
import { Wallet, CalendarDays, TrendingUp, AlertTriangle } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { listPayments, getUpcomingEmis } from "@/services/payment.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RefreshOverdueButton } from "@/features/collections/refresh-overdue-button";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  const [todayColl, monthColl, recent, overdue] = await Promise.all([
    listPayments({ from: today, collectedById: scope, pageSize: 1 }),
    listPayments({ from: monthStart, collectedById: scope, pageSize: 1 }),
    listPayments({ pageSize: 12, collectedById: scope }),
    getUpcomingEmis(scope, 8),
  ]);

  const overdueOnly = overdue.filter((e) => e.status === "OVERDUE");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Collections"
        description="Daily and monthly collection performance."
        actions={role !== "AGENT" ? <RefreshOverdueButton /> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Today's Collection" value={formatCurrency(todayColl.totalAmount)} icon={CalendarDays} accent="violet" hint={`${todayColl.total} payments`} />
        <StatCard title="This Month" value={formatCurrency(monthColl.totalAmount)} icon={TrendingUp} accent="emerald" hint={`${monthColl.total} payments`} />
        <StatCard title="Recent Payments" value={recent.total} icon={Wallet} accent="blue" />
        <StatCard title="Overdue Customers" value={overdueOnly.length} icon={AlertTriangle} accent="rose" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent collections</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.items.length === 0 ? (
              <EmptyState icon={Wallet} title="No collections yet" description="Recorded payments will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {p.customer.firstName} {p.customer.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.loan.loanNumber}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {p.paymentMethod.toLowerCase().replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue customers</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueOnly.length === 0 ? (
              <EmptyState icon={Wallet} title="No overdue" description="Everyone is on track." />
            ) : (
              <ul className="divide-y divide-border/60">
                {overdueOnly.map((emi) => (
                  <li key={emi.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {emi.loan.customer.firstName} {emi.loan.customer.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(emi.dueDate)} · {emi.loan.customer.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(emi.emiAmount)}</p>
                      <StatusBadge status="OVERDUE" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
