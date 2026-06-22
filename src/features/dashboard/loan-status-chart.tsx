"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LoanStatusBreakdown } from "@/types";

const COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#3b82f6",
  REJECTED: "#f43f5e",
  ACTIVE: "#10b981",
  CLOSED: "#94a3b8",
  OVERDUE: "#ef4444",
};

export function LoanStatusChart({ data }: { data: LoanStatusBreakdown[] }) {
  const chartData = data.filter((d) => d.count > 0);
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No loans yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width="100%" height={220} className="max-w-[220px]">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="status"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={3}
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status] ?? "#a78bfa"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _n, item) => [
              `${value} loans`,
              String(item?.payload?.status ?? "").toLowerCase(),
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid rgba(120,120,140,0.2)", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1">
        {chartData.map((entry) => (
          <li key={entry.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[entry.status] ?? "#a78bfa" }}
              />
              <span className="capitalize text-muted-foreground">
                {entry.status.toLowerCase()}
              </span>
            </span>
            <span className="font-semibold">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
