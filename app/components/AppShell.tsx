"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatedBackground } from "./AnimatedBackground";
import { WalletConnectButton } from "./WalletConnectButton";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <AnimatedBackground />
      <header className="site-header">
        <div className="header-main">
          <Link className="brand" href="/" onClick={() => setMobileMenuOpen(false)}>
            <span className="brand-mark" />
            <span>Arclet</span>
          </Link>
          <button className="mobile-menu-toggle" type="button" aria-expanded={mobileMenuOpen} aria-controls="primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
            <span>{mobileMenuOpen ? "Close" : "Menu"}</span>
            <span className="mobile-menu-icon" aria-hidden="true" />
          </button>
        </div>
        <nav id="primary-navigation" className={`nav ${mobileMenuOpen ? "open" : ""}`}>
          <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
            Create
          </Link>
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
            Dashboard
          </Link>
          <WalletConnectButton />
        </nav>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
