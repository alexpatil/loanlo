import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { requireRole } from "@/lib/session";
import { listUsers } from "@/services/user.service";
import { formatDate, getInitials } from "@/lib/utils";
import { ROLE_LABELS, type RoleKey } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { CreateAgentDialog } from "@/features/admin/create-agent-dialog";
import { UserActiveToggle } from "@/features/admin/user-active-toggle";

export const metadata: Metadata = { title: "Team" };

export default async function AgentsPage() {
  const actor = await requireRole("ADMIN");
  const users = await listUsers();
  const isSuperAdmin = actor.role === "SUPER_ADMIN";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description="Manage agents and administrators."
        actions={<CreateAgentDialog canCreateAdmin={isSuperAdmin} />}
      />

      <Card className="p-4">
        {users.length === 0 ? (
          <EmptyState icon={UserCog} title="No team members" description="Add your first agent." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Loans</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Role">
                    <Badge variant={u.role === "AGENT" ? "secondary" : "default"}>
                      {ROLE_LABELS[u.role as RoleKey]}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Customers" className="text-sm">{u._count.assignedCustomers}</TableCell>
                  <TableCell data-label="Loans" className="text-sm">{u._count.assignedLoans}</TableCell>
                  <TableCell data-label="Joined" className="text-sm text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell data-label="Active" className="text-right">
                    <UserActiveToggle
                      userId={u.id}
                      isActive={u.isActive}
                      disabled={u.id === actor.id || (u.role === "SUPER_ADMIN" && !isSuperAdmin)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
