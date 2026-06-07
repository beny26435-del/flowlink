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
  if (typeof window === "undefined") return undefined;

  const ethereum = (window as unknown as { ethereum?: WalletProvider }).ethereum;
  if (!ethereum) return undefined;

  if (options.preferMetaMask) {
    const metaMaskProvider = ethereum.providers?.find((provider) => provider.isMetaMask);
    if (metaMaskProvider) return metaMaskProvider;
  }

  return ethereum;
}

export async function getWalletProvider(connector?: WalletConnectorLike): Promise<WalletProvider | undefined> {
  const connectorProvider = connector?.getProvider ? await connector.getProvider().catch(() => undefined) : undefined;
  if (isWalletProvider(connectorProvider)) return connectorProvider;

  return getInjectedProvider({ preferMetaMask: isMetaMaskConnector(connector) });
}

export async function switchOrAddWalletChain(input: { chain: WalletChainTarget; connector?: WalletConnectorLike }): Promise<void> {
  const { chain, connector } = input;
  const provider = await getWalletProvider(connector);
  if (!provider) throw new Error("Wallet provider not available.");

  const chainIdHex = toHexChainId(chain.chainId);

  if (process.env.NODE_ENV === "development") {
    console.log("[FlowLink] switch requested", chain.chainId);
    console.log("[FlowLink] provider", {
      isMetaMask: provider.isMetaMask,
      isCoinbaseWallet: provider.isCoinbaseWallet,
      isRabby: provider.isRabby,
      connectorId: connector?.id,
      connectorName: connector?.name,
    });
    console.log("[FlowLink] eth_chainId before", await readProviderChainIdForLog(provider));
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    await waitForWalletChain(provider, chain.chainId);
    if (process.env.NODE_ENV === "development") {
      console.log("[FlowLink] eth_chainId after", await readProviderChainIdForLog(provider));
      console.log("[FlowLink] wallet switch success");
    }
    return;
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
      console.log("[FlowLink] eth_chainId after", await readProviderChainIdForLog(provider));
      console.log("[FlowLink] wallet switch success");
    }
  } catch (caught) {
    if (isUserRejectedError(caught)) throw new Error("Wallet rejected network switch.");
    throw caught;
  }
}

export async function getCurrentWalletChainId(providerOrConnector?: WalletProvider | WalletConnectorLike): Promise<number | undefined> {
  const provider = isWalletProvider(providerOrConnector) ? providerOrConnector : await getWalletProvider(providerOrConnector);
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

function isMetaMaskConnector(connector: WalletConnectorLike | undefined): boolean {
  const label = `${connector?.id ?? ""} ${connector?.name ?? ""}`.toLowerCase();
  return label.includes("metamask") || label.includes("meta mask");
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
  const maybeError = error as { code?: number; message?: string; cause?: unknown };
  return maybeError.code === 4902 || /unrecognized chain|unknown chain|not added/i.test(maybeError.message ?? "") || isUnknownChainError(maybeError.cause);
}

function isUserRejectedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: number; message?: string; cause?: unknown };
  return maybeError.code === 4001 || /user rejected|user denied|rejected request/i.test(maybeError.message ?? "") || isUserRejectedError(maybeError.cause);
}

async function waitForWalletChain(provider: WalletProvider, chainId: number): Promise<void> {
  const targetHex = toHexChainId(chainId).toLowerCase();
  const started = Date.now();

  while (Date.now() - started < 5_000) {
    try {
      const current = await provider.request({ method: "eth_chainId" });
      if (typeof current === "string" && current.toLowerCase() === targetHex) return;
    } catch {
      // Wallets can briefly reject reads while network switching settles.
    }
    await delay(120);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
