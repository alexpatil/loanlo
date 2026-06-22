"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { customerSchema, type CustomerInput } from "@/validations/customer.schema";
import { createCustomerAction, updateCustomerAction } from "@/actions/customer.actions";
import { GENDERS, KYC_STATUS } from "@/lib/constants";
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

type AgentOption = { id: string; name: string };

interface Props {
  customer?: Partial<CustomerInput> & { id: string };
  agents?: AgentOption[];
  canAssign?: boolean;
  trigger?: React.ReactNode;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function CustomerFormDialog({ customer, agents = [], canAssign, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(customer?.id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema) as unknown as Resolver<CustomerInput>,
    defaultValues: {
      country: "India",
      kycStatus: "PENDING",
      ...customer,
    },
  });

  async function onSubmit(values: CustomerInput) {
    const action = isEdit
      ? updateCustomerAction({ id: customer!.id, ...values })
      : createCustomerAction(values);
    const result = await action;
    if (result.success) {
      toast.success(result.message ?? "Saved");
      setOpen(false);
      if (!isEdit) reset();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="gradient">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Capture personal, KYC and address details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message}>
              <Input {...register("firstName")} placeholder="John" />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Input {...register("lastName")} placeholder="Doe" />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input {...register("phone")} placeholder="9876543210" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input {...register("email")} placeholder="john@email.com" />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <Select
                value={watch("gender") ?? ""}
                onValueChange={(v) => setValue("gender", v as CustomerInput["gender"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g} className="capitalize">
                      {g.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Monthly income (₹)" error={errors.monthlyIncome?.message}>
              <Input type="number" {...register("monthlyIncome")} placeholder="50000" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Aadhaar number" error={errors.aadhaarNumber?.message}>
              <Input {...register("aadhaarNumber")} placeholder="123412341234" />
            </Field>
            <Field label="PAN number" error={errors.panNumber?.message}>
              <Input {...register("panNumber")} placeholder="ABCDE1234F" className="uppercase" />
            </Field>
            <Field label="KYC status" error={errors.kycStatus?.message}>
              <Select
                value={watch("kycStatus") ?? "PENDING"}
                onValueChange={(v) => setValue("kycStatus", v as CustomerInput["kycStatus"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KYC_STATUS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Occupation" error={errors.occupation?.message}>
              <Input {...register("occupation")} placeholder="Salaried" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" error={errors.addressLine1?.message}>
              <Input {...register("addressLine1")} placeholder="House / Street" />
            </Field>
            <Field label="City" error={errors.city?.message}>
              <Input {...register("city")} placeholder="Mumbai" />
            </Field>
            <Field label="State" error={errors.state?.message}>
              <Input {...register("state")} placeholder="Maharashtra" />
            </Field>
            <Field label="Pincode" error={errors.pincode?.message}>
              <Input {...register("pincode")} placeholder="400001" />
            </Field>
          </div>

          {canAssign && agents.length > 0 && (
            <Field label="Assign to agent" error={errors.assignedAgentId?.message}>
              <Select
                value={watch("assignedAgentId") ?? ""}
                onValueChange={(v) => setValue("assignedAgentId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} placeholder="Internal notes…" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
