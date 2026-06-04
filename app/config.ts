import type { Address } from "viem";

export const DEPLOYED_FLOWLINK_CONTRACT_ADDRESS = "0x3dBdaDEcb8817B11D3D239ffaA881bcd7084D8b7" as const;
export const DEPLOYMENT_TX_HASH = "0x42e768b943404d2ce0c2ddaa27d1a898f0767643ad62008a91be1218d73c0fc6" as const;

export const FLOWLINK_CONTRACT_MISSING_MESSAGE = "FlowLink contract address is not configured.";

export const flowLinkContractAddress = process.env.NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS as Address | undefined;
export const hasFlowLinkContractAddress = Boolean(flowLinkContractAddress);
