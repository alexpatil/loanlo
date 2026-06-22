import LogoIcon from "@/../public/loanlo-logo.png";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

export function Logo({
  href = "/dashboard",
  className,
  showText = true,
}: {
  href?: string;
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 text-white shadow-lg shadow-violet-500/30">
        <Image src={LogoIcon} alt="Loanlo Logo" className="h-5 w-5" />
      </span>
      {showText && (
        <span className="text-lg font-bold tracking-tight">
          {APP_NAME}
          <span className="text-violet-600">.</span>
        </span>
      )}
    </Link>
  );
}
