"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleUserActiveAction } from "@/actions/user.actions";
import { Switch } from "@/components/ui/switch";

export function UserActiveToggle({
  userId,
  isActive,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(next: boolean) {
    startTransition(async () => {
      const result = await toggleUserActiveAction(userId, next);
      if (result.success) toast.success(result.message ?? "Updated");
      else toast.error(result.error);
    });
  }

  return (
    <Switch checked={isActive} onCheckedChange={onChange} disabled={pending || disabled} />
  );
}
