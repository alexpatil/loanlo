import type { Metadata } from "next";
import {
  Wallet,
  Banknote,
  HandCoins,
  PiggyBank,
  Receipt,
  Plus,
  Minus,
  FileText,
} from "lucide-react";
import { requirePermission } from "@/lib/session";
import { getCashSummary, listCashTransactions } from "@/services/cash.service";
import {
  CASH_TRANSACTION_TYPES,
  CASH_TYPE_LABELS,
  CASH_TYPE_SIGN,
  CASH_TYPE_STYLES,
  type CashTransactionTypeKey,
} from "@/lib/constants";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EmptyState } from "@/components/shared/states";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { CashEntryDialog } from "@/features/cash/cash-entry-dialog";
import { CashDateFilter } from "@/features/cash/cash-date-filter";
import { CashPdfButtons } from "@/features/cash/cash-pdf-buttons";

export const metadata: Metadata = { title: "Cash Management" };

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string; page?: string }>;
}) {
  // Cash is an owner/admin concern — agents have no access.
  await requirePermission("cash:read");
  const sp = await searchParams;

  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : undefined;

  const [summary, data] = await Promise.all([
    getCashSummary(),
    listCashTransactions({ type: sp.type, from, to, page: Number(sp.page) || 1 }),
  ]);

  const exportQuery = new URLSearchParams();
  if (sp.from) exportQuery.set("from", sp.from);
  if (sp.to) exportQuery.set("to", sp.to);
  const cashbookHref = `/api/cash/cashbook${exportQuery.toString() ? `?${exportQuery}` : ""}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cash Management"
        description="Track every rupee moving through your business."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CashEntryDialog type="CAPITAL_ADD" label="Add Capital" variant="gradient" icon={<Plus className="h-4 w-4" />} />
            <CashEntryDialog type="CAPITAL_WITHDRAWAL" label="Withdraw" icon={<Minus className="h-4 w-4" />} />
            <CashEntryDialog type="EXPENSE" label="Add Expense" icon={<Receipt className="h-4 w-4" />} />
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard title="Cash Available" value={formatCurrency(summary.cashAvailable)} icon={Wallet} accent={summary.cashAvailable >= 0 ? "emerald" : "rose"} hint={`Capital ${formatCurrency(summary.capitalAdded)}`} />
        <StatCard title="Total Loans Disbursed" value={formatCurrency(summary.loansDisbursed)} icon={Banknote} accent="blue" />
        <StatCard title="Total Collections" value={formatCurrency(summary.collectionsReceived)} icon={HandCoins} accent="violet" />
        <StatCard title="Outstanding Amount" value={formatCurrency(summary.outstandingAmount)} icon={PiggyBank} accent="amber" />
        <StatCard title="Total Expenses" value={formatCurrency(summary.expenses)} icon={Receipt} accent="rose" />
      </div>

      {/* PDF reports */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-muted-foreground">Cash reports</p>
        <CashPdfButtons />
      </Card>

      {/* History */}
      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              paramKey="type"
              placeholder="All types"
              options={CASH_TRANSACTION_TYPES.map((t) => ({ label: CASH_TYPE_LABELS[t], value: t }))}
            />
            <CashDateFilter />
          </div>
          <Button asChild variant="outline">
            <a href={cashbookHref} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4" /> Cash Book PDF
            </a>
          </Button>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions"
            description="Add capital or record an expense to get started."
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                In: <span className="font-semibold text-emerald-600">{formatCurrency(data.inflow)}</span>
              </span>
              <span className="text-muted-foreground">
                Out: <span className="font-semibold text-rose-600">{formatCurrency(data.outflow)}</span>
              </span>
              <span className="text-muted-foreground">
                Net: <span className="font-semibold">{formatCurrency(data.net)}</span>
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => {
                  const sign = CASH_TYPE_SIGN[t.type as CashTransactionTypeKey];
                  return (
                    <TableRow key={t.id}>
                      <TableCell data-label="Date" className="text-sm">{formatDate(t.transactionDate)}</TableCell>
                      <TableCell data-label="Type">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            CASH_TYPE_STYLES[t.type as CashTransactionTypeKey],
                          )}
                        >
                          {CASH_TYPE_LABELS[t.type as CashTransactionTypeKey]}
                        </span>
                      </TableCell>
                      <TableCell data-label="Note" className="text-sm text-muted-foreground md:max-w-xs md:truncate">
                        {t.note ?? "—"}
                      </TableCell>
                      <TableCell data-label="Recorded by" className="text-sm text-muted-foreground">
                        {t.createdBy?.name ?? "System"}
                      </TableCell>
                      <TableCell
                        data-label="Amount"
                        className={cn(
                          "text-right text-sm font-semibold",
                          sign === 1 ? "text-emerald-600" : "text-rose-600",
                        )}
                      >
                        {sign === 1 ? "+" : "−"}
                        {formatCurrency(t.amount)}
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
