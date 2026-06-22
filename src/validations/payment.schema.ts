import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

export const paymentSchema = z.object({
  loanId: z.string().min(1, "Loan is required"),
  emiScheduleId: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
  paymentDate: z.coerce.date().default(() => new Date()),
  reference: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
