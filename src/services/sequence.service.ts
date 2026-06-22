import "server-only";
import { prisma } from "@/lib/prisma";
import { buildCode } from "@/lib/utils";

/**
 * Atomically increment a named counter and return the next value.
 * Backed by a single document per sequence — safe under concurrency.
 */
export async function nextSequence(name: string): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { id: name },
    create: { id: name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

export async function nextCustomerCode() {
  const seq = await nextSequence("customer");
  return buildCode("CUS", seq);
}

export async function nextLoanNumber() {
  const seq = await nextSequence("loan");
  const year = new Date().getFullYear();
  return `LN-${year}-${String(seq).padStart(6, "0")}`;
}
