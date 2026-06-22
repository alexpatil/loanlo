"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshOverdueAction } from "@/actions/loan.actions";
import { Button } from "@/components/ui/button";

export function RefreshOverdueButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshOverdueAction();
      if (result.success) toast.success(result.message ?? "Refreshed");
      else toast.error(result.error);
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      Refresh overdue
    </Button>
  );
}
