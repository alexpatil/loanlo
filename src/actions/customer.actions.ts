"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { customerSchema, updateCustomerSchema } from "@/validations/customer.schema";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/services/customer.service";
import { nextCustomerCode } from "@/services/sequence.service";
import { logActivity } from "@/services/activity-log.service";
import {
  getActionUser,
  requireActionPermission,
  parseInput,
  ok,
  fail,
  runAction,
} from "@/lib/action-utils";

export async function createCustomerAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("customer:write");
    const parsed = parseInput(customerSchema, input);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    const customerCode = await nextCustomerCode();
    const customer = await createCustomer({
      customerCode,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      alternatePhone: data.alternatePhone,
      dateOfBirth: data.dateOfBirth as Date | undefined,
      gender: data.gender,
      occupation: data.occupation,
      monthlyIncome: data.monthlyIncome,
      aadhaarNumber: data.aadhaarNumber,
      panNumber: data.panNumber,
      kycStatus: data.kycStatus,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country ?? "India",
      notes: data.notes,
      createdBy: { connect: { id: user.id } },
      // AGENTs own the customers they create unless an admin assigns otherwise.
      assignedAgent: {
        connect: { id: data.assignedAgentId ?? user.id },
      },
    });

    await logActivity({
      userId: user.id,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      description: `Created customer ${customer.customerCode}`,
    });

    revalidatePath("/customers");
    return ok(customer, "Customer created successfully.");
  });
}

export async function updateCustomerAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("customer:write");
    const parsed = parseInput(updateCustomerSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, assignedAgentId, ...rest } = parsed.data;

    const customer = await updateCustomer(id, {
      ...rest,
      ...(assignedAgentId ? { assignedAgent: { connect: { id: assignedAgentId } } } : {}),
    });

    await logActivity({
      userId: user.id,
      action: "UPDATE",
      entity: "Customer",
      entityId: id,
      description: `Updated customer ${customer.customerCode}`,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return ok(customer, "Customer updated.");
  });
}

export async function deleteCustomerAction(id: string) {
  return runAction(async () => {
    const user = await requireActionPermission("customer:delete");
    if (!id) return fail("Customer id is required.");

    await deleteCustomer(id);
    await logActivity({
      userId: user.id,
      action: "DELETE",
      entity: "Customer",
      entityId: id,
      description: `Deleted customer ${id}`,
    });

    revalidatePath("/customers");
    return ok(null, "Customer deleted.");
  });
}

export async function assignCustomerAction(customerId: string, agentId: string) {
  return runAction(async () => {
    const user = await requireActionPermission("user:assign");
    await updateCustomer(customerId, { assignedAgent: { connect: { id: agentId } } });
    await logActivity({
      userId: user.id,
      action: "ASSIGN",
      entity: "Customer",
      entityId: customerId,
      description: `Assigned customer to agent ${agentId}`,
    });
    revalidatePath("/customers");
    return ok(null, "Customer reassigned.");
  });
}

/** Used by client selects to know the current user's scope. */
export async function getViewerScope(): Promise<{ role: Role; id: string }> {
  const user = await getActionUser();
  return { role: user.role as Role, id: user.id };
}
