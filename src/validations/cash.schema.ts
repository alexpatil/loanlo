import { z } from "zod";
import { MANUAL_CASH_TYPES } from "@/lib/constants";

export const cashEntrySchema = z.object({
  type: z.enum(MANUAL_CASH_TYPES),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0")
    .max(1_000_000_000, "Amount exceeds the limit"),
  note: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  transactionDate: z.coerce.date().default(() => new Date()),
});

export type CashEntryInput = z.infer<typeof cashEntrySchema>;
