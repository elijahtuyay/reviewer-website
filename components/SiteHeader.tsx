import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
          Reviewer
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <span className="hidden items-center gap-1.5 text-muted sm:flex">
            Exams
            <span className="rounded-full bg-panel-hover px-1.5 py-0.5 text-[10px] font-medium text-muted">
              soon
            </span>
          </span>
          <span className="hidden items-center gap-1.5 text-muted sm:flex">
            Pricing
            <span className="rounded-full bg-panel-hover px-1.5 py-0.5 text-[10px] font-medium text-muted">
              soon
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            Account
            <span className="rounded-full bg-panel-hover px-1.5 py-0.5 text-[10px] font-medium text-muted">
              soon
            </span>
          </span>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
