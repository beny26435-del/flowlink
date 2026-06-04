import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatedBackground } from "./AnimatedBackground";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AnimatedBackground />
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          <span>FlowLink</span>
        </Link>
        <nav className="nav">
          <Link href="/create">Create</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
