import { createPublicClient, formatUnits, getAddress, http, type Address } from "viem";
import { sepolia } from "viem/chains";
import {
  arcTestnet,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  ETHEREUM_SEPOLIA_RPC_URL,
} from "./chain";

const SEPOLIA_USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export type TokenBalance = {
  raw: bigint;
  formatted: string;
  symbol: string;
  decimals: number;
};

export async function readNativeBalance(chainId: number, owner: Address): Promise<TokenBalance> {
  if (chainId === ARC_TESTNET_CHAIN_ID) {
    const raw = await arcPublicClient.getBalance({ address: owner });
    return {
      raw,
      decimals: arcTestnet.nativeCurrency.decimals,
      symbol: arcTestnet.nativeCurrency.symbol,
      formatted: formatTokenAmount(raw, arcTestnet.nativeCurrency.decimals),
    };
  }

  if (chainId === ETHEREUM_SEPOLIA_CHAIN_ID) {
    const raw = await sepoliaPublicClient.getBalance({ address: owner });
    return {
      raw,
      decimals: sepolia.nativeCurrency.decimals,
      symbol: sepolia.nativeCurrency.symbol,
      formatted: formatTokenAmount(raw, sepolia.nativeCurrency.decimals),
    };
  }

  throw new Error("Unsupported balance chain.");
}

export async function readSepoliaUsdcBalance(owner: Address): Promise<TokenBalance> {
  const configuredAddress = process.env.NEXT_PUBLIC_SEPOLIA_USDC_ADDRESS || SEPOLIA_USDC_ADDRESS;
  if (!configuredAddress) throw new Error("Sepolia USDC token address is not configured.");

  const tokenAddress = getAddress(configuredAddress);
  const [raw, decimals, symbol] = await Promise.all([
    sepoliaPublicClient.readContract({
      address: tokenAddress,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [owner],
    }),
    readErc20Decimals(tokenAddress),
    readErc20Symbol(tokenAddress),
  ]);

  return {
    raw,
    decimals,
    symbol,
    formatted: formatTokenAmount(raw, decimals),
  };
}

export async function readArcNativeUsdcBalance(owner: Address): Promise<TokenBalance> {
  return readNativeBalance(ARC_TESTNET_CHAIN_ID, owner);
}

export function formatTokenAmount(value: bigint, decimals: number, maxDecimals = 6): string {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function formatBalanceLine(label: string, value: TokenBalance | undefined, symbol = value?.symbol): string {
  if (!value) return `${label}: Balance unavailable`;
  return `${label}: ${value.formatted} ${symbol ?? value.symbol}`;
}

async function readErc20Decimals(tokenAddress: Address): Promise<number> {
  try {
    return await sepoliaPublicClient.readContract({
      address: tokenAddress,
      abi: erc20BalanceAbi,
      functionName: "decimals",
    });
  } catch {
    return 6;
  }
}

async function readErc20Symbol(tokenAddress: Address): Promise<string> {
  try {
    return await sepoliaPublicClient.readContract({
      address: tokenAddress,
      abi: erc20BalanceAbi,
      functionName: "symbol",
    });
  } catch {
    return "USDC";
  }
}

const sepoliaPublicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL || ETHEREUM_SEPOLIA_RPC_URL),
});

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC_URL),
});
