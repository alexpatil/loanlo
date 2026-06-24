import type { Metadata } from "next";
import {
  Download,
  TrendingUp,
  Banknote,
  Percent,
  Coins,
  Users,
  Wallet,
  PiggyBank,
  Landmark,
  HandCoins,
  Import,
  CalendarClock,
  Activity,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { getProfitReport } from "@/services/report.service";
import {
  getDashboardStats,
  getLoanStatusBreakdown,
  getLoanTypeBreakdown,
} from "@/services/dashboard.service";
import { getMigrationStats } from "@/services/migration.service";
import { LOAN_TYPE_LABELS, type LoanTypeKey } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LoanStatusChart } from "@/features/dashboard/loan-status-chart";
import { PdfReportButtons } from "@/features/reports/pdf-report-buttons";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = [
  {
    type: "loans",
    title: "Loan Report",
    description: "All loans with principal, EMI, status and agent.",
    icon: Banknote,
  },
  {
    type: "collections",
    title: "Collection Report",
    description: "Every payment with principal/interest/penalty split.",
    icon: Wallet,
  },
  {
    type: "customers",
    title: "Customer Report",
    description: "Customer directory with KYC and loan counts.",
    icon: Users,
  },
];

export default async function ReportsPage() {
  const user = await requireAuth();
  const scope = agentScope(user.role as Role, user.id);

  const [profit, stats, migration, statusBreakdown, typeBreakdown] = await Promise.all([
    getProfitReport({ scopeAgentId: scope }),
    getDashboardStats(scope),
    getMigrationStats(scope),
    getLoanStatusBreakdown(scope),
    getLoanTypeBreakdown(scope),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Portfolio statistics, analytics and CSV exports." />

      {/* Portfolio overview — the lifetime totals */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Portfolio overview
          </CardTitle>
          <p className="text-sm text-muted-foreground">Lifetime totals across the book.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard title="Total Loans" value={formatNumber(stats.totalLoans)} icon={Banknote} accent="violet" hint={`${stats.activeLoans} active · ${stats.closedLoans} closed`} />
            <StatCard title="Total Disbursed" value={formatCurrency(stats.totalDisbursed)} icon={Wallet} accent="blue" />
            <StatCard title="Total Collection" value={formatCurrency(stats.totalCollection)} icon={PiggyBank} accent="emerald" />
            <StatCard title="Migrated Loans" value={formatNumber(migration.count)} icon={Import} accent="blue" hint={`${formatCurrency(migration.outstanding)} outstanding`} />
          </div>
        </CardContent>
      </Card>

      {/* Monthly statistics */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> This month
          </CardTitle>
          <p className="text-sm text-muted-foreground">Activity since the start of the current month.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard title="Disbursed This Month" value={formatCurrency(stats.monthlyDisbursement)} icon={Banknote} accent="blue" />
            <StatCard title="Collected This Month" value={formatCurrency(stats.monthlyCollection)} icon={Wallet} accent="violet" />
            <StatCard title="Total Customers" value={formatNumber(stats.totalCustomers)} icon={Users} accent="emerald" />
            <StatCard title="Pending Approval" value={formatNumber(stats.pendingLoans)} icon={CalendarClock} accent="amber" />
          </div>
        </CardContent>
      </Card>

      {/* On the book (expected) */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4" /> On the book (expected)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            What the live loans represent — interest is the total they will earn over their life.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard title="Expected Profit" value={formatCurrency(profit.expectedProfit)} icon={TrendingUp} accent="emerald" hint="Expected interest + fees" />
            <StatCard title="Expected Interest" value={formatCurrency(profit.expectedInterest)} icon={Percent} accent="violet" hint="Over full loan life" />
            <StatCard title="Outstanding Principal" value={formatCurrency(profit.outstandingPrincipal)} icon={PiggyBank} accent="amber" hint="Money still out" />
            <StatCard title="Principal Disbursed" value={formatCurrency(profit.principalDisbursed)} icon={Banknote} accent="blue" />
          </div>
        </CardContent>
      </Card>

      {/* Realized (collected) */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-4 w-4" /> Realized (collected)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            What has actually been received through payments so far.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard title="Realized Profit" value={formatCurrency(profit.realizedProfit)} icon={TrendingUp} accent="emerald" hint="Collected interest + penalty + fees" />
            <StatCard title="Interest Collected" value={formatCurrency(profit.interestCollected)} icon={Percent} accent="violet" />
            <StatCard title="Penalty Collected" value={formatCurrency(profit.penaltyCollected)} icon={Coins} accent="amber" />
            <StatCard title="Total Collected" value={formatCurrency(profit.totalCollected)} icon={Wallet} accent="blue" />
          </div>
        </CardContent>
      </Card>

      {/* Analytics: status + loan-type breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Loan Status</CardTitle>
            <p className="text-sm text-muted-foreground">Distribution by stage</p>
          </CardHeader>
          <CardContent>
            <LoanStatusChart data={statusBreakdown} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Portfolio by loan type</CardTitle>
            <p className="text-sm text-muted-foreground">Outstanding principal across calculation methods</p>
          </CardHeader>
          <CardContent>
            {typeBreakdown.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No loans yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {typeBreakdown.map((t) => (
                  <div key={t.loanType} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
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
      </div>

      {/* PDF reports */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">PDF reports</h2>
        <PdfReportButtons />
      </div>

      {/* CSV exports */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.type} className="flex flex-col p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-500/10 text-violet-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{report.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{report.description}</p>
              <Button asChild variant="outline" className="mt-4 w-fit">
                <a href={`/api/reports/${report.type}`} download>
                  <Download className="h-4 w-4" /> Export CSV
                </a>
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
