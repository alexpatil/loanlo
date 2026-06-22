import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="app-gradient flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <ShieldX className="h-8 w-8" />
      </span>
      <h1 className="mt-6 text-2xl font-bold">Access denied</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        You don&apos;t have permission to view this page. Contact your administrator
        if you believe this is a mistake.
      </p>
      <Button asChild variant="gradient" className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
