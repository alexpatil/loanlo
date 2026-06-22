import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { buildAgreementData } from "@/services/document-data.service";
import { renderAgreement } from "@/services/pdf/documents";
import { getPdfTheme } from "@/services/settings.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const scope = agentScope(user.role as Role, user.id);
  const data = await buildAgreementData(id, scope);
  if (!data) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  const theme = await getPdfTheme(req.nextUrl.searchParams.get("template"));
  const pdf = await renderAgreement(data, theme);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="agreement-${data.loanNumber}.pdf"`,
    },
  });
}
