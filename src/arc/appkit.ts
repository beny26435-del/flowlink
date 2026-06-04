import * as CircleAppKit from "@circle-fin/app-kit";

/**
 * Arc App Kit integration placeholder.
 *
 * FlowLink v1 pays with native Arc value through msg.value because Arc Testnet
 * uses USDC as the native gas token. v2 can use App Kit for richer payment
 * orchestration:
 * - Send: same-chain USDC sending flows.
 * - Bridge: crosschain USDC movement into Arc.
 * - Unified Balance: "Pay from anywhere" deposits and spending.
 *
 * These helpers intentionally do not fake production App Kit calls. The exact
 * client setup depends on credentials, product configuration, and the final
 * checkout UX.
 */

export type AppKitModule = typeof CircleAppKit;

export function createAppKitClient(): never {
  void CircleAppKit;
  throw new Error("Not implemented yet: configure @circle-fin/app-kit credentials and product settings first.");
}

export function prepareSameChainSend(): never {
  throw new Error("Not implemented yet: wire App Kit Send for same-chain Arc USDC payments in v2.");
}

export function prepareUnifiedBalanceSpend(): never {
  throw new Error("Not implemented yet: wire App Kit Unified Balance for pay-from-anywhere FlowLink v2.");
}

export function prepareBridgeToArc(): never {
  throw new Error("Not implemented yet: wire App Kit Bridge for crosschain USDC movement into Arc in v2.");
}
