import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import type { Role } from "@prisma/client";
import { requireAuth } from "@/lib/session";
import { agentScope } from "@/lib/action-utils";
import { can } from "@/lib/rbac";
import { listCustomers } from "@/services/customer.service";
import { getAgentOptions } from "@/services/user.service";
import { formatDate, getInitials } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { CustomerRowActions } from "@/features/customers/customer-row-actions";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await requireAuth();
  const role = user.role as Role;
  const scope = agentScope(role, user.id);
  const sp = await searchParams;

  const [data, agents] = await Promise.all([
    listCustomers({
      search: sp.search,
      page: Number(sp.page) || 1,
      scopeAgentId: scope,
    }),
    can(role, "user:assign") ? getAgentOptions() : Promise.resolve([]),
  ]);

  const canAssign = can(role, "user:assign");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Manage borrowers, KYC details and assignments."
        actions={<CustomerFormDialog agents={agents} canAssign={canAssign} />}
      />

      <Card className="p-4">
        <div className="mb-4">
          <SearchInput placeholder="Search by name, code or phone…" />
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your first customer to start originating loans."
            action={<CustomerFormDialog agents={agents} canAssign={canAssign} />}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Loans</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {getInitials(`${c.firstName} ${c.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium hover:text-violet-600">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.customerCode}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.phone}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.kycStatus} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.assignedAgent?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{c._count?.loans ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <CustomerRowActions
                        customer={{
                          id: c.id,
                          firstName: c.firstName,
                          lastName: c.lastName,
                          phone: c.phone,
                          email: c.email ?? undefined,
                          aadhaarNumber: c.aadhaarNumber ?? undefined,
                          panNumber: c.panNumber ?? undefined,
                          kycStatus: c.kycStatus,
                          addressLine1: c.addressLine1 ?? undefined,
                          city: c.city ?? undefined,
                          state: c.state ?? undefined,
                          pincode: c.pincode ?? undefined,
                          occupation: c.occupation ?? undefined,
                          notes: c.notes ?? undefined,
                        }}
                        canEdit={can(role, "customer:write")}
                        canDelete={can(role, "customer:delete")}
                        agents={agents}
                        canAssign={canAssign}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} />
          </>
        )}
      </Card>
    </div>
  );
}
