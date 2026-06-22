import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getPdfTheme } from "@/services/settings.service";
import {
  renderAgreement,
  renderReceipt,
  renderStatement,
  renderReport,
} from "@/services/pdf/documents";

export const runtime = "nodejs";

const TODAY = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Renders a SAMPLE document with the current branding and the requested
 * template — lets admins preview a template before saving / downloading.
 * /api/pdf/preview?type=agreement|receipt|statement|daily&template=MODERN
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.role as Role, "settings:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "agreement";
  const theme = await getPdfTheme(req.nextUrl.searchParams.get("template"));

  let pdf: Buffer;
  switch (type) {
    case "receipt":
      pdf = await renderReceipt(
        {
          receiptNo: "RCPT-SAMPLE01",
          date: TODAY,
          customerName: "Ramesh Kumar",
          loanNumber: "LN-2026-000001",
          amount: 5000,
          method: "CASH",
          principal: 4200,
          interest: 800,
          penalty: 0,
          outstandingAfter: 45000,
          collectedBy: user.name,
        },
        theme,
      );
      break;
    case "statement":
      pdf = await renderStatement(
        {
          loanNumber: "LN-2026-000001",
          customerName: "Ramesh Kumar",
          generatedAt: TODAY,
          loanTypeLabel: "EMI Loan",
          summary: { principal: 50000, charged: 9000, paid: 14000, outstanding: 45000 },
          lines: [
            { date: TODAY, description: "Loan disbursed (total payable)", debit: "INR 59,000", credit: "", balance: "INR 59,000" },
            { date: TODAY, description: "Payment (cash)", debit: "", credit: "INR 5,000", balance: "INR 54,000" },
            { date: TODAY, description: "Payment (upi)", debit: "", credit: "INR 9,000", balance: "INR 45,000" },
          ],
        },
        theme,
      );
      break;
    case "daily":
      pdf = await renderReport(
        {
          title: "Daily Report",
          periodLabel: TODAY,
          generatedAt: TODAY,
          rows: [
            { date: TODAY, loanNumber: "LN-2026-000001", customer: "Ramesh Kumar", amount: "₹5,000", method: "cash", collectedBy: user.name },
            { date: TODAY, loanNumber: "LN-2026-000002", customer: "Sita Devi", amount: "₹3,200", method: "upi", collectedBy: user.name },
          ],
          totals: { count: 2, amount: 8200, principal: 6800, interest: 1400, penalty: 0 },
        },
        theme,
      );
      break;
    default:
      pdf = await renderAgreement(
        {
          loanNumber: "LN-2026-000001",
          date: TODAY,
          loanTypeLabel: "EMI Loan",
          customer: {
            name: "Ramesh Kumar",
            code: "CUS-000001",
            phone: "9876543210",
            address: "12, Main Road, Pune, Maharashtra, 411001",
            aadhaar: "XXXX XXXX 1234",
            pan: "ABCDE1234F",
          },
          terms: {
            principal: 50000,
            rateLabel: "18% p.a.",
            tenureMonths: 12,
            emiAmount: 4584,
            processingFee: 500,
            totalInterest: 5008,
            totalPayable: 55008,
            gracePeriodDays: 5,
            disbursementDate: TODAY,
            maturityDate: TODAY,
          },
        },
        theme,
      );
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-${type}-${theme.template}.pdf"`,
    },
  });
}
