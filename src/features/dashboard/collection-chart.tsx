"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CollectionTrendPoint } from "@/types";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";

export function CollectionChart({ data }: { data: CollectionTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="disbFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120,120,140,0.15)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickFormatter={(v) => formatCompactCurrency(v).replace("₹", "₹ ")}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={70}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === "collection" ? "Collection" : "Disbursement",
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(120,120,140,0.2)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="disbursement"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#disbFill)"
        />
        <Area
          type="monotone"
          dataKey="collection"
          stroke="#7c3aed"
          strokeWidth={2.5}
          fill="url(#collectionFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
