import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { getPdfSettings } from "@/services/settings.service";
import { PageHeader } from "@/components/shared/page-header";
import { PdfSettingsForm } from "@/features/settings/pdf-settings-form";

export const metadata: Metadata = { title: "PDF Settings" };

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const settings = await getPdfSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        title="PDF & Branding"
        description="Customize how your loan agreements, receipts, statements and reports look."
      />
      <PdfSettingsForm defaults={settings} />
    </div>
  );
}
