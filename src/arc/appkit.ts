import { AppKit, BridgeChain, TransferSpeed, type AppKitConfig, type BridgeResult, type BridgeStep } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { createPublicClient, http, isAddress, type Address, type Chain, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { arcTestnet, ARC_TESTNET_RPC_URL } from "./chain";

export type AppKitProvider = Parameters<typeof createViemAdapterFromProvider>[0]["provider"];

export const APP_KIT_BRIDGE_SOURCE_CHAIN = BridgeChain.Ethereum_Sepolia;
export const APP_KIT_BRIDGE_DESTINATION_CHAIN = BridgeChain.Arc_Testnet;
export const APP_KIT_BRIDGE_SOURCE_CHAIN_ID = sepolia.id;
export const APP_KIT_BRIDGE_DESTINATION_CHAIN_ID = arcTestnet.id;

export type AppKitConfigStatus = {
  sdkAvailable: boolean;
  viemAdapterAvailable: boolean;
  publicKitKeyAvailable: boolean;
  serverKitKeyConfigured: boolean;
  sendReady: boolean;
  bridgeReady: boolean;
  unifiedBalanceReady: boolean;
  missing: string[];
  notes: string[];
};

export type AppKitBridgeCapabilityStatus = {
  enabled: boolean;
  ready: boolean;
  publicKitKeyAvailable: boolean;
  sourceChain: typeof APP_KIT_BRIDGE_SOURCE_CHAIN;
  destinationChain: typeof APP_KIT_BRIDGE_DESTINATION_CHAIN;
  missing: string[];
  reason?: string;
};

export type AppKitCapabilities = {
  sendUsdcOnArc: {
    available: boolean;
    label: string;
    description: string;
  };
  bridgeToArc: {
    available: boolean;
    label: string;
    description: string;
  };
  unifiedBalance: {
    available: boolean;
    label: string;
    description: string;
  };
};

export type AppKitSendInput = {
  provider: AppKitProvider;
  recipient: Address;
  amount: string;
};

export type AppKitSendResult = {
  name: string;
  state: BridgeStep["state"];
  txHash?: string;
  explorerUrl?: string;
  errorMessage?: string;
};

export type AppKitBridgeInput = {
  provider: AppKitProvider;
  destinationAddress: Address;
  amount: string;
  currentChainId?: number;
};

export type AppKitBridgeStatus = "idle" | "setup-needed" | "switch-source-chain" | "preparing" | "wallet-confirmation" | "submitted" | "bridging" | "completed" | "failed";

export type NormalizedAppKitBridgeStep = {
  name: string;
  state: BridgeStep["state"];
  txHash?: string;
  explorerUrl?: string;
  errorMessage?: string;
  errorCategory?: BridgeStep["errorCategory"];
};

export type AppKitBridgeResult = {
  status: AppKitBridgeStatus;
  sourceChain: typeof APP_KIT_BRIDGE_SOURCE_CHAIN;
  destinationChain: typeof APP_KIT_BRIDGE_DESTINATION_CHAIN;
  amount: string;
  txHashes: string[];
  steps: NormalizedAppKitBridgeStep[];
  rawResult?: BridgeResult;
  errorMessage?: string;
};

export function isAppKitConfigured(): boolean {
  return getAppKitConfigStatus().sendReady;
}

export function getAppKitConfigStatus(): AppKitConfigStatus {
  const publicKitKeyAvailable = Boolean(process.env.NEXT_PUBLIC_APP_KIT_KEY);
  const serverKitKeyConfigured = typeof window === "undefined" && Boolean(process.env.APP_KIT_KEY);
  const bridgeStatus = getBridgeCapabilityStatus();

  return {
    sdkAvailable: true,
    viemAdapterAvailable: true,
    publicKitKeyAvailable,
    serverKitKeyConfigured,
    sendReady: true,
    bridgeReady: bridgeStatus.ready,
    unifiedBalanceReady: false,
    missing: bridgeStatus.missing,
    notes: [
      "Send uses the connected browser wallet through the official Viem adapter.",
      publicKitKeyAvailable
        ? "NEXT_PUBLIC_APP_KIT_KEY is configured for browser SDK initialization."
        : "No public App Kit key is configured. Add NEXT_PUBLIC_APP_KIT_KEY if your Circle setup requires one.",
      bridgeStatus.ready
        ? "Bridge is enabled for Ethereum Sepolia to Arc Testnet funding."
        : "Bridge requires NEXT_PUBLIC_APP_KIT_BRIDGE_ENABLED=true and NEXT_PUBLIC_APP_KIT_KEY.",
      "Unified Balance is intentionally disabled until that flow is wired end to end.",
    ],
  };
}

export function createAppKitClient(options: { kitKey?: string; disableErrorReporting?: boolean } = {}): AppKit {
  const kitKey = options.kitKey ?? process.env.NEXT_PUBLIC_APP_KIT_KEY;
  const config: AppKitConfig = {
    disableErrorReporting: options.disableErrorReporting ?? false,
    ...(kitKey ? { kitKey } : {}),
  };

  return new AppKit(config);
}

export function getAppKitCapabilities(): AppKitCapabilities {
  const status = getAppKitConfigStatus();

  return {
    sendUsdcOnArc: {
      available: status.sendReady,
      label: "Send USDC on Arc",
      description: "Use Arc App Kit with the connected wallet to send USDC on Arc Testnet.",
    },
    bridgeToArc: {
      available: status.bridgeReady,
      label: "Bridge USDC to Arc",
      description: "Use Arc App Kit to move USDC from Ethereum Sepolia to Arc Testnet before checkout.",
    },
    unifiedBalance: {
      available: status.unifiedBalanceReady,
      label: "Unified Balance",
      description: "Coming next. Future FlowLink funding flows can prepare USDC from supported sources.",
    },
  };
}

export function getBridgeSourceChains() {
  return [
    {
      chain: APP_KIT_BRIDGE_SOURCE_CHAIN,
      chainId: APP_KIT_BRIDGE_SOURCE_CHAIN_ID,
      name: "Ethereum Sepolia",
    },
  ] as const;
}

export function getDefaultBridgeRoute() {
  return {
    sourceChain: APP_KIT_BRIDGE_SOURCE_CHAIN,
    sourceChainId: APP_KIT_BRIDGE_SOURCE_CHAIN_ID,
    sourceName: "Ethereum Sepolia",
    destinationChain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
    destinationChainId: APP_KIT_BRIDGE_DESTINATION_CHAIN_ID,
    destinationName: "Arc Testnet",
    token: "USDC",
  } as const;
}

export function getBridgeCapabilityStatus(): AppKitBridgeCapabilityStatus {
  const enabled = process.env.NEXT_PUBLIC_APP_KIT_BRIDGE_ENABLED === "true";
  const publicKitKeyAvailable = Boolean(process.env.NEXT_PUBLIC_APP_KIT_KEY);
  const missing = [
    ...(enabled ? [] : ["NEXT_PUBLIC_APP_KIT_BRIDGE_ENABLED=true"]),
    ...(publicKitKeyAvailable ? [] : ["NEXT_PUBLIC_APP_KIT_KEY"]),
  ];

  return {
    enabled,
    ready: enabled && publicKitKeyAvailable,
    publicKitKeyAvailable,
    sourceChain: APP_KIT_BRIDGE_SOURCE_CHAIN,
    destinationChain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
    missing,
    reason: missing.length > 0 ? `Bridge setup needed: ${missing.join(", ")}.` : undefined,
  };
}

export function canUseBridge(input: { connected: boolean; currentChainId?: number; hasProvider: boolean }):
  | { ok: true; status: "ready" }
  | { ok: false; status: "setup-needed" | "wallet-not-connected" | "switch-source-chain"; reason: string } {
  const bridgeStatus = getBridgeCapabilityStatus();
  if (!bridgeStatus.ready) {
    return { ok: false, status: "setup-needed", reason: bridgeStatus.reason ?? "Arc App Kit Bridge is not configured." };
  }

  if (!input.connected || !input.hasProvider) {
    return { ok: false, status: "wallet-not-connected", reason: "Connect a wallet to use Arc App Kit Bridge." };
  }

  if (input.currentChainId !== APP_KIT_BRIDGE_SOURCE_CHAIN_ID) {
    return { ok: false, status: "switch-source-chain", reason: "Switch to Ethereum Sepolia to bridge USDC to Arc." };
  }

  return { ok: true, status: "ready" };
}

export async function sendUsdcOnArcWithAppKit(input: AppKitSendInput): Promise<AppKitSendResult> {
  if (!isAddress(input.recipient)) {
    throw new Error("Enter a valid Arc recipient address.");
  }

  if (!isPositiveDecimal(input.amount)) {
    throw new Error("Enter a valid USDC amount for App Kit Send.");
  }

  const adapter = await createViemAdapterFromProvider({
    provider: input.provider,
    getPublicClient,
    capabilities: { addressContext: "user-controlled" },
  });

  const kit = createAppKitClient();
  const result = await kit.send({
    from: { adapter, chain: "Arc_Testnet" },
    to: input.recipient,
    amount: input.amount,
    token: "USDC",
  });

  return {
    name: result.name,
    state: result.state,
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    errorMessage: result.errorMessage,
  };
}

export async function bridgeUsdcToArc(input: AppKitBridgeInput): Promise<AppKitBridgeResult> {
  const bridgeStatus = getBridgeCapabilityStatus();

  if (!bridgeStatus.ready) {
    return {
      status: "setup-needed",
      sourceChain: APP_KIT_BRIDGE_SOURCE_CHAIN,
      destinationChain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
      amount: input.amount,
      txHashes: [],
      steps: [],
      errorMessage: bridgeStatus.reason ?? "Arc App Kit Bridge is not configured.",
    };
  }

  if (input.currentChainId !== undefined && input.currentChainId !== APP_KIT_BRIDGE_SOURCE_CHAIN_ID) {
    return {
      status: "switch-source-chain",
      sourceChain: APP_KIT_BRIDGE_SOURCE_CHAIN,
      destinationChain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
      amount: input.amount,
      txHashes: [],
      steps: [],
      errorMessage: "Switch to Ethereum Sepolia to bridge USDC to Arc.",
    };
  }

  if (!isAddress(input.destinationAddress)) {
    throw new Error("Connect a valid destination wallet for Arc funding.");
  }

  if (!isPositiveDecimal(input.amount)) {
    throw new Error("Enter a valid USDC amount for App Kit Bridge.");
  }

  try {
    const adapter = await createViemAdapterFromProvider({
      provider: input.provider,
      getPublicClient,
      capabilities: { addressContext: "user-controlled" },
    });

    const kit = createAppKitClient();
    const result = await kit.bridge({
      from: { adapter, chain: APP_KIT_BRIDGE_SOURCE_CHAIN },
      to: {
        adapter,
        chain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
        recipientAddress: input.destinationAddress,
      },
      amount: input.amount,
      token: "USDC",
      config: { transferSpeed: TransferSpeed.FAST },
    });

    return normalizeBridgeResult(result, input.amount);
  } catch (caught) {
    return {
      status: "failed",
      sourceChain: APP_KIT_BRIDGE_SOURCE_CHAIN,
      destinationChain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
      amount: input.amount,
      txHashes: [],
      steps: [],
      errorMessage: normalizeAppKitError(caught),
    };
  }
}

export function normalizeAppKitError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (/user rejected|user denied|4001/i.test(message)) return "Wallet request was rejected. Start the bridge again when you are ready.";
    if (/insufficient.*gas|gas required exceeds|intrinsic gas/i.test(message)) return "The source wallet does not have enough Sepolia ETH for gas.";
    if (/insufficient.*USDC|insufficient.*funds|balance/i.test(message)) return "The source wallet may not have enough USDC for this bridge.";
    if (/timeout|timed out|polling/i.test(message)) return "Bridge processing is taking longer than expected. Check the transaction links or try again later.";
    if (/route|unsupported|unavailable/i.test(message)) return "This bridge route is unavailable right now.";
    if (/rpc|network|fetch/i.test(message)) return "A network or RPC error interrupted App Kit Bridge. Check your connection and try again.";
    return message;
  }

  return "Arc App Kit returned an unknown bridge error.";
}

