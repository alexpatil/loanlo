import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className merge used by all UI primitives. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees. */
export function formatCurrency(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    ...opts,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Compact currency, e.g. ₹1.2L, ₹3.4Cr. */
export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** "JD" from "John Doe". */
export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Build a stable, padded sequence code, e.g. CUS-000123. */
export function buildCode(prefix: string, sequence: number, pad = 6) {
  return `${prefix}-${String(sequence).padStart(pad, "0")}`;
}

export function maskAadhaar(aadhaar?: string | null) {
  if (!aadhaar) return "—";
  const digits = aadhaar.replace(/\s/g, "");
  if (digits.length < 4) return digits;
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function isOverdue(dueDate: Date | string, isPaid: boolean) {
  if (isPaid) return false;
  return new Date(dueDate) < new Date();
}

/** Round to 2 decimals to avoid floating point drift on money. */
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
