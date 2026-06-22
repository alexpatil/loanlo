import { z } from "zod";
import {
  LOAN_STATUS,
  LOAN_TYPES,
  LOAN_KINDS,
  CALCULATION_METHODS,
  DURATION_UNITS,
  INTEREST_PERIODS,
  INTEREST_METHODS,
  REPAYMENT_MODES,
} from "@/lib/constants";

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

/**
 * Simplified loan creation.
 * - EMI loans need principal + annual rate + tenure (months).
 * - Non-EMI loans need principal + calculation method + interest frequency +
 *   duration (value + unit); the rate is per the chosen frequency.
 */
export const loanSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    loanKind: z.enum(LOAN_KINDS).default("EMI"),

    principalAmount: z.coerce
      .number()
      .positive("Amount must be greater than 0")
      .min(1000, "Minimum loan amount is ₹1,000")
      .max(100_000_000, "Amount exceeds the limit"),
    interestRate: z.coerce
      .number()
      .min(0, "Interest rate cannot be negative")
      .max(100, "Interest rate seems too high"),

    // EMI only
    tenureMonths: z.coerce.number().int().min(1).max(360).optional(),

    // Non-EMI only
    calculationMethod: z.enum(CALCULATION_METHODS).optional(),
    interestFrequency: z.enum(INTEREST_PERIODS).optional(),
    durationValue: z.coerce.number().int().min(1).max(3650).optional(),
    durationUnit: z.enum(DURATION_UNITS).optional(),

    // Shared
    processingFee: z.coerce.number().min(0).default(0),
    repaymentMode: z.enum(REPAYMENT_MODES).default("DURATION_BASED"),
    expectedPaymentDate: z.coerce
      .date()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    gracePeriodDays: z.coerce
      .number()
      .int("Grace days must be whole days")
      .min(0, "Grace days cannot be negative")
      .max(90, "Grace days cannot exceed 90 days")
      .default(0),
    purpose: optionalText,
    disbursementDate: z.coerce.date().optional(),
    assignedAgentId: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.loanKind === "EMI") {
      if (!data.tenureMonths) {
        ctx.addIssue({ code: "custom", path: ["tenureMonths"], message: "Enter tenure in months" });
      }
    } else {
      if (!data.calculationMethod)
        ctx.addIssue({ code: "custom", path: ["calculationMethod"], message: "Choose a calculation method" });
      if (!data.interestFrequency)
        ctx.addIssue({ code: "custom", path: ["interestFrequency"], message: "Choose an interest frequency" });
      if (!data.durationValue)
        ctx.addIssue({ code: "custom", path: ["durationValue"], message: "Enter the duration" });
      if (!data.durationUnit)
        ctx.addIssue({ code: "custom", path: ["durationUnit"], message: "Choose a duration unit" });
    }
    if (data.repaymentMode === "FIXED_DATE" && !data.expectedPaymentDate) {
      ctx.addIssue({ code: "custom", path: ["expectedPaymentDate"], message: "Select an expected payment date" });
    }
  });

export const updateLoanStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(LOAN_STATUS),
  disbursementDate: z.coerce.date().optional(),
});

/**
 * Admin loan correction. The customer can't be changed here; financial terms
 * can only be amended while no payments have been collected (enforced server-side).
 */
export const editLoanSchema = z
  .object({
    id: z.string().min(1),
    loanType: z.enum(LOAN_TYPES),
    interestPeriod: z.enum(INTEREST_PERIODS).default("MONTHLY"),
    interestMethod: z.enum(INTEREST_METHODS).default("SIMPLE"),
    repaymentMode: z.enum(REPAYMENT_MODES).default("DURATION_BASED"),
    expectedPaymentDate: z.coerce
      .date()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    gracePeriodDays: z.coerce.number().int().min(0).max(90).default(0),
    principalAmount: z.coerce.number().positive().min(1000).max(100_000_000),
    interestRate: z.coerce.number().min(0).max(100),
    processingFee: z.coerce.number().min(0).default(0),
    tenureMonths: z.coerce.number().int().min(1).max(360),
    disbursementDate: z.coerce
      .date()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    purpose: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    assignedAgentId: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    editReason: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.repaymentMode !== "FIXED_DATE" || Boolean(d.expectedPaymentDate), {
    message: "Select an expected payment date",
    path: ["expectedPaymentDate"],
  });

export type LoanInput = z.infer<typeof loanSchema>;
export type UpdateLoanStatusInput = z.infer<typeof updateLoanStatusSchema>;
export type EditLoanInput = z.infer<typeof editLoanSchema>;
