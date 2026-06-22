import { z } from "zod";
import {
  LOAN_TYPES,
  INTEREST_PERIODS,
  INTEREST_METHODS,
  REPAYMENT_MODES,
} from "@/lib/constants";

/** Statuses a migrated (already-running or settled) loan can be imported as. */
export const MIGRATION_STATUSES = ["ACTIVE", "OVERDUE", "CLOSED"] as const;

export const historicalCollectionSchema = z.object({
  date: z.coerce.date(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export const migrationSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    loanType: z.enum(LOAN_TYPES).default("EMI"),
    interestPeriod: z.enum(INTEREST_PERIODS).default("MONTHLY"),
    interestMethod: z.enum(INTEREST_METHODS).default("SIMPLE"),
    repaymentMode: z.enum(REPAYMENT_MODES).default("DURATION_BASED"),

    principalAmount: z.coerce
      .number()
      .positive("Amount must be greater than 0")
      .max(100_000_000, "Amount exceeds the limit"),
    interestRate: z.coerce.number().min(0).max(100),
    tenureMonths: z.coerce.number().int().min(1).max(360),
    processingFee: z.coerce.number().min(0).default(0),
    gracePeriodDays: z.coerce.number().int().min(0).max(90).default(0),

    // Historical / register data
    disbursementDate: z.coerce.date().refine((d) => d <= new Date(), {
      message: "Disbursement date can't be in the future",
    }),
    expectedPaymentDate: z.coerce
      .date()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    status: z.enum(MIGRATION_STATUSES).default("ACTIVE"),
    currentOutstanding: z.coerce.number().min(0, "Outstanding can't be negative"),
    totalCollected: z.coerce.number().min(0).default(0),

    historicalCollections: z.array(historicalCollectionSchema).optional().default([]),

    assignedAgentId: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    note: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.currentOutstanding <= d.principalAmount * 2, {
    message: "Outstanding looks too high relative to principal",
    path: ["currentOutstanding"],
  })
  .refine((d) => d.repaymentMode !== "FIXED_DATE" || Boolean(d.expectedPaymentDate), {
    message: "Select an expected payment date",
    path: ["expectedPaymentDate"],
  });

export type MigrationInput = z.infer<typeof migrationSchema>;
export type HistoricalCollectionInput = z.infer<typeof historicalCollectionSchema>;
