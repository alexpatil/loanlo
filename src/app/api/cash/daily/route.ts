import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { buildDailyCashReport } from "@/services/document-data.service";
import { renderCashBook } from "@/services/pdf/documents";
import { getPdfTheme } from "@/services/settings.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.role as Role, "cash:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();

  const data = await buildDailyCashReport(date);
  const theme = await getPdfTheme(req.nextUrl.searchParams.get("template"));
  const pdf = await renderCashBook(data, theme);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="daily-cash-${date.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
