import { z } from "zod";
import { PDF_TEMPLATE_KEYS } from "@/lib/constants";

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const pdfSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  address: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  footerText: optionalText,
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6d28d9")
    .default("#6d28d9"),
  // Image URL or data URI (kept as text — no external storage required).
  logoUrl: optionalText,
  signatureUrl: optionalText,
  defaultTemplate: z.enum(PDF_TEMPLATE_KEYS).default("CLASSIC"),
});

export type PdfSettingsInput = z.infer<typeof pdfSettingsSchema>;
