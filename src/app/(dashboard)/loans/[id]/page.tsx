import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, FileSignature, Receipt, Pencil } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { can } from "@/lib/rbac";
import { getLoanById } from "@/services/loan.service";
import { getFlexibleState } from "@/services/flexible-loan.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  LOAN_TYPE_LABELS,
  INTEREST_PERIOD_LABELS,
  INTEREST_METHOD_LABELS,
  REPAYMENT_MODE_LABELS,
  type LoanTypeKey,
  type InterestPeriodKey,
  type InterestMethodKey,
  type RepaymentModeKey,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { LoanStatusActions } from "@/features/loans/loan-status-actions";
import { CollectPaymentDialog } from "@/features/loans/collect-payment-dialog";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);
  const { id } = await params;

  const loan = await getLoanById(id, scope);
  if (!loan) notFound();

  const isFlexible = loan.loanType === "FLEXIBLE_LOAN";
  const flexState = isFlexible ? await getFlexibleState(loan.id) : null;

  const paidEmis = loan.emiSchedules.filter((e) => e.status === "PAID").length;
  const totalEmis = loan.emiSchedules.length;
  const progress = totalEmis ? Math.round((paidEmis / totalEmis) * 100) : 0;
  const collected = loan.payments.reduce((s, p) => s + p.amount, 0);
  const nextEmi = loan.emiSchedules.find((e) => e.status !== "PAID");
  const isActive = loan.status === "ACTIVE" || loan.status === "OVERDUE";
  // Live outstanding: flexible loans accrue dynamically; others use stored value.
  const outstanding = flexState ? flexState.totalOutstanding : loan.outstandingPrincipal;
  const canCollect = isActive && can(role, "payment:write");

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/loans">
          <ArrowLeft className="h-4 w-4" /> Back to loans
        </Link>
      </Button>

      <PageHeader
        title={loan.loanNumber}
        description={`${loan.customer.firstName} ${loan.customer.lastName} · ${loan.customer.customerCode}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/loans/${loan.id}/agreement`} target="_blank" rel="noreferrer">
                <FileSignature className="h-4 w-4" /> Agreement
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/loans/${loan.id}/statement`} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" /> Statement
              </a>
            </Button>
            {canCollect && (nextEmi || isFlexible) && (
              <CollectPaymentDialog
                loanId={loan.id}
                suggestedAmount={nextEmi?.emiAmount ?? undefined}
              />
            )}
            {can(role, "loan:edit") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/loans/${loan.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            <LoanStatusActions
              loanId={loan.id}
              status={loan.status}
              canApprove={can(role, "loan:approve")}
            />
          </div>
        }
      />

      {/* Loan type */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{LOAN_TYPE_LABELS[loan.loanType as LoanTypeKey]}</Badge>
        {loan.isMigrated && (
          <Badge variant="warning">Migrated{loan.migratedAt ? ` · ${formatDate(loan.migratedAt)}` : ""}</Badge>
        )}
        {isFlexible && (
          <Badge variant="outline">
            {loan.interestRate}% {INTEREST_METHOD_LABELS[loan.interestMethod as InterestMethodKey]} ·{" "}
            {INTEREST_PERIOD_LABELS[loan.interestPeriod as InterestPeriodKey]}
          </Badge>
        )}
        {loan.gracePeriodDays > 0 && (
          <Badge variant="outline">{loan.gracePeriodDays}-day grace</Badge>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryTile label="Principal" value={formatCurrency(loan.principalAmount)} />
        <SummaryTile
          label={isFlexible ? "Outstanding (live)" : "Outstanding principal"}
          value={formatCurrency(outstanding)}
        />
        <SummaryTile
          label={isFlexible ? "Interest accrued" : "Monthly EMI"}
          value={formatCurrency(isFlexible ? (flexState?.interestOutstanding ?? 0) : loan.emiAmount)}
        />
        <SummaryTile label="Collected" value={formatCurrency(collected)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{isFlexible ? "Account statement" : "EMI schedule"}</CardTitle>
            <StatusBadge status={loan.status} />
          </CardHeader>
          <CardContent>
            {isFlexible ? (
              flexState ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flexState.statement.map((ln, i) => (
                      <TableRow key={i}>
                        <TableCell data-label="Date" className="text-sm max-md:font-semibold">{formatDate(ln.date)}</TableCell>
                        <TableCell data-label="Description" className="text-xs text-muted-foreground">{ln.description}</TableCell>
                        <TableCell data-label="Interest" className="text-right text-sm">
                          {ln.interest > 0 ? formatCurrency(ln.interest) : "—"}
                        </TableCell>
                        <TableCell data-label="Payment" className="text-right text-sm">
                          {ln.payment > 0 ? formatCurrency(ln.payment) : "—"}
                        </TableCell>
                        <TableCell data-label="Balance" className="text-right text-sm font-medium">
                          {formatCurrency(ln.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Not disbursed yet"
                  description="Interest begins accruing once the loan is disbursed (set to Active)."
                />
              )
            ) : totalEmis === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Schedule not generated"
                description="The EMI schedule is created when the loan is disbursed (set to Active)."
              />
            ) : (
              <>
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Repayment progress</span>
                    <span className="font-medium">
                      {paidEmis}/{totalEmis} EMIs · {progress}%
                    </span>
                  </div>
                  <Progress value={progress} />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>EMI</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.emiSchedules.map((emi) => (
                      <TableRow key={emi.id}>
                        <TableCell data-label="No." className="text-sm max-md:font-semibold">{emi.installmentNumber}</TableCell>
                        <TableCell data-label="Due date" className="text-sm">{formatDate(emi.dueDate)}</TableCell>
                        <TableCell data-label="EMI" className="text-sm font-medium">
                          {formatCurrency(emi.emiAmount)}
                        </TableCell>
                        <TableCell data-label="Principal" className="text-sm">
                          {formatCurrency(emi.principalComponent)}
                        </TableCell>
                        <TableCell data-label="Interest" className="text-sm">
                          {formatCurrency(emi.interestComponent)}
                        </TableCell>
                        <TableCell data-label="Balance" className="text-sm text-muted-foreground">
                          {formatCurrency(emi.remainingBalance)}
                        </TableCell>
                        <TableCell data-label="Status">
                          <StatusBadge status={emi.status} />
                        </TableCell>
                        <TableCell data-label="Action" className="text-right">
                          {emi.status !== "PAID" && isActive && can(role, "payment:write") ? (
                            <CollectPaymentDialog
                              loanId={loan.id}
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
                            emi.paidDate && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(emi.paidDate)}
                              </span>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Loan terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <TermRow label="Loan type" value={LOAN_TYPE_LABELS[loan.loanType as LoanTypeKey]} />
              <TermRow
                label="Interest rate"
                value={
                  isFlexible
                    ? `${loan.interestRate}% / ${INTEREST_PERIOD_LABELS[loan.interestPeriod as InterestPeriodKey].toLowerCase()}`
                    : `${loan.interestRate}% p.a.`
                }
              />
              {isFlexible && (
                <TermRow
                  label="Interest method"
                  value={INTEREST_METHOD_LABELS[loan.interestMethod as InterestMethodKey]}
                />
              )}
              <TermRow label="Tenure" value={`${loan.tenureMonths} months`} />
              <TermRow
                label="Repayment mode"
                value={REPAYMENT_MODE_LABELS[loan.repaymentMode as RepaymentModeKey]}
              />
              <TermRow
                label="Expected payment"
                value={loan.repaymentMode === "OPEN_ENDED" ? "Open ended" : formatDate(loan.expectedPaymentDate)}
              />
              <TermRow label="Grace days" value={`${loan.gracePeriodDays} days`} />
              <TermRow label="Processing fee" value={formatCurrency(loan.processingFee)} />
              <TermRow label="Total interest" value={formatCurrency(loan.totalInterest)} />
              <TermRow label="Total payable" value={formatCurrency(loan.totalPayable)} />
              <TermRow label="Disbursed on" value={formatDate(loan.disbursementDate)} />
              <TermRow label="Maturity" value={formatDate(loan.maturityDate)} />
              <TermRow label="Agent" value={loan.assignedAgent?.name ?? "—"} />
              {loan.purpose && <TermRow label="Purpose" value={loan.purpose} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {loan.payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No payments recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {loan.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.paymentDate)} · {p.paymentMethod.toLowerCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {p.collectedBy?.name ?? ""}
                        </span>
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                          <a
                            href={`/api/payments/${p.id}/receipt`}
                            target="_blank"
                            rel="noreferrer"
                            title="Download receipt"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{value}</p>
    </Card>
  );
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
