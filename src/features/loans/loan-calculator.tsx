"use client";

import { useMemo, useState } from "react";
import { calculateLoan, generateSchedule, type LoanMethod } from "@/lib/finance";
import {
  projectNonEmi,
  effectiveAnnualRate,
} from "@/lib/interest-engine";
import { cn, formatCurrency, round2 } from "@/lib/utils";
import {
  LOAN_TYPE_LABELS,
  LOAN_TYPE_DESCRIPTIONS,
  CALCULATION_METHODS,
  CALCULATION_METHOD_LABELS,
  CALCULATION_METHOD_DESCRIPTIONS,
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  DURATION_UNITS,
  DURATION_UNIT_LABELS,
  FREQUENCY_TO_UNIT,
  type CalculationMethodKey,
  type InterestPeriodKey,
  type DurationUnitKey,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Singular noun for "Interest per <noun>" / "% per <noun>" copy.
const PERIOD_NOUN: Record<InterestPeriodKey, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

export function LoanCalculator() {
  return (
    <Tabs defaultValue="flexible" className="space-y-1">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="flexible" className="flex-1 sm:flex-none">
          Flexible interest
        </TabsTrigger>
        <TabsTrigger value="emi" className="flex-1 sm:flex-none">
          EMI installments
        </TabsTrigger>
      </TabsList>

      <TabsContent value="flexible">
        <FlexibleCalculator />
      </TabsContent>
      <TabsContent value="emi">
        <EmiCalculator />
      </TabsContent>
    </Tabs>
  );
}

// ─── Flexible (per-period) calculator ────────────────────────────────────────
// Charge interest per day / week / month / year, using flat, reducing or
// compound. This is a single-payment (interest-only) projection — there are no
// fixed installments; the borrower repays the total any time.

function FlexibleCalculator() {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(2);
  const [period, setPeriod] = useState<InterestPeriodKey>("MONTHLY");
  const [method, setMethod] = useState<CalculationMethodKey>("FLAT");
  const [durationValue, setDurationValue] = useState(10);
  const [durationUnit, setDurationUnit] = useState<DurationUnitKey>("MONTHS");

  const noun = PERIOD_NOUN[period];
  const valid = principal > 0 && durationValue > 0 && rate >= 0;

  // Keep the duration unit paired with the interest period by default.
  function selectPeriod(p: InterestPeriodKey) {
    setPeriod(p);
    setDurationUnit(FREQUENCY_TO_UNIT[p]);
  }

  const result = useMemo(() => {
    if (!valid) return null;
    const proj = projectNonEmi({
      principal,
      ratePerPeriod: rate,
      calc: method,
      frequency: period,
      durationValue,
      durationUnit,
    });
    const effAnnual = effectiveAnnualRate(
      rate,
      period,
      method === "COMPOUND" ? "COMPOUND" : "SIMPLE",
    );
    return { ...proj, effAnnual };
  }, [principal, rate, period, method, durationValue, durationUnit, valid]);

  // Per-period accrual breakdown (whole periods, capped so big spans stay sane).
  const ROW_CAP = 60;
  const schedule = useMemo(() => {
    if (!result) return { rows: [] as { n: number; interest: number; balance: number }[], truncated: false };
    const whole = Math.floor(result.periods + 1e-9);
    const cap = Math.min(whole, ROW_CAP);
    const r = rate / 100;
    const rows: { n: number; interest: number; balance: number }[] = [];
    let balance = principal; // compound: grows; flat/reducing: principal + accrued interest
    let accrued = 0;
    for (let i = 1; i <= cap; i++) {
      let interest: number;
      if (method === "COMPOUND") {
        interest = round2(balance * r);
        balance = round2(balance + interest);
      } else {
        // Flat & reducing accrue on the principal when nothing is prepaid.
        interest = round2(principal * r);
        accrued = round2(accrued + interest);
        balance = round2(principal + accrued);
      }
      rows.push({ n: i, interest, balance });
    }
    return { rows, truncated: whole > cap };
  }, [result, principal, rate, method]);

  const flatEqualsReducing = method !== "COMPOUND";

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>What are the terms?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Loan amount (₹)</Label>
                <Input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Interest charged</Label>
                <Select value={period} onValueChange={(v) => selectPeriod(v as InterestPeriodKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {INTEREST_PERIOD_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rate (% per {noun})</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>How is interest calculated?</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {CALCULATION_METHODS.map((m) => {
                  const active = method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all",
                        active
                          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                          : "border-border hover:border-violet-200 hover:bg-accent",
                      )}
                    >
                      <p className="font-semibold">{CALCULATION_METHOD_LABELS[m]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {CALCULATION_METHOD_DESCRIPTIONS[m]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Loan duration</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  className="w-28"
                  value={durationValue}
                  onChange={(e) => setDurationValue(Number(e.target.value))}
                />
                <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnitKey)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {DURATION_UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">e.g. 30 Days · 8 Weeks · 10 Months · 2 Years</p>
            </div>
          </CardContent>
        </Card>

        {/* Per-period accrual */}
        {result && schedule.rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>How the interest adds up</CardTitle>
              <p className="text-sm text-muted-foreground">
                Interest each {noun}, and the running total to repay.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{noun.charAt(0).toUpperCase() + noun.slice(1)} #</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Total to repay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.rows.map((row) => (
                    <TableRow key={row.n}>
                      <TableCell data-label={`${noun} #`} className="max-md:font-semibold">{row.n}</TableCell>
                      <TableCell data-label="Interest" className="text-right">{formatCurrency(row.interest)}</TableCell>
                      <TableCell data-label="Total to repay" className="text-right font-medium">
                        {formatCurrency(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {schedule.truncated && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing the first {ROW_CAP} {noun}s — see the totals on the right for the full term.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Result */}
      <Card className="sticky top-20 h-fit bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <CardHeader>
          <CardTitle className="text-white">Repayment summary</CardTitle>
          <p className="text-sm text-white/70">
            {CALCULATION_METHOD_LABELS[method]} · {INTEREST_PERIOD_LABELS[period].toLowerCase()}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <>
              <div>
                <p className="text-sm text-white/70">Total to repay</p>
                <p className="text-3xl font-bold">{formatCurrency(result.totalPayable)}</p>
                <p className="mt-1 text-xs text-white/70">
                  {round2(result.periods)} {noun} period{result.periods === 1 ? "" : "s"} · {result.durationDays} days
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Loan amount" value={formatCurrency(principal)} />
                <Row label="Total interest" value={formatCurrency(result.totalInterest)} />
                <Row label={`Rate per ${noun}`} value={`${rate}%`} />
                <Row label="Effective annual rate" value={`${result.effAnnual}%`} />
                <div className="my-2 h-px bg-white/20" />
                <Row label="Total to repay" value={formatCurrency(result.totalPayable)} bold />
              </div>
              {flatEqualsReducing && (
                <p className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80">
                  Flat and Reducing match here — they differ only when the borrower
                  makes part-payments early. Try the EMI tab to see that difference.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-white/70">Enter an amount and duration to see the summary.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/70">{label}</span>
      <span className={bold ? "text-base font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}

// ─── EMI / installment calculator ────────────────────────────────────────────
// Fixed monthly installments. Compares the three fixed-schedule methods.

const INSTALLMENT_METHODS: LoanMethod[] = ["EMI", "FLAT_INTEREST", "REDUCING_BALANCE"];

function EmiCalculator() {
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
                  <TableCell data-label="No." className="max-md:font-semibold">{s.installmentNumber}</TableCell>
                  <TableCell data-label="EMI" className="font-medium">{formatCurrency(s.emiAmount)}</TableCell>
                  <TableCell data-label="Principal">{formatCurrency(s.principalComponent)}</TableCell>
                  <TableCell data-label="Interest">{formatCurrency(s.interestComponent)}</TableCell>
                  <TableCell data-label="Balance" className="text-muted-foreground">
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
