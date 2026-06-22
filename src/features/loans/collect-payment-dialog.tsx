"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { paymentSchema, type PaymentInput } from "@/validations/payment.schema";
import { recordPaymentAction } from "@/actions/payment.actions";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  loanId: string;
  suggestedAmount?: number;
  emiScheduleId?: string;
  trigger?: React.ReactNode;
}

export function CollectPaymentDialog({
  loanId,
  suggestedAmount,
  emiScheduleId,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema) as unknown as Resolver<PaymentInput>,
    defaultValues: {
      loanId,
      emiScheduleId,
      amount: suggestedAmount,
      paymentMethod: "CASH",
      paymentDate: new Date(),
    },
  });

  async function onSubmit(values: PaymentInput) {
    const result = await recordPaymentAction(values);
    if (result.success) {
      toast.success(result.message ?? "Payment recorded");
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="gradient">
            <Wallet className="h-4 w-4" /> Collect payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record collection</DialogTitle>
          <DialogDescription>
            {suggestedAmount
              ? `Suggested EMI: ${formatCurrency(suggestedAmount)}`
              : "Apply this payment across the outstanding EMIs."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("loanId")} />
          <input type="hidden" {...register("emiScheduleId")} />
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" step="1" {...register("amount")} />
            {errors.amount && <p className="text-xs text-rose-600">{errors.amount.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select
                value={watch("paymentMethod")}
                onValueChange={(v) =>
                  setValue("paymentMethod", v as PaymentInput["paymentMethod"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m.toLowerCase().replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValue("paymentDate", new Date(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reference (optional)</Label>
            <Input {...register("reference")} placeholder="UTR / cheque no." />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register("notes")} placeholder="Optional notes…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
