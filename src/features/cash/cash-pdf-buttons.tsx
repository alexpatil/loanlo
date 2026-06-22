"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CashPdfButtons() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex items-end gap-2">
        <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button asChild variant="outline">
          <a href={`/api/cash/daily?date=${date}`} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> Daily Cash PDF
          </a>
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <Input type="month" className="w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button asChild variant="outline">
          <a href={`/api/cash/monthly?month=${month}`} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> Monthly Cash PDF
          </a>
        </Button>
      </div>
    </div>
  );
}
