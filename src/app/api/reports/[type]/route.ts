import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { can } from "@/lib/rbac";
import { toCsv } from "@/lib/csv";
import {
  getLoanReport,
  getCollectionReport,
  getCustomerReport,
} from "@/services/report.service";
import { formatDate } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user.role as Role, "report:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type } = await params;
  const scope = agentScope(user.role as Role, user.id);
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;

  let csv = "";

  switch (type) {
    case "loans": {
      const loans = await getLoanReport({ from, to, scopeAgentId: scope });
      csv = toCsv(
        loans.map((l) => ({
          loanNumber: l.loanNumber,
          customer: `${l.customer.firstName} ${l.customer.lastName}`,
          customerCode: l.customer.customerCode,
          phone: l.customer.phone,
          loanType: l.loanType,
          migrated: l.isMigrated ? "Yes" : "No",
          principal: l.principalAmount,
          outstanding: l.outstandingPrincipal,
          interestRate: l.interestRate,
          emi: l.emiAmount,
          tenure: l.tenureMonths,
          gracePeriodDays: l.gracePeriodDays,
          status: l.status,
          agent: l.assignedAgent?.name ?? "",
          disbursedOn: l.disbursementDate ? formatDate(l.disbursementDate) : "",
        })),
        [
          { key: "loanNumber", header: "Loan Number" },
          { key: "customer", header: "Customer" },
          { key: "customerCode", header: "Customer Code" },
          { key: "phone", header: "Phone" },
          { key: "loanType", header: "Loan Type" },
          { key: "migrated", header: "Migrated" },
          { key: "principal", header: "Principal" },
          { key: "outstanding", header: "Outstanding" },
          { key: "interestRate", header: "Interest %" },
          { key: "emi", header: "EMI" },
          { key: "tenure", header: "Tenure (mo)" },
          { key: "gracePeriodDays", header: "Grace (days)" },
          { key: "status", header: "Status" },
          { key: "agent", header: "Agent" },
          { key: "disbursedOn", header: "Disbursed On" },
        ],
      );
      break;
    }
    case "collections": {
      const payments = await getCollectionReport({ from, to, scopeAgentId: scope });
      csv = toCsv(
        payments.map((p) => ({
          date: formatDate(p.paymentDate),
          loanNumber: p.loan.loanNumber,
          customer: `${p.customer.firstName} ${p.customer.lastName}`,
          amount: p.amount,
          principal: p.principalAmount,
          interest: p.interestAmount,
          penalty: p.penaltyAmount,
          method: p.paymentMethod,
          collectedBy: p.collectedBy?.name ?? "",
        })),
        [
          { key: "date", header: "Date" },
          { key: "loanNumber", header: "Loan Number" },
          { key: "customer", header: "Customer" },
          { key: "amount", header: "Amount" },
          { key: "principal", header: "Principal" },
          { key: "interest", header: "Interest" },
          { key: "penalty", header: "Penalty" },
          { key: "method", header: "Method" },
          { key: "collectedBy", header: "Collected By" },
        ],
      );
      break;
    }
    case "customers": {
      const customers = await getCustomerReport(scope);
      csv = toCsv(
        customers.map((c) => ({
          code: c.customerCode,
          name: `${c.firstName} ${c.lastName}`,
          phone: c.phone,
          email: c.email ?? "",
          kyc: c.kycStatus,
          city: c.city ?? "",
          loans: c._count.loans,
          agent: c.assignedAgent?.name ?? "",
        })),
        [
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "phone", header: "Phone" },
          { key: "email", header: "Email" },
          { key: "kyc", header: "KYC" },
          { key: "city", header: "City" },
          { key: "loans", header: "Loans" },
          { key: "agent", header: "Agent" },
        ],
      );
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-report-${Date.now()}.csv"`,
    },
  });
}
