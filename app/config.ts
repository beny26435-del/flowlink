import type { Address } from "viem";

export const DEPLOYED_FLOWLINK_CONTRACT_ADDRESS = "0x531f40744d9c675dE15C0326766955F5b1cbC938" as const;
export const DEPLOYMENT_TX_HASH = "0xd0b8d619533c1a706e660dd2fd6f06e6522ec269d6444277850942ca099b90bc" as const;

export const FLOWLINK_CONTRACT_MISSING_MESSAGE = "Arclet contract address is not configured.";

export const flowLinkContractAddress = (process.env.NEXT_PUBLIC_ARCLET_CONTRACT_ADDRESS ??
  process.env.NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS) as Address | undefined;
export const hasArcletContractAddress = Boolean(flowLinkContractAddress);
