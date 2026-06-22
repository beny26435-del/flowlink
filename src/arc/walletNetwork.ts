import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  ETHEREUM_SEPOLIA_EXPLORER_URL,
  ETHEREUM_SEPOLIA_RPC_URL,
} from "./chain";

export type WalletProvider = {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: WalletProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type WalletConnectorLike = {
  id?: string;
  name?: string;
  getProvider?: () => Promise<unknown>;
};

type WalletProviderOptions = {
  connectedAddress?: string;
  preferMetaMask?: boolean;
};

export type WalletChainTarget = {
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

export const ETHEREUM_SEPOLIA_WALLET_CHAIN: WalletChainTarget = {
  chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
  chainName: "Ethereum Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL || ETHEREUM_SEPOLIA_RPC_URL],
  blockExplorerUrls: [ETHEREUM_SEPOLIA_EXPLORER_URL],
};

export const ARC_TESTNET_WALLET_CHAIN: WalletChainTarget = {
  chainId: ARC_TESTNET_CHAIN_ID,
  chainName: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC_URL],
  blockExplorerUrls: [ARC_TESTNET_EXPLORER_URL],
};

export function getInjectedProvider(options: { preferMetaMask?: boolean } = {}): WalletProvider | undefined {
  const providers = getInjectedProviders();
  if (!providers.length) return undefined;

  if (options.preferMetaMask) {
    const metaMaskProvider = providers.find((provider) => provider.isMetaMask);
    if (metaMaskProvider) return metaMaskProvider;
  }

  return providers[0];
}

export function getInjectedProviders(): WalletProvider[] {
  if (typeof window === "undefined") return [];

  const ethereum = (window as unknown as { ethereum?: WalletProvider }).ethereum;
  if (!ethereum) return [];

  const providers = ethereum.providers?.filter(isWalletProvider) ?? [];
  return providers.length ? uniqueProviders([...providers, ethereum]) : [ethereum];
}

export async function getWalletProvider(connector?: WalletConnectorLike, options: WalletProviderOptions = {}): Promise<WalletProvider | undefined> {
  const connectorProvider = connector?.getProvider ? await connector.getProvider().catch(() => undefined) : undefined;
  const connectorWalletProvider = isWalletProvider(connectorProvider) ? connectorProvider : undefined;
  const injectedProviders = getInjectedProviders();
  const candidates = uniqueProviders([connectorWalletProvider, ...injectedProviders].filter(isWalletProvider));
  const preferMetaMask = options.preferMetaMask ?? shouldPreferMetaMask(connector);
  const accountMatchedProvider = options.connectedAddress ? await findProviderForConnectedAddress(candidates, options.connectedAddress, preferMetaMask) : undefined;

  if (accountMatchedProvider) return accountMatchedProvider;
  if (preferMetaMask) {
    const metaMaskProvider = candidates.find((provider) => provider.isMetaMask);
    if (metaMaskProvider) return metaMaskProvider;
  }
  if (connectorWalletProvider) return connectorWalletProvider;

  return getInjectedProvider({ preferMetaMask });
}

export async function switchOrAddWalletChain(input: { chain: WalletChainTarget; connector?: WalletConnectorLike; connectedAddress?: string }): Promise<number | undefined> {
  const { chain, connector, connectedAddress } = input;
  const provider = await getWalletProvider(connector, { connectedAddress });
  if (!provider) throw new Error("Wallet provider not available.");

  const chainIdHex = toHexChainId(chain.chainId);

  if (process.env.NODE_ENV === "development") {
    console.log("[Arclet] switch requested", chain.chainId);
    console.log("[Arclet] provider", {
      isMetaMask: provider.isMetaMask,
      isCoinbaseWallet: provider.isCoinbaseWallet,
      isRabby: provider.isRabby,
      connectorId: connector?.id,
      connectorName: connector?.name,
    });
    console.log("[Arclet] eth_chainId before", await readProviderChainIdForLog(provider));
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    await waitForWalletChain(provider, chain.chainId);
    if (process.env.NODE_ENV === "development") {
      console.log("[Arclet] eth_chainId after", await readProviderChainIdForLog(provider));
      console.log("[Arclet] wallet switch success");
    }
    return chain.chainId;
  } catch (caught) {
    if (isUserRejectedError(caught)) throw new Error("Wallet rejected network switch.");
    if (!isUnknownChainError(caught)) throw caught;
  }

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: chain.chainName,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls,
          blockExplorerUrls: chain.blockExplorerUrls,
        },
      ],
    });
  } catch (caught) {
    if (isUserRejectedError(caught)) throw new Error("Wallet rejected network switch.");
    throw new Error("Could not add network to wallet.");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    await waitForWalletChain(provider, chain.chainId);
    if (process.env.NODE_ENV === "development") {
      console.log("[Arclet] eth_chainId after", await readProviderChainIdForLog(provider));
      console.log("[Arclet] wallet switch success");
    }
    return chain.chainId;
  } catch (caught) {
    if (isUserRejectedError(caught)) throw new Error("Wallet rejected network switch.");
    throw caught;
  }
}

