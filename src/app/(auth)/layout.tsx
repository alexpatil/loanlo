import { Logo } from "@/components/shared/logo";
import { ShieldCheck, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-gradient min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Brand / marketing panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-700" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative z-10">
          <Logo className="text-white [&_span:last-child]:text-white" href="/" />
        </div>

        <div className="relative z-10 max-w-md space-y-8 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            Lending operations, beautifully under control.
          </h1>
          <p className="text-white/80">
            Originate loans, generate EMI schedules, track collections and
            measure profitability — all from one premium dashboard.
          </p>
          <ul className="space-y-4 text-sm">
            {[
              { icon: TrendingUp, text: "Real-time collection & disbursement analytics" },
              { icon: Users, text: "Role-based access for admins and field agents" },
              { icon: ShieldCheck, text: "KYC-ready customer profiles and audit logs" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} Loanlo. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo href="/" />
          </div>
          {children}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing you agree to Loanlo&apos;s{" "}
            <Link href="#" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            &{" "}
            <Link href="#" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
