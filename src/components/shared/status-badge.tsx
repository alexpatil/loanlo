import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "@/lib/constants";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className,
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
