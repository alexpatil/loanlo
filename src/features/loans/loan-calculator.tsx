"use client";

import { useMemo, useState } from "react";
import { calculateLoan, generateSchedule, type LoanMethod } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";
import { LOAN_TYPE_LABELS, LOAN_TYPE_DESCRIPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// The calculator compares the three fixed-schedule methods. FLEXIBLE_LOAN is
// time-based and previewed on the loan form / detail page instead.
const INSTALLMENT_METHODS: LoanMethod[] = ["EMI", "FLAT_INTEREST", "REDUCING_BALANCE"];

export function LoanCalculator() {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(18);
  const [tenure, setTenure] = useState(12);
  const [selected, setSelected] = useState<LoanMethod>("EMI");

  const valid = principal > 0 && tenure > 0;

  const results = useMemo(() => {
    if (!valid) return null;
    const terms = { principal, annualInterestRate: rate, tenureMonths: tenure };
    return Object.fromEntries(
      INSTALLMENT_METHODS.map((t) => [t, calculateLoan(terms, t)]),
    ) as Record<LoanMethod, ReturnType<typeof calculateLoan>>;
  }, [principal, rate, tenure, valid]);

  const schedule = useMemo(() => {
    if (!valid) return [];
    return generateSchedule(
      { principal, annualInterestRate: rate, tenureMonths: tenure },
      selected,
      new Date(),
    );
  }, [principal, rate, tenure, selected, valid]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Principal (₹)</Label>
              <Input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest rate (% p.a.)</Label>
              <Input
                type="number"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tenure (months)</Label>
              <Input
                type="number"
                value={tenure}
                onChange={(e) => setTenure(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Method comparison */}
      <div className="grid gap-4 lg:grid-cols-3">
        {INSTALLMENT_METHODS.map((t) => {
          const r = results?.[t];
          const active = selected === t;
          return (
            <button key={t} type="button" onClick={() => setSelected(t)} className="text-left">
              <Card
                className={cn(
                  "h-full p-5 transition-all",
                  active
                    ? "border-violet-400 bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg"
                    : "hover:border-violet-200 hover:shadow-md",
                )}
              >
                <p className={cn("text-sm font-semibold", active && "text-white")}>
                  {LOAN_TYPE_LABELS[t]}
                </p>
                <p className={cn("mt-3 text-2xl font-bold", active ? "text-white" : "")}>
                  {r ? formatCurrency(r.emiAmount) : "—"}
                  <span className={cn("text-sm font-normal", active ? "text-white/70" : "text-muted-foreground")}>
                    {" "}/mo
                  </span>
                </p>
                <dl className={cn("mt-4 space-y-1.5 text-sm", active ? "text-white/80" : "text-muted-foreground")}>
                  <div className="flex justify-between">
                    <dt>Total interest</dt>
                    <dd className="font-medium">{r ? formatCurrency(r.totalInterest) : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Total payable</dt>
                    <dd className="font-medium">{r ? formatCurrency(r.totalPayable) : "—"}</dd>
                  </div>
                </dl>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Schedule preview for the selected method */}
      <Card>
        <CardHeader>
          <CardTitle>{LOAN_TYPE_LABELS[selected]} — projected schedule</CardTitle>
          <p className="text-sm text-muted-foreground">{LOAN_TYPE_DESCRIPTIONS[selected]}</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>EMI</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((s) => (
                <TableRow key={s.installmentNumber}>
                  <TableCell>{s.installmentNumber}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.emiAmount)}</TableCell>
                  <TableCell>{formatCurrency(s.principalComponent)}</TableCell>
                  <TableCell>{formatCurrency(s.interestComponent)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrency(s.remainingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
