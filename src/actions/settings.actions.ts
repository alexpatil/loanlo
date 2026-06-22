"use server";

import { revalidatePath } from "next/cache";
import { pdfSettingsSchema } from "@/validations/settings.schema";
import { updatePdfSettings } from "@/services/settings.service";
import { logActivity } from "@/services/activity-log.service";
import {
  requireActionPermission,
  parseInput,
  ok,
  runAction,
} from "@/lib/action-utils";

export async function updatePdfSettingsAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionPermission("settings:manage");
    const parsed = parseInput(pdfSettingsSchema, input);
    if (!parsed.ok) return parsed.result;

    await updatePdfSettings(parsed.data);

    await logActivity({
      userId: user.id,
      action: "UPDATE",
      entity: "PdfSettings",
      description: `Updated PDF branding (template ${parsed.data.defaultTemplate})`,
    });

    revalidatePath("/settings");
    return ok(null, "Branding saved.");
  });
}