export async function getCurrentWalletChainId(providerOrConnector?: WalletProvider | WalletConnectorLike, options: WalletProviderOptions = {}): Promise<number | undefined> {
  const provider = isWalletProvider(providerOrConnector) ? providerOrConnector : await getWalletProvider(providerOrConnector, options);
  if (!provider) return undefined;

  const chainId = await provider.request({ method: "eth_chainId" });
  return typeof chainId === "string" ? Number.parseInt(chainId, 16) : undefined;
}

export function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

function isWalletProvider(provider: unknown): provider is WalletProvider {
  return Boolean(provider && typeof provider === "object" && "request" in provider && typeof (provider as { request?: unknown }).request === "function");
}

function shouldPreferMetaMask(connector: WalletConnectorLike | undefined): boolean {
  const label = `${connector?.id ?? ""} ${connector?.name ?? ""}`.toLowerCase();
  return label.includes("metamask") || label.includes("meta mask") || label.includes("injected");
}

async function readProviderChainIdForLog(provider: WalletProvider): Promise<unknown> {
  try {
    return await provider.request({ method: "eth_chainId" });
  } catch (caught) {
    return caught instanceof Error ? caught.message : "unavailable";
  }
}

function isUnknownChainError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: number; message?: string; cause?: unknown; data?: unknown; error?: unknown; originalError?: unknown };
  return (
    maybeError.code === 4902 ||
    /unrecognized chain|unknown chain|not added/i.test(maybeError.message ?? "") ||
    isUnknownChainError(maybeError.cause) ||
    isUnknownChainError(maybeError.data) ||
    isUnknownChainError(maybeError.error) ||
    isUnknownChainError(maybeError.originalError)
  );
}

function isUserRejectedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: number; message?: string; cause?: unknown; data?: unknown; error?: unknown; originalError?: unknown };
  return (
    maybeError.code === 4001 ||
    /user rejected|user denied|rejected request/i.test(maybeError.message ?? "") ||
    isUserRejectedError(maybeError.cause) ||
    isUserRejectedError(maybeError.data) ||
    isUserRejectedError(maybeError.error) ||
    isUserRejectedError(maybeError.originalError)
  );
}

async function waitForWalletChain(provider: WalletProvider, chainId: number): Promise<void> {
  const targetHex = toHexChainId(chainId).toLowerCase();
  const started = Date.now();

  while (Date.now() - started < 10_000) {
    try {
      const current = await provider.request({ method: "eth_chainId" });
      if (typeof current === "string" && current.toLowerCase() === targetHex) return;
    } catch {
      // Wallets can briefly reject reads while network switching settles.
    }
    await delay(120);
  }

  throw new Error("Wallet did not report the requested network after switching.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueProviders(providers: WalletProvider[]): WalletProvider[] {
  return Array.from(new Set(providers));
}

async function findProviderForConnectedAddress(
  providers: WalletProvider[],
  connectedAddress: string,
  preferMetaMask: boolean
): Promise<WalletProvider | undefined> {
  const target = connectedAddress.toLowerCase();
  const matches: WalletProvider[] = [];

  for (const provider of providers) {
    try {
      const accounts = await provider.request({ method: "eth_accounts" });
      if (Array.isArray(accounts) && accounts.some((account) => typeof account === "string" && account.toLowerCase() === target)) {
        matches.push(provider);
      }
    } catch {
      // Some injected wallets reject account reads while locked; keep checking other candidates.
    }
  }

  if (!matches.length) return undefined;
  if (preferMetaMask) return matches.find((provider) => provider.isMetaMask) ?? matches[0];
  return matches[0];
}
