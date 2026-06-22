import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { AppShell } from "./components/AppShell";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arclet.xyz";
const siteDescription =
  "Create payment links, invoices, profiles, and Tip Jar flows with native Arc USDC on Arc Testnet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Arclet",
    template: "%s · Arclet",
  },
  description: siteDescription,
  openGraph: {
    title: "Arclet",
    description: siteDescription,
    url: siteUrl,
    siteName: "Arclet",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Arclet stablecoin checkout on Arc",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arclet",
    description: siteDescription,
    images: ["/twitter-image"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
