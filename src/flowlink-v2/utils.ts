import { formatNativeUsdcAmount, parseNativeUsdcAmount } from "../flowlink/utils";
import { LINK_MODES, type LinkMode, type LinkModeLabel } from "./types";

export { buildExplorerAddressUrl, buildExplorerTxUrl, buildPaymentUrl } from "../flowlink/utils";
export { formatNativeUsdcAmount, parseNativeUsdcAmount };

export function getModeLabel(mode: LinkMode): LinkModeLabel {
  return LINK_MODES[mode] ?? "Payment";
}

export function isExactPaymentMode(mode: LinkMode): boolean {
  return mode === 0 || mode === 1 || mode === 2;
}

export function getProgressPercent(paidAmount: bigint, amount: bigint): number {
  if (amount === 0n) return 0;
  const basisPoints = Number((paidAmount * 10000n) / amount);
  return Math.min(100, Math.max(0, basisPoints / 100));
}
