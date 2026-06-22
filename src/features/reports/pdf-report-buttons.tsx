"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function PdfReportButtons() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="font-semibold">Daily Collection Report</h3>
          <p className="text-sm text-muted-foreground">PDF of all collections for a day.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button asChild variant="gradient" className="w-fit">
          <a href={`/api/reports/daily?date=${date}`} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </Button>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="font-semibold">Monthly Collection Report</h3>
          <p className="text-sm text-muted-foreground">PDF summary for a calendar month.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <Button asChild variant="gradient" className="w-fit">
          <a href={`/api/reports/monthly?month=${month}`} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </Button>
      </Card>
    </div>
  );
}
