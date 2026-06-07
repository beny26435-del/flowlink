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
import { flowLinkV2Abi } from "./abi";
import type {
  CreateGroupLinkInput,
  CreateInvoiceLinkInput,
  CreatePaymentLinkInput,
  CreateUnlockLinkInput,
  FlowLinkV2Config,
  Link,
  LinkMode,
  LinkStatus,
} from "./types";

type FlowLinkWalletClient = ReturnType<typeof createFlowLinkV2WalletClient>;

type RawLink =
  | Link
  | readonly [
      LinkMode,
      Address,
      Address,
      bigint,
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
      string,
      string,
      string,
      string,
      string,
    ];

export function createFlowLinkV2PublicClient(rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL) {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

export function createFlowLinkV2WalletClient(
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

export async function createPaymentLink(config: FlowLinkV2Config, input: CreatePaymentLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "createPaymentLink",
    args: [input.recipient, input.amount, input.deadline ?? 0n, input.title, input.description ?? ""],
  });
}

export async function createInvoiceLink(config: FlowLinkV2Config, input: CreateInvoiceLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "createInvoiceLink",
    args: [
      input.recipient,
      input.amount,
      input.deadline ?? 0n,
      input.clientName,
      input.invoiceNumber ?? "",
      input.serviceTitle,
      input.description ?? "",
    ],
  });
}

export async function createUnlockLink(config: FlowLinkV2Config, input: CreateUnlockLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "createUnlockLink",
    args: [
      input.recipient,
      input.amount,
      input.deadline ?? 0n,
      input.title,
      input.description ?? "",
      input.successMessage ?? "",
      input.unlockUrl ?? "",
    ],
  });
}

export async function createGroupLink(config: FlowLinkV2Config, input: CreateGroupLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "createGroupLink",
    args: [input.recipient, input.goalAmount, input.deadline, input.title, input.description ?? ""],
  });
}

export async function payLink(config: FlowLinkV2Config, linkId: bigint, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "payLink",
    args: [linkId],
    value: amount,
  });
}

export async function contributeGroup(config: FlowLinkV2Config, linkId: bigint, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "contributeGroup",
    args: [linkId],
    value: amount,
  });
}

export async function refundGroup(config: FlowLinkV2Config, linkId: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "refundGroup",
    args: [linkId],
  });
}

export async function cancelLink(config: FlowLinkV2Config, linkId: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "cancelLink",
    args: [linkId],
  });
}

export async function getLink(config: FlowLinkV2Config, linkId: bigint): Promise<Link> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "getLink",
    args: [linkId],
  });

  return normalizeLink(raw as RawLink);
}

export async function getCreatorLinks(config: FlowLinkV2Config, creator: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "getCreatorLinks",
    args: [creator],
  });

  return [...(result as bigint[])];
}

export async function getPayerLinks(config: FlowLinkV2Config, payer: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "getPayerLinks",
    args: [payer],
  });

  return [...(result as bigint[])];
}

export async function getGroupContributors(config: FlowLinkV2Config, linkId: bigint): Promise<Address[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "getGroupContributors",
    args: [linkId],
  });

  return [...(result as `0x${string}`[])];
}

export async function getGroupContribution(
  config: FlowLinkV2Config,
  linkId: bigint,
  contributor: Address,
): Promise<bigint> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "getGroupContribution",
    args: [linkId, contributor],
  });

  return result as bigint;
}

export async function isPayable(config: FlowLinkV2Config, linkId: bigint): Promise<boolean> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "isPayable",
    args: [linkId],
  });

  return result as boolean;
}

export async function getLinkStatus(config: FlowLinkV2Config, linkId: bigint): Promise<LinkStatus> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV2Abi,
    functionName: "getLinkStatus",
    args: [linkId],
  });

  return normalizeLinkStatus(result as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint]);
}

function requirePublicClient(config: FlowLinkV2Config): PublicClient {
  return config.publicClient ?? createFlowLinkV2PublicClient(config.rpcUrl);
}

function requireWalletClient(config: FlowLinkV2Config): FlowLinkWalletClient {
  if (config.walletClient) return config.walletClient as FlowLinkWalletClient;

  const privateKey = config.privateKey ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("FlowLink walletClient or PRIVATE_KEY is required for write operations.");
  }

  return createFlowLinkV2WalletClient(normalizePrivateKey(privateKey), config.rpcUrl);
}

function resolveContractAddress(config: FlowLinkV2Config): Address {
  const address =
    config.contractAddress ??
    process.env.FLOWLINK_V2_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS;

  if (!address) throw new Error("FlowLink contract address is required.");
  return address as Address;
}

function normalizePrivateKey(privateKey: string): Hex {
  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
}

export function normalizeLink(raw: RawLink): Link {
  if (!Array.isArray(raw)) return raw as Link;

  return {
    mode: raw[0],
    creator: raw[1],
    recipient: raw[2],
    amount: raw[3],
    paidAmount: raw[4],
    deadline: raw[5],
    title: raw[6],
    description: raw[7],
    active: raw[8],
    paid: raw[9],
    payer: raw[10],
    paidAt: raw[11],
    receiptId: raw[12],
    createdAt: raw[13],
    cancelledAt: raw[14],
    clientName: raw[15],
    invoiceNumber: raw[16],
    serviceTitle: raw[17],
    successMessage: raw[18],
    unlockUrl: raw[19],
  };
}

export function normalizeLinkStatus(raw: readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint]): LinkStatus {
  return {
    exists: raw[0],
    active: raw[1],
    paid: raw[2],
    expired: raw[3],
    cancelled: raw[4],
    mode: raw[5],
    paidAmount: raw[6],
    remainingAmount: raw[7],
  };
}
