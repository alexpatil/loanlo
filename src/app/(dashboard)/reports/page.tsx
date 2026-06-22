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
} from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { getProfitReport } from "@/services/report.service";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
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
  const profit = await getProfitReport({ scopeAgentId: scope });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Portfolio analytics and CSV exports." />

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Realized Profit" value={formatCurrency(profit.realizedProfit)} icon={TrendingUp} accent="emerald" hint="Collected interest + penalty + fees" />
            <StatCard title="Interest Collected" value={formatCurrency(profit.interestCollected)} icon={Percent} accent="violet" />
            <StatCard title="Penalty Collected" value={formatCurrency(profit.penaltyCollected)} icon={Coins} accent="amber" />
            <StatCard title="Total Collected" value={formatCurrency(profit.totalCollected)} icon={Wallet} accent="blue" />
          </div>
        </CardContent>
      </Card>

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
