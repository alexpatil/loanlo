"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cashEntrySchema, type CashEntryInput } from "@/validations/cash.schema";
import { createCashEntryAction } from "@/actions/cash.actions";
import { CASH_TYPE_LABELS, type CashTransactionTypeKey } from "@/lib/constants";
import { Button, type ButtonProps } from "@/components/ui/button";
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

interface Props {
  type: "CAPITAL_ADD" | "CAPITAL_WITHDRAWAL" | "EXPENSE";
  label: string;
  variant?: ButtonProps["variant"];
  icon?: React.ReactNode;
}

export function CashEntryDialog({ type, label, variant = "outline", icon }: Props) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CashEntryInput>({
    resolver: zodResolver(cashEntrySchema) as unknown as Resolver<CashEntryInput>,
    defaultValues: { type, transactionDate: new Date() },
  });

  async function onSubmit(values: CashEntryInput) {
    const result = await createCashEntryAction({ ...values, type });
    if (result.success) {
      toast.success(result.message ?? "Saved");
      setOpen(false);
      reset({ type, transactionDate: new Date() });
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          {icon}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{CASH_TYPE_LABELS[type as CashTransactionTypeKey]}</DialogTitle>
          <DialogDescription>Record a manual cash movement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" step="1" {...register("amount")} placeholder="0" />
            {errors.amount && <p className="text-xs text-rose-600">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setValue("transactionDate", new Date(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea {...register("note")} placeholder="What is this for?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
