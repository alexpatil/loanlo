import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  accent?: "violet" | "blue" | "emerald" | "amber" | "rose";
  className?: string;
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  blue: "from-blue-500/15 to-blue-500/5 text-blue-600",
  emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  trend,
  accent = "violet",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-4 transition-shadow hover:shadow-md sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend.positive ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            // Hidden on the smallest screens so the value gets the full card width.
            "hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:flex",
            ACCENTS[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
