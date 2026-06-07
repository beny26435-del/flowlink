import { BridgeFlow } from "../components/BridgeFlow";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { sanitizeInternalPath } from "../lib/navigation";
import type { BridgeDirection } from "../../src/arc/appkit";

type BridgePageProps = {
  searchParams: Promise<{
    amount?: string;
    direction?: string;
    returnTo?: string;
  }>;
};

export default async function BridgePage({ searchParams }: BridgePageProps) {
  const params = await searchParams;
  const amount = sanitizeAmount(params.amount);
  const direction = sanitizeDirection(params.direction);
  const returnTo = sanitizeInternalPath(params.returnTo);

  return (
    <PageTransition>
      <div className="bridge-page-compact">
        <PageHeader
          eyebrow="Arc App Kit"
          title="Bridge USDC"
          subtitle="Move USDC between Ethereum Sepolia and Arc Testnet with Arc App Kit."
        />
        <BridgeFlow initialAmount={amount} initialDirection={direction} returnTo={returnTo} />
      </div>
    </PageTransition>
  );
}

function sanitizeAmount(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(trimmed)) return "";
  return Number(trimmed) > 0 ? trimmed : "";
}

function sanitizeDirection(value: string | undefined): BridgeDirection {
  return value === "arc-to-sepolia" ? "arc-to-sepolia" : "sepolia-to-arc";
}
