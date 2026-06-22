"use client";

import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { editLoanSchema, type EditLoanInput } from "@/validations/loan.schema";
import { editLoanAction } from "@/actions/loan.actions";
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

export interface EditLoanDefaults {
  id: string;
  loanType: EditLoanInput["loanType"];
  interestPeriod: EditLoanInput["interestPeriod"];
  interestMethod: EditLoanInput["interestMethod"];
  repaymentMode: EditLoanInput["repaymentMode"];
  expectedPaymentDate?: string;
  gracePeriodDays: number;
  principalAmount: number;
  interestRate: number;
  processingFee: number;
  tenureMonths: number;
  disbursementDate?: string;
  purpose?: string;
  assignedAgentId?: string;
}

export function EditLoanForm({
  defaults,
  agents,
  hasPayments,
}: {
  defaults: EditLoanDefaults;
  agents: { id: string; name: string }[];
  hasPayments: boolean;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditLoanInput>({
    resolver: zodResolver(editLoanSchema) as unknown as Resolver<EditLoanInput>,
    defaultValues: defaults as unknown as EditLoanInput,
  });

  const loanType = watch("loanType");
  const isFlexible = loanType === "FLEXIBLE_LOAN";
  const repaymentMode = watch("repaymentMode");

  async function onSubmit(values: EditLoanInput) {
    const result = await editLoanAction({ ...values, id: defaults.id });
    if (result.success) {
      toast.success(result.message ?? "Loan updated");
      router.push(`/loans/${defaults.id}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // Financial terms are locked once payments exist.
  const fin = hasPayments;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {hasPayments && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This loan has collected payments, so financial terms (amount, rate, tenure, fee,
            type, dates) are locked. You can still correct the agent, grace period, repayment
            mode and purpose.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Loan terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Loan type</Label>
              <Select
                value={loanType}
                onValueChange={(v) => setValue("loanType", v as EditLoanInput["loanType"])}
                disabled={fin}
              >
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
              <Select
                value={repaymentMode}
                onValueChange={(v) => setValue("repaymentMode", v as EditLoanInput["repaymentMode"])}
              >
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
                <Select value={watch("interestPeriod")} onValueChange={(v) => setValue("interestPeriod", v as EditLoanInput["interestPeriod"])} disabled={fin}>
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
                <Select value={watch("interestMethod")} onValueChange={(v) => setValue("interestMethod", v as EditLoanInput["interestMethod"])} disabled={fin}>
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
              <Input type="number" {...register("principalAmount")} disabled={fin} />
              {errors.principalAmount && <p className="text-xs text-rose-600">{errors.principalAmount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{isFlexible ? "Rate (%/period)" : "Rate (% p.a.)"}</Label>
              <Input type="number" step="0.1" {...register("interestRate")} disabled={fin} />
            </div>
            <div className="space-y-1.5">
              <Label>Tenure (months)</Label>
              <Input type="number" {...register("tenureMonths")} disabled={fin} />
            </div>
            <div className="space-y-1.5">
              <Label>Processing fee (₹)</Label>
              <Input type="number" {...register("processingFee")} disabled={fin} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Disbursement date</Label>
              <Input type="date" {...register("disbursementDate")} disabled={fin} />
            </div>
            {repaymentMode === "FIXED_DATE" && (
              <div className="space-y-1.5">
                <Label>Expected payment date</Label>
                <Input type="date" {...register("expectedPaymentDate")} />
                {errors.expectedPaymentDate && <p className="text-xs text-rose-600">{errors.expectedPaymentDate.message}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Grace days</Label>
              <Input type="number" {...register("gracePeriodDays")} />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned agent</Label>
              <Select value={watch("assignedAgentId") ?? ""} onValueChange={(v) => setValue("assignedAgentId", v)}>
                <SelectTrigger><SelectValue placeholder="Unchanged" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Purpose</Label>
            <Input {...register("purpose")} placeholder="Business expansion, personal…" />
          </div>

          <div className="space-y-1.5">
            <Label>Reason for edit (audit note)</Label>
            <Textarea {...register("editReason")} placeholder="e.g. Agent entered ₹50,000 instead of ₹5,000" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(`/loans/${defaults.id}`)}>
          Cancel
        </Button>
        <Button type="submit" variant="gradient" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
