"use client";

import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { migrationSchema, type MigrationInput, MIGRATION_STATUSES } from "@/validations/migration.schema";
import { migrateLoanAction } from "@/actions/migration.actions";
import {
  LOAN_TYPES,
  LOAN_TYPE_LABELS,
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  INTEREST_METHODS,
  INTEREST_METHOD_LABELS,
  REPAYMENT_MODES,
  REPAYMENT_MODE_LABELS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CustomerOption = { id: string; firstName: string; lastName: string; customerCode: string };

export function MigrationForm({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MigrationInput>({
    resolver: zodResolver(migrationSchema) as unknown as Resolver<MigrationInput>,
    defaultValues: {
      loanType: "EMI",
      interestPeriod: "MONTHLY",
      interestMethod: "SIMPLE",
      repaymentMode: "DURATION_BASED",
      status: "ACTIVE",
      processingFee: 0,
      gracePeriodDays: 0,
      totalCollected: 0,
      interestRate: 18,
      tenureMonths: 12,
      historicalCollections: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "historicalCollections" });
  const loanType = watch("loanType");
  const isFlexible = loanType === "FLEXIBLE_LOAN";

  async function onSubmit(values: MigrationInput) {
    const result = await migrateLoanAction(values);
    if (result.success) {
      toast.success(result.message ?? "Loan migrated");
      router.push(`/loans/${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Loan & customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select
              value={watch("customerId") ?? ""}
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
            {errors.customerId && <p className="text-xs text-rose-600">{errors.customerId.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Loan type</Label>
              <Select value={loanType} onValueChange={(v) => setValue("loanType", v as MigrationInput["loanType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{LOAN_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Repayment mode</Label>
              <Select value={watch("repaymentMode")} onValueChange={(v) => setValue("repaymentMode", v as MigrationInput["repaymentMode"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{REPAYMENT_MODE_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFlexible && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Interest period</Label>
                <Select value={watch("interestPeriod")} onValueChange={(v) => setValue("interestPeriod", v as MigrationInput["interestPeriod"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTEREST_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>{INTEREST_PERIOD_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Interest method</Label>
                <Select value={watch("interestMethod")} onValueChange={(v) => setValue("interestMethod", v as MigrationInput["interestMethod"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTEREST_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{INTEREST_METHOD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Principal (₹)</Label>
              <Input type="number" {...register("principalAmount")} />
              {errors.principalAmount && <p className="text-xs text-rose-600">{errors.principalAmount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{isFlexible ? "Rate (%/period)" : "Rate (% p.a.)"}</Label>
              <Input type="number" step="0.1" {...register("interestRate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Tenure (months)</Label>
              <Input type="number" {...register("tenureMonths")} />
            </div>
            <div className="space-y-1.5">
              <Label>Grace days</Label>
              <Input type="number" {...register("gracePeriodDays")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register / historical data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Disbursement date</Label>
              <Input type="date" {...register("disbursementDate")} />
              {errors.disbursementDate && <p className="text-xs text-rose-600">{errors.disbursementDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as MigrationInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MIGRATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Current outstanding (₹)</Label>
              <Input type="number" {...register("currentOutstanding")} />
              {errors.currentOutstanding && <p className="text-xs text-rose-600">{errors.currentOutstanding.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Total collected (₹)</Label>
              <Input type="number" {...register("totalCollected")} />
            </div>
          </div>

          {watch("repaymentMode") === "FIXED_DATE" && (
            <div className="space-y-1.5 sm:max-w-xs">
              <Label>Expected payment date</Label>
              <Input type="date" {...register("expectedPaymentDate")} />
              {errors.expectedPaymentDate && <p className="text-xs text-rose-600">{errors.expectedPaymentDate.message}</p>}
            </div>
          )}

          {/* Historical collections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <History className="h-4 w-4" /> Historical collections (optional)
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ date: new Date(), amount: 0 })}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Itemise past collections to build the ledger. If left empty, “Total collected” is recorded as a single opening entry.
            </p>
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" {...register(`historicalCollections.${i}.date` as const)} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Amount (₹)</Label>
                  <Input type="number" {...register(`historicalCollections.${i}.amount` as const)} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Migration note</Label>
            <Textarea {...register("note")} placeholder="Old register reference, remarks…" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="gradient" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Migrate loan
        </Button>
      </div>
    </form>
  );
}
