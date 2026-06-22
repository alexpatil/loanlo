import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { can } from "@/lib/rbac";
import { buildMonthlyReport } from "@/services/document-data.service";
import { renderReport } from "@/services/pdf/documents";
import { getPdfTheme } from "@/services/settings.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.role as Role, "report:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Accepts ?month=YYYY-MM (defaults to current month).
  const monthParam = req.nextUrl.searchParams.get("month");
  const date = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  const scope = agentScope(user.role as Role, user.id);

  const data = await buildMonthlyReport(date, scope);
  const theme = await getPdfTheme(req.nextUrl.searchParams.get("template"));
  const pdf = await renderReport(data, theme);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="monthly-report-${monthParam ?? "current"}.pdf"`,
    },
  });
}
