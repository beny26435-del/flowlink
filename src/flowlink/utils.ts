import { formatUnits, parseUnits } from "viem";
import { ARC_TESTNET_EXPLORER_URL } from "../arc/chain.js";

const NATIVE_USDC_DECIMALS = 18;

/**
 * FlowLink v1 sends native Arc value with msg.value. Treat this as 18-decimal
 * wei-like native units for contract calls. Do not mix this with ERC20 USDC
 * decimal assumptions unless Arc/App Kit integration explicitly requires it.
 */
export function parseNativeUsdcAmount(input: string): bigint {
  return parseUnits(input, NATIVE_USDC_DECIMALS);
}

export function formatNativeUsdcAmount(amount: bigint): string {
  return formatUnits(amount, NATIVE_USDC_DECIMALS);
}

export function buildExplorerTxUrl(txHash: string): string {
  return `${ARC_TESTNET_EXPLORER_URL}/tx/${txHash}`;
}

export function buildExplorerAddressUrl(address: string): string {
  return `${ARC_TESTNET_EXPLORER_URL}/address/${address}`;
}

export function buildPaymentUrl(baseUrl: string, linkId: bigint | number | string): string {
  return `${baseUrl.replace(/\/$/, "")}/pay/${linkId.toString()}`;
}
