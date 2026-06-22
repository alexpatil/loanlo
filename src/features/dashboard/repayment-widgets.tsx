import Link from "next/link";
import { CalendarClock, CalendarRange, AlertTriangle, Clock, HandCoins } from "lucide-react";
import type { RepaymentOverview } from "@/services/repayment.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";

export function RepaymentWidgets({ data }: { data: RepaymentOverview }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Due Today"
          value={formatCurrency(data.dueToday.amount)}
          icon={CalendarClock}
          accent="violet"
          hint={`${data.dueToday.count} collection${data.dueToday.count === 1 ? "" : "s"}`}
        />
        <StatCard
          title="Due This Week"
          value={formatCurrency(data.dueThisWeek.amount)}
          icon={CalendarRange}
          accent="blue"
          hint={`${data.dueThisWeek.count} collection${data.dueThisWeek.count === 1 ? "" : "s"}`}
        />
        <StatCard
          title="Overdue Loans"
          value={data.overdue.count}
          icon={AlertTriangle}
          accent="rose"
          hint={`${formatCurrency(data.overdue.amount)} outstanding`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming Collections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Upcoming Collections
            </CardTitle>
            <CardDescription>Loans approaching their due date</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <EmptyState icon={Clock} title="Nothing upcoming" description="No collections are due soon." />
            ) : (
              <ul className="divide-y divide-border/60">
                {data.upcoming.map((item) => (
                  <li key={`${item.source}-${item.id}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/loans/${item.loanId}`} className="text-sm font-medium hover:text-violet-600">
                        {item.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.loanNumber} · due {formatDate(item.dueDate)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{formatCurrency(item.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Customer Commitments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-4 w-4" /> Customer Commitments
            </CardTitle>
            <CardDescription>Next expected payment per customer</CardDescription>
          </CardHeader>
          <CardContent>
            {data.commitments.length === 0 ? (
              <EmptyState icon={HandCoins} title="No commitments" description="No pending customer commitments." />
            ) : (
              <ul className="divide-y divide-border/60">
                {data.commitments.map((c) => (
                  <li key={`${c.customerName}-${c.phone}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        Next {formatDate(c.nextDueDate)} · {c.items} due
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{formatCurrency(c.totalDue)}</span>
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
