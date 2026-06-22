import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getActivityLogs } from "@/services/activity-log.service";
import { formatDateTime, getInitials } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";

export const metadata: Metadata = { title: "Activity Logs" };

export default async function ActivityPage() {
  await requireRole("ADMIN");
  const logs = await getActivityLogs(100);

  return (
    <div className="space-y-5">
      <PageHeader title="Activity Logs" description="Audit trail of all key actions." />

      <Card className="p-4">
        {logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity yet" description="Actions will be logged here." />
        ) : (
          <ul className="space-y-1">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {log.user ? getInitials(log.user.name) : "SY"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{log.user?.name ?? "System"}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{log.entity}</span>
                  </div>
                  {log.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{log.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
