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
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 36 36" role="img">
                <defs>
                  <linearGradient id="arclet-mark-gradient" x1="4" x2="32" y1="4" y2="32">
                    <stop stopColor="#66f2bd" />
                    <stop offset="1" stopColor="#75e7ff" />
                  </linearGradient>
                </defs>
                <rect width="36" height="36" rx="12" fill="url(#arclet-mark-gradient)" />
                <path d="M23.8 9.4a10.3 10.3 0 1 0 2.9 11.1" fill="none" stroke="#06111c" strokeLinecap="round" strokeWidth="7" />
                <circle cx="25.8" cy="10.2" r="3.4" fill="#ffffff" opacity="0.92" />
              </svg>
            </span>
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
