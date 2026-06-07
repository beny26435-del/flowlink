import { defineChain } from "viem";

export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";

export const ETHEREUM_SEPOLIA_CHAIN_ID = 11_155_111;
export const ETHEREUM_SEPOLIA_RPC_URL = "https://11155111.rpc.thirdweb.com";
export const ETHEREUM_SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL],
    },
    public: {
      http: [ARC_TESTNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: ARC_TESTNET_EXPLORER_URL,
    },
  },
  testnet: true,
});

export const arcTestnetConfig = {
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  rpc: ARC_TESTNET_RPC_URL,
  explorer: ARC_TESTNET_EXPLORER_URL,
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  viemChain: arcTestnet,
} as const;

export type AddEthereumChainParameter = {
  chainId: `0x${string}`;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

export function getWalletChainParams(chainId: number): AddEthereumChainParameter | undefined {
  if (chainId === ARC_TESTNET_CHAIN_ID) {
    return {
      chainId: toHexChainId(ARC_TESTNET_CHAIN_ID),
      chainName: "Arc Testnet",
      nativeCurrency: {
        name: "USDC",
        symbol: "USDC",
        decimals: 18,
      },
      rpcUrls: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC_URL],
      blockExplorerUrls: [ARC_TESTNET_EXPLORER_URL],
    };
  }

  if (chainId === ETHEREUM_SEPOLIA_CHAIN_ID) {
    return {
      chainId: toHexChainId(ETHEREUM_SEPOLIA_CHAIN_ID),
      chainName: "Ethereum Sepolia",
      nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: [process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL || ETHEREUM_SEPOLIA_RPC_URL],
      blockExplorerUrls: [ETHEREUM_SEPOLIA_EXPLORER_URL],
    };
  }

  return undefined;
}

function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}
