"use client";

import { useTransition } from "react";
import { CheckCircle2, XCircle, Banknote, Lock, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { updateLoanStatusAction } from "@/actions/loan.actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  loanId: string;
  status: string;
  canApprove: boolean;
}

export function LoanStatusActions({ loanId, status, canApprove }: Props) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: string) {
    startTransition(async () => {
      const result = await updateLoanStatusAction({ id: loanId, status: next });
      if (result.success) toast.success(result.message ?? "Updated");
      else toast.error(result.error);
    });
  }

  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" /> Manage status
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Update loan status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canApprove && isPending && (
          <>
            <DropdownMenuItem onClick={() => setStatus("APPROVED")}>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Approve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatus("REJECTED")}>
              <XCircle className="h-4 w-4 text-rose-600" /> Reject
            </DropdownMenuItem>
          </>
        )}
        {canApprove && isApproved && (
          <DropdownMenuItem onClick={() => setStatus("ACTIVE")}>
            <Banknote className="h-4 w-4 text-violet-600" /> Disburse & activate
          </DropdownMenuItem>
        )}
        {canApprove && (status === "ACTIVE" || status === "OVERDUE") && (
          <DropdownMenuItem onClick={() => setStatus("CLOSED")}>
            <Lock className="h-4 w-4 text-slate-500" /> Close loan
          </DropdownMenuItem>
        )}
        {!canApprove && (
          <DropdownMenuItem disabled>Requires admin approval</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
