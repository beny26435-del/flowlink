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

export type BridgeDirection = "sepolia-to-arc" | "arc-to-sepolia";

export type BridgeRoute = {
  direction: BridgeDirection;
  sourceChain: BridgeChain;
  sourceChainId: number;
  sourceName: string;
  sourceShortName: string;
  destinationChain: BridgeChain;
  destinationChainId: number;
  destinationName: string;
  destinationShortName: string;
  token: "USDC";
};

const BRIDGE_ROUTES = {
  "sepolia-to-arc": {
    direction: "sepolia-to-arc",
    sourceChain: BridgeChain.Ethereum_Sepolia,
    sourceChainId: sepolia.id,
    sourceName: "Ethereum Sepolia",
    sourceShortName: "Sepolia",
    destinationChain: BridgeChain.Arc_Testnet,
    destinationChainId: arcTestnet.id,
    destinationName: "Arc Testnet",
    destinationShortName: "Arc",
    token: "USDC",
  },
  "arc-to-sepolia": {
    direction: "arc-to-sepolia",
    sourceChain: BridgeChain.Arc_Testnet,
    sourceChainId: arcTestnet.id,
    sourceName: "Arc Testnet",
    sourceShortName: "Arc",
    destinationChain: BridgeChain.Ethereum_Sepolia,
    destinationChainId: sepolia.id,
    destinationName: "Ethereum Sepolia",
    destinationShortName: "Sepolia",
    token: "USDC",
  },
} as const satisfies Record<BridgeDirection, BridgeRoute>;

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
  routes: BridgeRoute[];
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

export type AppKitGenericBridgeInput = AppKitBridgeInput & {
  direction: BridgeDirection;
};

export type AppKitBridgeStatus =
  | "idle"
  | "setup-needed"
  | "wallet-not-connected"
  | "wrong-source-chain"
  | "switching-network"
  | "preparing"
  | "wallet-confirmation"
  | "submitted"
  | "bridging"
  | "completed"
  | "failed";

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
  direction: BridgeDirection;
  sourceChain: BridgeChain;
  destinationChain: BridgeChain;
  amount: string;
  txHashes: string[];
  steps: NormalizedAppKitBridgeStep[];
  rawResult?: BridgeResult;
  errorMessage?: string;
};

const BRIDGE_TX_HASH_KEYS = new Set([
  "approvalTxHash",
  "sourceTxHash",
  "destinationTxHash",
  "transactionHash",
  "txHash",
  "burnTxHash",
  "mintTxHash",
]);

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
        ? "Bridge is enabled between Ethereum Sepolia and Arc Testnet."
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
      description: "Use Arc App Kit to move USDC between Ethereum Sepolia and Arc Testnet before checkout.",
    },
    unifiedBalance: {
      available: status.unifiedBalanceReady,
      label: "Unified Balance",
      description: "Coming next. Future FlowLink funding flows can prepare USDC from supported sources.",
    },
  };
}

export function getBridgeSourceChains() {
  return getSupportedBridgeRoutes().map((route) => ({
    chain: route.sourceChain,
    chainId: route.sourceChainId,
    name: route.sourceName,
  }));
}

export function getSupportedBridgeRoutes(): BridgeRoute[] {
  return [BRIDGE_ROUTES["sepolia-to-arc"], BRIDGE_ROUTES["arc-to-sepolia"]];
}

export function getDefaultBridgeRoute(direction: BridgeDirection = "sepolia-to-arc"): BridgeRoute {
  return BRIDGE_ROUTES[direction];
}

export function canBridgeDirection(direction: BridgeDirection) {
  const capability = getBridgeCapabilityStatus();
  return {
    ok: capability.ready && Boolean(BRIDGE_ROUTES[direction]),
    reason: capability.ready ? undefined : capability.reason,
  };
}

export function getRequiredSourceWagmiChain(direction: BridgeDirection) {
  return direction === "sepolia-to-arc" ? sepolia : arcTestnet;
}

export function getDestinationWagmiChain(direction: BridgeDirection) {
  return direction === "sepolia-to-arc" ? arcTestnet : sepolia;
}

export function getBridgeDirectionLabel(direction: BridgeDirection) {
  const route = getDefaultBridgeRoute(direction);
  return `${route.sourceName} → ${route.destinationName}`;
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
    routes: getSupportedBridgeRoutes(),
    missing,
    reason: missing.length > 0 ? `Bridge setup needed: ${missing.join(", ")}.` : undefined,
  };
}

