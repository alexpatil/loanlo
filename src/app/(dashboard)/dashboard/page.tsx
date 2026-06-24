import type { Metadata } from "next";
import Link from "next/link";
import { startOfDay } from "date-fns";
import {
  Coins,
  PiggyBank,
  Wallet,
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  Clock,
  HandCoins,
  Banknote,
  ArrowUpRight,
  Landmark,
  Users,
  TrendingUp,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { getDashboardStats, getCollectionTrend, getRecentActivity } from "@/services/dashboard.service";
import { listPayments } from "@/services/payment.service";
import { getRepaymentOverview } from "@/services/repayment.service";
import { getCashSummary } from "@/services/cash.service";
import { isAdminLike } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EmptyState } from "@/components/shared/states";
import { CollectionChart } from "@/features/dashboard/collection-chart";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);
  const showCash = isAdminLike(role);

  const [stats, trend, repayment, activity, todayColl, cash] = await Promise.all([
    getDashboardStats(scope),
    getCollectionTrend(scope),
    getRepaymentOverview(scope),
    getRecentActivity(scope, 8),
    listPayments({ from: startOfDay(new Date()), collectedById: scope, pageSize: 1 }),
    showCash ? getCashSummary() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
        description="Your lending portfolio at a glance — what needs attention today."
      />

      {/* Headline metrics — the four numbers that drive the business */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cash ? (
          <StatCard
            title="Cash Available"
            value={formatCurrency(cash.cashAvailable)}
            icon={Coins}
            accent={cash.cashAvailable >= 0 ? "emerald" : "rose"}
            hint="In hand right now"
          />
        ) : (
          <StatCard
            title="Due This Week"
            value={formatCurrency(repayment.dueThisWeek.amount)}
            icon={CalendarRange}
            accent="blue"
            hint={`${repayment.dueThisWeek.count} collection${repayment.dueThisWeek.count === 1 ? "" : "s"}`}
          />
        )}
        <StatCard
          title="Outstanding Amount"
          value={formatCurrency(stats.outstandingPrincipal)}
          icon={PiggyBank}
          accent="amber"
          hint="Money still on the street"
        />
        <StatCard
          title="Today's Collections"
          value={formatCurrency(todayColl.totalAmount)}
          icon={Wallet}
          accent="violet"
          hint={`${todayColl.total} payment${todayColl.total === 1 ? "" : "s"} today`}
        />
        <StatCard
          title="Overdue Amount"
          value={formatCurrency(repayment.overdue.amount)}
          icon={AlertTriangle}
          accent="rose"
          hint={`${repayment.overdue.count} loan${repayment.overdue.count === 1 ? "" : "s"} overdue`}
        />

        {/* Secondary metrics — portfolio size and momentum */}
        <StatCard
          title="Active Loans"
          value={stats.activeLoans}
          icon={Landmark}
          accent="blue"
          hint={`${stats.pendingLoans} pending · ${stats.closedLoans} closed`}
        />
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          icon={Users}
          accent="violet"
          hint="Borrowers on your book"
        />
        <StatCard
          title="Collected This Month"
          value={formatCurrency(stats.monthlyCollection)}
          icon={TrendingUp}
          accent="emerald"
          hint="Received since the 1st"
        />
        {cash ? (
          <StatCard
            title="Due This Week"
            value={formatCurrency(repayment.dueThisWeek.amount)}
            icon={CalendarRange}
            accent="amber"
            hint={`${repayment.dueThisWeek.count} collection${repayment.dueThisWeek.count === 1 ? "" : "s"} due`}
          />
        ) : (
          <StatCard
            title="Pending Approval"
            value={stats.pendingLoans}
            icon={CalendarClock}
            accent="amber"
            hint="Awaiting your review"
          />
        )}
      </div>

      {/* Trend + activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collection Trend</CardTitle>
            <CardDescription>Collections vs disbursement · last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest payments and new loans</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState icon={Clock} title="No activity yet" description="Collections and new loans will show up here." />
            ) : (
              <ul className="-mt-1 divide-y divide-border/60">
                {activity.map((a) => {
                  const isColl = a.kind === "COLLECTION";
                  return (
                    <li key={a.id} className="py-2.5">
                      <Link href={a.href} className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isColl ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          {isColl ? <Wallet className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.subtitle} · {formatDate(a.date)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold">{formatCurrency(a.amount)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collections that need action */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Upcoming Collections
            </CardTitle>
            <CardDescription>Loans approaching their due date</CardDescription>
          </CardHeader>
          <CardContent>
            {repayment.upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing upcoming" description="No collections are due soon." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repayment.upcoming.map((item) => (
                    <TableRow key={`${item.source}-${item.id}`}>
                      <TableCell className="text-sm font-medium max-md:font-semibold">{item.customerName}</TableCell>
                      <TableCell data-label="Loan" className="text-sm">
                        <Link href={`/loans/${item.loanId}`} className="text-muted-foreground hover:text-violet-600">
                          {item.loanNumber}
                        </Link>
                      </TableCell>
                      <TableCell data-label="Due date" className="text-sm text-muted-foreground">{formatDate(item.dueDate)}</TableCell>
                      <TableCell data-label="Amount" className="text-right text-sm font-semibold">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-4 w-4" /> Customer Commitments
            </CardTitle>
            <CardDescription>Next expected payment per customer</CardDescription>
          </CardHeader>
          <CardContent>
            {repayment.commitments.length === 0 ? (
              <EmptyState icon={HandCoins} title="No commitments" description="No pending customer commitments." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead className="text-center">Dues</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repayment.commitments.map((c) => (
                    <TableRow key={`${c.customerName}-${c.phone}`}>
                      <TableCell className="text-sm font-medium max-md:font-semibold">
                        <span>
                          {c.customerName}
                          <span className="block text-xs font-normal text-muted-foreground">{c.phone}</span>
                        </span>
                      </TableCell>
                      <TableCell data-label="Next due" className="text-sm text-muted-foreground">{formatDate(c.nextDueDate)}</TableCell>
                      <TableCell data-label="Dues" className="text-center text-sm text-muted-foreground">{c.items}</TableCell>
                      <TableCell data-label="Total" className="text-right text-sm font-semibold">{formatCurrency(c.totalDue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pointer to the deeper analytics that used to crowd this page */}
      <Card className="bg-muted/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium">Looking for totals and portfolio statistics?</p>
            <p className="text-xs text-muted-foreground">
              Total loans, disbursed, collections, migrated loans and monthly trends live in Reports.
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            View Reports <ArrowUpRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
