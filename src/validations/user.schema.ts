import { z } from "zod";

export const ROLE_ENUM = ["SUPER_ADMIN", "ADMIN", "AGENT"] as const;

export const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  role: z.enum(ROLE_ENUM).default("AGENT"),
});

export const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(ROLE_ENUM).optional(),
  isActive: z.boolean().optional(),
});

export const assignSchema = z.object({
  entityId: z.string().min(1),
  agentId: z.string().min(1),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
