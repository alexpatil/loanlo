"use client";

import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { CustomerInput } from "@/validations/customer.schema";
import { deleteCustomerAction } from "@/actions/customer.actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CustomerFormDialog } from "./customer-form-dialog";

interface Props {
  customer: Partial<CustomerInput> & { id: string };
  canEdit?: boolean;
  canDelete?: boolean;
  agents?: { id: string; name: string }[];
  canAssign?: boolean;
}

export function CustomerRowActions({
  customer,
  canEdit,
  canDelete,
  agents,
  canAssign,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/customers/${customer.id}`}>
            <Eye className="h-4 w-4" /> View profile
          </Link>
        </DropdownMenuItem>
        {canEdit && (
          <CustomerFormDialog
            customer={customer}
            agents={agents}
            canAssign={canAssign}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
            }
          />
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Delete customer?"
              description="This will archive the customer record. Loans linked to them are retained."
              confirmLabel="Delete"
              destructive
              onConfirm={() => deleteCustomerAction(customer.id)}
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              }
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
