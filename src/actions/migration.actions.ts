"use server";

import { revalidatePath } from "next/cache";
import { migrationSchema } from "@/validations/migration.schema";
import { migrateLoan } from "@/services/migration.service";
import { logActivity } from "@/services/activity-log.service";
import {
  requireActionPermission,
  parseInput,
  ok,
  runAction,
} from "@/lib/action-utils";

export async function migrateLoanAction(input: unknown) {
  return runAction(async () => {
    // Importing historical loans is an elevated operation.
    const user = await requireActionPermission("loan:approve");
    const parsed = parseInput(migrationSchema, input);
    if (!parsed.ok) return parsed.result;

    const loan = await migrateLoan(parsed.data, user.id);

    await logActivity({
      userId: user.id,
      action: "MIGRATE",
      entity: "Loan",
      entityId: loan.id,
      description: `Migrated loan ${loan.loanNumber} (${parsed.data.historicalCollections?.length ?? 0} historical collections)`,
    });

    revalidatePath("/loans");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return ok({ id: loan.id }, "Loan migrated successfully.");
  });
}
