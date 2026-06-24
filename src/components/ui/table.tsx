import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive table: a real table at `md` and up, and a stacked card list below
 * `md` (no horizontal scrolling on phones). On mobile each row becomes a card
 * and each cell shows its column name from the `data-label` attribute, e.g.
 * `<TableCell data-label="Amount">…</TableCell>`.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full md:overflow-x-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm max-md:block", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("max-md:hidden [&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("max-md:block md:[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors data-[state=selected]:bg-muted md:border-b md:border-border/60 md:hover:bg-muted/50",
      "max-md:mb-3 max-md:block max-md:rounded-xl max-md:border max-md:border-border/60 max-md:bg-card max-md:p-4 max-md:shadow-sm max-md:last:mb-0",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3 align-middle",
      // Mobile card row: "Label ............ value", label from data-label.
      "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:px-0 max-md:py-2 max-md:text-right",
      "max-md:before:shrink-0 max-md:before:text-left max-md:before:text-xs max-md:before:font-medium max-md:before:uppercase max-md:before:tracking-wide max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]",
      // Cells with no data-label become a left-aligned title row (no label shown).
      "max-md:[&:not([data-label])]:justify-start max-md:[&:not([data-label])]:text-left max-md:[&:not([data-label])]:before:hidden",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
