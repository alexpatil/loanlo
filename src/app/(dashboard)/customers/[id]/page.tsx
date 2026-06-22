import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  CreditCard,
  Briefcase,
  FileText,
  Banknote,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { getCustomerById } from "@/services/customer.service";
import { formatCurrency, formatDate, getInitials, maskAadhaar } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const scope = agentScope(user.role as Role, user.id);
  const { id } = await params;

  const customer = await getCustomerById(id, scope);
  if (!customer) notFound();

  const fullName = `${customer.firstName} ${customer.lastName}`;
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.state,
    customer.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/customers">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
      </Button>

      <PageHeader title={fullName} description={customer.customerCode} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 text-lg">
                <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-lg font-semibold">{fullName}</h2>
              <div className="mt-2">
                <StatusBadge status={customer.kycStatus} />
              </div>
            </div>
            <Separator className="my-5" />
            <div className="space-y-4">
              <InfoRow icon={Phone} label="Phone" value={customer.phone} />
              <InfoRow icon={Mail} label="Email" value={customer.email} />
              <InfoRow icon={Briefcase} label="Occupation" value={customer.occupation} />
              <InfoRow
                icon={Banknote}
                label="Monthly income"
                value={customer.monthlyIncome ? formatCurrency(customer.monthlyIncome) : "—"}
              />
              <InfoRow icon={MapPin} label="Address" value={address} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          {/* KYC */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> KYC information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={CreditCard} label="Aadhaar" value={maskAadhaar(customer.aadhaarNumber)} />
              <InfoRow icon={CreditCard} label="PAN" value={customer.panNumber} />
              <InfoRow icon={Briefcase} label="Assigned agent" value={customer.assignedAgent?.name} />
              <InfoRow icon={FileText} label="Added on" value={formatDate(customer.createdAt)} />
            </CardContent>
          </Card>

          {/* Loans */}
          <Card>
            <CardHeader>
              <CardTitle>Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.loans.length === 0 ? (
                <EmptyState
                  icon={Banknote}
                  title="No loans"
                  description="This customer has no loans yet."
                  action={
                    <Button asChild variant="gradient">
                      <Link href={`/loans/new?customerId=${customer.id}`}>Create loan</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {customer.loans.map((loan) => (
                    <li key={loan.id}>
                      <Link
                        href={`/loans/${loan.id}`}
                        className="flex items-center justify-between gap-4 py-3 hover:opacity-80"
                      >
                        <div>
                          <p className="text-sm font-medium">{loan.loanNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(loan.principalAmount)} · {loan.tenureMonths} months
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            {formatCurrency(loan.emiAmount)}/mo
                          </span>
                          <StatusBadge status={loan.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.documents.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents"
                  description="Uploaded KYC documents will appear here."
                />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {customer.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <FileText className="h-5 w-5 text-violet-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {doc.type.toLowerCase().replace(/_/g, " ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
