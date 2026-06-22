import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { buildCashBookReport } from "@/services/document-data.service";
import { renderCashBook } from "@/services/pdf/documents";
import { getPdfTheme } from "@/services/settings.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.role as Role, "cash:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
  const to = searchParams.get("to") ? new Date(`${searchParams.get("to")!}T23:59:59`) : undefined;

  const data = await buildCashBookReport(from, to);
  const theme = await getPdfTheme(req.nextUrl.searchParams.get("template"));
  const pdf = await renderCashBook(data, theme);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cash-book.pdf"`,
    },
  });
}
