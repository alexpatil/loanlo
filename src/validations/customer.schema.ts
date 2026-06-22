import { z } from "zod";
import { GENDERS, KYC_STATUS } from "@/lib/constants";

const aadhaarRegex = /^\d{12}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const phoneRegex = /^[6-9]\d{9}$/;
const pincodeRegex = /^\d{6}$/;

const optionalString = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const customerSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().regex(phoneRegex, "Enter a valid 10-digit mobile number"),
  alternatePhone: z
    .string()
    .regex(phoneRegex, "Enter a valid 10-digit mobile number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dateOfBirth: z.coerce.date().optional().or(z.literal("").transform(() => undefined)),
  gender: z.enum(GENDERS).optional(),
  occupation: optionalString,
  monthlyIncome: z.coerce.number().nonnegative().optional(),

  aadhaarNumber: z
    .string()
    .regex(aadhaarRegex, "Aadhaar must be 12 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  panNumber: z
    .string()
    .toUpperCase()
    .regex(panRegex, "Enter a valid PAN (e.g. ABCDE1234F)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  kycStatus: z.enum(KYC_STATUS).default("PENDING"),

  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: z
    .string()
    .regex(pincodeRegex, "Pincode must be 6 digits")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  country: z.string().default("India"),

  assignedAgentId: optionalString,
  notes: optionalString,
});

export const updateCustomerSchema = customerSchema.partial().extend({
  id: z.string().min(1),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