export function canUseBridge(input: { connected: boolean; currentChainId?: number; hasProvider: boolean; direction?: BridgeDirection }):
  | { ok: true; status: "ready" }
  | { ok: false; status: "setup-needed" | "wallet-not-connected" | "wrong-source-chain"; reason: string } {
  const direction = input.direction ?? "sepolia-to-arc";
  const route = getDefaultBridgeRoute(direction);
  const bridgeStatus = getBridgeCapabilityStatus();
  if (!bridgeStatus.ready) {
    return { ok: false, status: "setup-needed", reason: bridgeStatus.reason ?? "Arc App Kit Bridge is not configured." };
  }

  if (!input.connected || !input.hasProvider) {
    return { ok: false, status: "wallet-not-connected", reason: "Connect a wallet to use Arc App Kit Bridge." };
  }

  if (input.currentChainId !== route.sourceChainId) {
    return { ok: false, status: "wrong-source-chain", reason: `Switch to ${route.sourceName} to bridge USDC.` };
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
  return bridgeUsdc({ ...input, direction: "sepolia-to-arc" });
}

export async function bridgeUsdc(input: AppKitGenericBridgeInput): Promise<AppKitBridgeResult> {
  const route = getDefaultBridgeRoute(input.direction);
  const bridgeStatus = getBridgeCapabilityStatus();

  if (!bridgeStatus.ready) {
    return {
      status: "setup-needed",
      direction: input.direction,
      sourceChain: route.sourceChain,
      destinationChain: route.destinationChain,
      amount: input.amount,
      txHashes: [],
      steps: [],
      errorMessage: bridgeStatus.reason ?? "Arc App Kit Bridge is not configured.",
    };
  }

  if (input.currentChainId !== undefined && input.currentChainId !== route.sourceChainId) {
    return {
      status: "wrong-source-chain",
      direction: input.direction,
      sourceChain: route.sourceChain,
      destinationChain: route.destinationChain,
      amount: input.amount,
      txHashes: [],
      steps: [],
      errorMessage: `Switch to ${route.sourceName} to bridge USDC.`,
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
      from: { adapter, chain: route.sourceChain },
      to: {
        adapter,
        chain: route.destinationChain,
        recipientAddress: input.destinationAddress,
      },
      amount: input.amount,
      token: "USDC",
      config: { transferSpeed: TransferSpeed.FAST },
    });

    return normalizeBridgeResult(result, input.amount, route);
  } catch (caught) {
    return {
      status: "failed",
      direction: input.direction,
      sourceChain: route.sourceChain,
      destinationChain: route.destinationChain,
      amount: input.amount,
      txHashes: [],
      steps: [],
      errorMessage: normalizeAppKitError(caught, input.direction),
    };
  }
}

export function normalizeAppKitError(error: unknown, direction: BridgeDirection = "sepolia-to-arc"): string {
  if (error instanceof Error) {
    const message = error.message;
    if (/user rejected|user denied|4001/i.test(message)) return "Wallet request was rejected. Start the bridge again when you are ready.";
    if (/insufficient.*gas|gas required exceeds|intrinsic gas/i.test(message)) {
      return direction === "arc-to-sepolia" ? "You may need native USDC on Arc for gas." : "You may need ETH on Sepolia for gas.";
    }
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

export function normalizeBridgeResult(result: BridgeResult, amount: string, route: BridgeRoute): AppKitBridgeResult {
  const rawSteps = Array.isArray(result.steps) ? result.steps : [];
  const steps = rawSteps.map((step) => ({
    name: step.name,
    state: step.state,
    txHash: step.txHash,
    explorerUrl: step.explorerUrl,
    errorMessage: step.errorMessage,
    errorCategory: step.errorCategory,
  }));
  const txHashes = uniqueStrings([...steps.flatMap((step) => (step.txHash ? [step.txHash] : [])), ...extractBridgeTxHashes(result)]);
  const erroredStep = steps.find((step) => step.state === "error");

  return {
    status: result.state === "success" ? "completed" : result.state === "error" ? "failed" : "bridging",
    direction: route.direction,
    sourceChain: route.sourceChain,
    destinationChain: route.destinationChain,
    amount,
    txHashes,
    steps,
    rawResult: result,
    errorMessage: erroredStep?.errorMessage,
  };
}

function extractBridgeTxHashes(value: unknown, seen = new WeakSet<object>()): string[] {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const hashes: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === "string" && BRIDGE_TX_HASH_KEYS.has(key) && isTxHash(nested)) {
      hashes.push(nested);
      continue;
    }

    if (Array.isArray(nested)) {
      for (const item of nested) hashes.push(...extractBridgeTxHashes(item, seen));
      continue;
    }

    if (nested && typeof nested === "object") {
      hashes.push(...extractBridgeTxHashes(nested, seen));
    }
  }

  return hashes;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(trimmed)) return false;
  return Number(trimmed) > 0;
}
