import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_TESTNET_RPC_URL } from "../arc/chain";
import { flowLinkAbi } from "./abi";
import type { CreateLinkInput, FlowLinkConfig, LinkStatus, PaymentLink } from "./types";

type FlowLinkWalletClient = ReturnType<typeof createFlowLinkWalletClient>;

type RawPaymentLink =
  | PaymentLink
  | readonly [
      Address,
      Address,
      bigint,
      bigint,
      string,
      string,
      boolean,
      boolean,
      Address,
      bigint,
      Hex,
      bigint,
      bigint,
    ];

export function createFlowLinkPublicClient(rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL) {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

export function createFlowLinkWalletClient(
  privateKey: Hex,
  rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL,
) {
  const account = privateKeyToAccount(privateKey);

  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

export async function createLink(config: FlowLinkConfig, input: CreateLinkInput): Promise<Hex> {
  const walletClient = requireWalletClient(config);

  return walletClient.writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "createLink",
    args: [input.recipient, input.amount, input.deadline ?? 0n, input.title, input.description ?? ""],
  });
}

export async function payLink(config: FlowLinkConfig, linkId: bigint, amount: bigint): Promise<Hex> {
  const walletClient = requireWalletClient(config);

  return walletClient.writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "payLink",
    args: [linkId],
    value: amount,
  });
}

export async function cancelLink(config: FlowLinkConfig, linkId: bigint): Promise<Hex> {
  const walletClient = requireWalletClient(config);

  return walletClient.writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "cancelLink",
    args: [linkId],
  });
}

export async function getLink(config: FlowLinkConfig, linkId: bigint): Promise<PaymentLink> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "getLink",
    args: [linkId],
  });

  return normalizePaymentLink(raw as RawPaymentLink);
}

export async function getCreatorLinks(config: FlowLinkConfig, creator: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "getCreatorLinks",
    args: [creator],
  });

  return [...result];
}

export async function getPayerLinks(config: FlowLinkConfig, payer: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "getPayerLinks",
    args: [payer],
  });

  return [...result];
}

export async function isPayable(config: FlowLinkConfig, linkId: bigint): Promise<boolean> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "isPayable",
    args: [linkId],
  });
}

export async function getLinkStatus(config: FlowLinkConfig, linkId: bigint): Promise<LinkStatus> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkAbi,
    functionName: "getLinkStatus",
    args: [linkId],
  });

  return {
    exists: result[0],
    active: result[1],
    paid: result[2],
    expired: result[3],
    cancelled: result[4],
  };
}

function requirePublicClient(config: FlowLinkConfig): PublicClient {
  return config.publicClient ?? createFlowLinkPublicClient(config.rpcUrl);
}

function requireWalletClient(config: FlowLinkConfig): FlowLinkWalletClient {
  if (config.walletClient) {
    return config.walletClient as FlowLinkWalletClient;
  }

  const privateKey = config.privateKey ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("FlowLink walletClient or PRIVATE_KEY is required for write operations.");
  }

  return createFlowLinkWalletClient(normalizePrivateKey(privateKey), config.rpcUrl);
}

function resolveContractAddress(config: FlowLinkConfig): Address {
  const address =
    config.contractAddress ??
    process.env.FLOWLINK_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS;

  if (!address) {
    throw new Error("FlowLink contract address is required.");
  }

  return address as Address;
}

function normalizePrivateKey(privateKey: string): Hex {
  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
}

function normalizePaymentLink(raw: RawPaymentLink): PaymentLink {
  if (Array.isArray(raw)) {
    const values = raw as readonly [
      Address,
      Address,
      bigint,
      bigint,
      string,
      string,
      boolean,
      boolean,
      Address,
      bigint,
      Hex,
      bigint,
      bigint,
    ];

    return {
      creator: values[0],
      recipient: values[1],
      amount: values[2],
      deadline: values[3],
      title: values[4],
      description: values[5],
      active: values[6],
      paid: values[7],
      payer: values[8],
      paidAt: values[9],
      receiptId: values[10],
      createdAt: values[11],
      cancelledAt: values[12],
    };
  }

  return raw as PaymentLink;
}
