"use client";

import { Logo } from "@/components/shared/logo";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUIStore } from "@/hooks/use-ui-store";
import type { Role } from "@prisma/client";
import { Menu } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

interface AppShellProps {
  user: { name: string; email: string; image?: string | null; role: string };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const mobileOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileNavOpen);
  const role = user.role as Role;

  return (
    <div className="app-gradient min-h-screen">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl lg:flex">
          <div className="flex h-16 items-center border-b border-border/60 px-5">
            <Logo />
          </div>
          <SidebarNav role={role} />
          <div className="border-t border-border/60 p-3 text-xs text-muted-foreground">
            <p className="px-2">Loanlo v1.2.4</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl lg:px-8">
            <div className="flex items-center gap-3">
              <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
                <DialogTrigger className="rounded-lg p-2 hover:bg-accent lg:hidden">
                  <Menu className="h-5 w-5" />
                </DialogTrigger>
                <DialogContent className="left-0 top-0 h-screen max-w-72 translate-x-0 translate-y-0 rounded-none rounded-r-2xl p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                  <DialogTitle className="sr-only">Navigation</DialogTitle>
                  <div className="flex h-16 items-center border-b border-border/60 px-5">
                    <Logo />
                  </div>
                  <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
                </DialogContent>
              </Dialog>
              <div className="lg:hidden">
                <Logo showText={false} />
              </div>
            </div>
            <UserMenu user={user} />
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
