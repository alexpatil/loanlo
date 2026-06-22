import type { Metadata } from "next";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Users,
  Wallet,
  AlertTriangle,
  TrendingUp,
  PiggyBank,
  Import,
  Coins,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import {
  getDashboardStats,
  getCollectionTrend,
  getLoanStatusBreakdown,
  getLoanTypeBreakdown,
} from "@/services/dashboard.service";
import { LOAN_TYPE_LABELS, type LoanTypeKey } from "@/lib/constants";
import { getUpcomingEmis } from "@/services/payment.service";
import { getRepaymentOverview } from "@/services/repayment.service";
import { getMigrationStats } from "@/services/migration.service";
import { getCashSummary } from "@/services/cash.service";
import { isAdminLike } from "@/lib/rbac";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { CollectionChart } from "@/features/dashboard/collection-chart";
import { LoanStatusChart } from "@/features/dashboard/loan-status-chart";
import { RepaymentWidgets } from "@/features/dashboard/repayment-widgets";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);
  const showCash = isAdminLike(role);

  const [stats, trend, breakdown, typeBreakdown, upcoming, repayment, migration, cash] =
    await Promise.all([
      getDashboardStats(scope),
      getCollectionTrend(scope),
      getLoanStatusBreakdown(scope),
      getLoanTypeBreakdown(scope),
      getUpcomingEmis(scope, 6),
      getRepaymentOverview(scope),
      getMigrationStats(scope),
      showCash ? getCashSummary() : Promise.resolve(null),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
        description="Here's what's happening across your lending portfolio today."
      />

      {/* Cash position (admins only) */}
      {cash && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Cash Available" value={formatCurrency(cash.cashAvailable)} icon={Coins} accent={cash.cashAvailable >= 0 ? "emerald" : "rose"} hint="In hand right now" />
          <StatCard title="Loans Disbursed" value={formatCurrency(cash.loansDisbursed)} icon={Banknote} accent="blue" />
          <StatCard title="Collections" value={formatCurrency(cash.collectionsReceived)} icon={Wallet} accent="violet" />
          <StatCard title="Expenses" value={formatCurrency(cash.expenses)} icon={PiggyBank} accent="rose" />
        </div>
      )}

      {/* KPI bento grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Loans" value={formatNumber(stats.totalLoans)} icon={Banknote} accent="violet" hint={`${stats.pendingLoans} pending approval`} />
        <StatCard title="Active Loans" value={formatNumber(stats.activeLoans)} icon={TrendingUp} accent="emerald" hint={`${stats.closedLoans} closed`} />
        <StatCard title="Overdue Loans" value={formatNumber(stats.overdueLoans)} icon={AlertTriangle} accent="rose" hint="Needs follow-up" />
        <StatCard title="Total Customers" value={formatNumber(stats.totalCustomers)} icon={Users} accent="blue" />
        <StatCard title="Total Disbursed" value={formatCurrency(stats.totalDisbursed)} icon={Wallet} accent="violet" />
        <StatCard title="Total Collection" value={formatCurrency(stats.totalCollection)} icon={PiggyBank} accent="emerald" />
        <StatCard title="This Month Disbursed" value={formatCurrency(stats.monthlyDisbursement)} icon={Clock} accent="blue" />
        <StatCard title="Outstanding Principal" value={formatCurrency(stats.outstandingPrincipal)} icon={CheckCircle2} accent="amber" />
        <StatCard title="Migrated Loans" value={formatNumber(migration.count)} icon={Import} accent="blue" hint={`${formatCurrency(migration.outstanding)} outstanding`} />
      </div>

      {/* Repayment radar */}
      <RepaymentWidgets data={repayment} />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collection vs Disbursement</CardTitle>
            <CardDescription>Last 6 months performance</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loan Status</CardTitle>
            <CardDescription>Distribution by stage</CardDescription>
          </CardHeader>
          <CardContent>
            <LoanStatusChart data={breakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Loan type analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio by loan type</CardTitle>
          <CardDescription>Outstanding principal across calculation methods</CardDescription>
        </CardHeader>
        <CardContent>
          {typeBreakdown.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No loans yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {typeBreakdown.map((t) => (
                <div
                  key={t.loanType}
                  className="rounded-2xl border border-border/60 bg-muted/30 p-4"
                >
                  <p className="text-sm font-medium">
                    {LOAN_TYPE_LABELS[t.loanType as LoanTypeKey] ?? t.loanType}
                  </p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(t.outstanding)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.count} loan{t.count === 1 ? "" : "s"} · {formatCurrency(t.principal)} disbursed
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming EMIs */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming & Overdue EMIs</CardTitle>
          <CardDescription>The next collections due across your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All caught up"
              description="There are no pending EMIs to collect right now."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {upcoming.map((emi) => {
                const overdue = emi.status === "OVERDUE";
                const c = emi.loan.customer;
                return (
                  <li key={emi.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.firstName} {c.lastName}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {emi.loan.loanNumber} · #{emi.installmentNumber}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(emi.dueDate)} · {c.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(emi.emiAmount)}</p>
                      <p className={overdue ? "text-xs font-medium text-rose-600" : "text-xs text-muted-foreground"}>
                        {overdue ? "Overdue" : "Due soon"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
