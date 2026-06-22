"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loanSchema, type LoanInput } from "@/validations/loan.schema";
import { createLoanAction } from "@/actions/loan.actions";
import { calculateEmi } from "@/lib/finance";
import { projectNonEmi } from "@/lib/interest-engine";
import { cn, formatCurrency } from "@/lib/utils";
import {
  LOAN_KINDS,
  LOAN_KIND_LABELS,
  LOAN_KIND_DESCRIPTIONS,
  CALCULATION_METHODS,
  CALCULATION_METHOD_LABELS,
  CALCULATION_METHOD_DESCRIPTIONS,
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  DURATION_UNITS,
  DURATION_UNIT_LABELS,
  FREQUENCY_TO_UNIT,
  REPAYMENT_MODES,
  REPAYMENT_MODE_LABELS,
  REPAYMENT_MODE_DESCRIPTIONS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CustomerOption = {
  id: string;
  firstName: string;
  lastName: string;
  customerCode: string;
};

export function LoanForm({
  customers,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoanInput>({
    resolver: zodResolver(loanSchema) as unknown as Resolver<LoanInput>,
    defaultValues: {
      customerId: defaultCustomerId ?? "",
      loanKind: "EMI",
      interestRate: 18,
      tenureMonths: 12,
      processingFee: 0,
      gracePeriodDays: 0,
      repaymentMode: "DURATION_BASED",
      calculationMethod: "REDUCING",
      interestFrequency: "MONTHLY",
      durationValue: 10,
      durationUnit: "MONTHS",
    },
  });

  const loanKind = watch("loanKind") ?? "EMI";
  const isEmi = loanKind === "EMI";
  const repaymentMode = watch("repaymentMode") ?? "DURATION_BASED";
  const frequency = watch("interestFrequency") ?? "MONTHLY";
  const durationUnit = watch("durationUnit") ?? "MONTHS";
  const calc = watch("calculationMethod") ?? "REDUCING";

  const principal = Number(watch("principalAmount")) || 0;
  const rate = Number(watch("interestRate")) || 0;
  const tenure = Number(watch("tenureMonths")) || 0;
  const fee = Number(watch("processingFee")) || 0;
  const durationValue = Number(watch("durationValue")) || 0;

  // Switching loan kind resets the rate to a sensible default for that mode.
  function selectKind(kind: (typeof LOAN_KINDS)[number]) {
    setValue("loanKind", kind);
    setValue("interestRate", kind === "EMI" ? 18 : 2);
  }

  const preview = useMemo(() => {
    if (principal <= 0) return null;
    if (isEmi) {
      if (tenure <= 0) return null;
      const c = calculateEmi({
        principal,
        annualInterestRate: rate,
        tenureMonths: tenure,
        processingFee: fee,
      });
      return {
        headline: c.emiAmount,
        headlineLabel: "Monthly EMI",
        totalInterest: c.totalInterest,
        totalPayable: c.totalPayable,
        netDisbursed: c.netDisbursed,
        sub: `${tenure} monthly installments`,
      };
    }
    if (durationValue <= 0) return null;
    const p = projectNonEmi({
      principal,
      ratePerPeriod: rate,
      calc,
      frequency,
      durationValue,
      durationUnit,
    });
    return {
      headline: p.totalPayable,
      headlineLabel: "Total to repay",
      totalInterest: p.totalInterest,
      totalPayable: p.totalPayable,
      netDisbursed: principal - fee,
      sub: `${rate}% ${CALCULATION_METHOD_LABELS[calc].toLowerCase()} per ${INTEREST_PERIOD_LABELS[frequency].toLowerCase()} · ${durationValue} ${DURATION_UNIT_LABELS[durationUnit].toLowerCase()}`,
    };
  }, [isEmi, principal, rate, tenure, fee, durationValue, durationUnit, frequency, calc]);

  async function onSubmit(values: LoanInput) {
    const result = await createLoanAction(values);
    if (result.success) {
      toast.success(result.message ?? "Loan created");
      router.push(`/loans/${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Customer + kind */}
        <Card>
          <CardHeader>
            <CardTitle>Who and what kind of loan?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select
                value={watch("customerId")}
                onValueChange={(v) => setValue("customerId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} · {c.customerCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerId && (
                <p className="text-xs text-rose-600">{errors.customerId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Loan type</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {LOAN_KINDS.map((kind) => {
                  const active = loanKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => selectKind(kind)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        active
                          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                          : "border-border hover:border-violet-200 hover:bg-accent",
                      )}
                    >
                      <p className="font-semibold">{LOAN_KIND_LABELS[kind]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {LOAN_KIND_DESCRIPTIONS[kind]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Money details */}
        <Card>
          <CardHeader>
            <CardTitle>Money details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Loan amount (₹)</Label>
              <Input type="number" step="100" {...register("principalAmount")} placeholder="100000" />
              {errors.principalAmount && (
                <p className="text-xs text-rose-600">{errors.principalAmount.message}</p>
              )}
            </div>

            {isEmi ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Annual interest rate (%)</Label>
                  <Input type="number" step="0.1" {...register("interestRate")} placeholder="18" />
                  {errors.interestRate && (
                    <p className="text-xs text-rose-600">{errors.interestRate.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Tenure (months)</Label>
                  <Input type="number" {...register("tenureMonths")} placeholder="12" />
                  {errors.tenureMonths && (
                    <p className="text-xs text-rose-600">{errors.tenureMonths.message}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>How is interest calculated?</Label>
                  <Select
                    value={calc}
                    onValueChange={(v) => setValue("calculationMethod", v as LoanInput["calculationMethod"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALCULATION_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {CALCULATION_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {CALCULATION_METHOD_DESCRIPTIONS[calc]}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Interest charged</Label>
                    <Select
                      value={frequency}
                      onValueChange={(v) => {
                        setValue("interestFrequency", v as LoanInput["interestFrequency"]);
                        // Pair the duration unit with the frequency by default.
                        setValue("durationUnit", FREQUENCY_TO_UNIT[v] as LoanInput["durationUnit"]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTEREST_PERIODS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {INTEREST_PERIOD_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Interest rate (% per {INTEREST_PERIOD_LABELS[frequency].toLowerCase()})</Label>
                    <Input type="number" step="0.1" {...register("interestRate")} placeholder="2" />
                    {errors.interestRate && (
                      <p className="text-xs text-rose-600">{errors.interestRate.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Loan duration</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      className="w-28"
                      {...register("durationValue")}
                      placeholder="10"
                    />
                    <Select
                      value={durationUnit}
                      onValueChange={(v) => setValue("durationUnit", v as LoanInput["durationUnit"])}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {DURATION_UNIT_LABELS[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.durationValue && (
                    <p className="text-xs text-rose-600">{errors.durationValue.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    e.g. 30 Days · 8 Weeks · 10 Months
                  </p>
                </div>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Processing fee (₹)</Label>
                <Input type="number" step="10" {...register("processingFee")} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Grace period (days, optional)</Label>
                <Input type="number" {...register("gracePeriodDays")} placeholder="0" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repayment */}
        <Card>
          <CardHeader>
            <CardTitle>When is it due?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Repayment mode</Label>
                <Select
                  value={repaymentMode}
                  onValueChange={(v) => setValue("repaymentMode", v as LoanInput["repaymentMode"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {REPAYMENT_MODE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {REPAYMENT_MODE_DESCRIPTIONS[repaymentMode]}
                </p>
              </div>
              {repaymentMode === "FIXED_DATE" && (
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input type="date" {...register("expectedPaymentDate")} />
                  {errors.expectedPaymentDate && (
                    <p className="text-xs text-rose-600">{errors.expectedPaymentDate.message}</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Purpose (optional)</Label>
              <Input {...register("purpose")} placeholder="Business, medical, personal…" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live summary */}
      <Card className="sticky top-20 h-fit bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <CardHeader>
          <CardTitle className="text-white">Repayment summary</CardTitle>
          <p className="text-sm text-white/70">{LOAN_KIND_LABELS[loanKind]}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview ? (
            <>
              <div>
                <p className="text-sm text-white/70">{preview.headlineLabel}</p>
                <p className="text-3xl font-bold">{formatCurrency(preview.headline)}</p>
                <p className="mt-1 text-xs text-white/70">{preview.sub}</p>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Loan amount" value={formatCurrency(principal)} />
                <Row label="Total interest" value={formatCurrency(preview.totalInterest)} />
                <Row label="Total to repay" value={formatCurrency(preview.totalPayable)} />
                <Row label="Processing fee" value={formatCurrency(fee)} />
                <div className="my-2 h-px bg-white/20" />
                <Row label="Amount given to customer" value={formatCurrency(preview.netDisbursed)} bold />
              </div>
              {!isEmi && (
                <p className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80">
                  No fixed EMI — the customer can repay any amount, any time.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-white/70">
              Fill in the amount and {isEmi ? "tenure" : "duration"} to see the summary.
            </p>
          )}
          <Button
            type="submit"
            className="w-full bg-white text-violet-700 hover:bg-white/90"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create loan
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/70">{label}</span>
      <span className={bold ? "text-base font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