function getPublicClient({ chain }: { chain: Chain }): PublicClient {
  const rpcUrl =
    chain.id === arcTestnet.id
      ? process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC_URL
      : chain.id === sepolia.id
        ? process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL || chain.rpcUrls.default.http[0]
        : chain.rpcUrls.default.http[0];
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

function normalizeBridgeResult(result: BridgeResult, amount: string): AppKitBridgeResult {
  const steps = result.steps.map((step) => ({
    name: step.name,
    state: step.state,
    txHash: step.txHash,
    explorerUrl: step.explorerUrl,
    errorMessage: step.errorMessage,
    errorCategory: step.errorCategory,
  }));
  const txHashes = steps.flatMap((step) => (step.txHash ? [step.txHash] : []));
  const erroredStep = steps.find((step) => step.state === "error");

  return {
    status: result.state === "success" ? "completed" : result.state === "error" ? "failed" : "bridging",
    sourceChain: APP_KIT_BRIDGE_SOURCE_CHAIN,
    destinationChain: APP_KIT_BRIDGE_DESTINATION_CHAIN,
    amount,
    txHashes,
    steps,
    rawResult: result,
    errorMessage: erroredStep?.errorMessage,
  };
}

function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(trimmed)) return false;
  return Number(trimmed) > 0;
}
