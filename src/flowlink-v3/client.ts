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
import { flowLinkV3Abi } from "./abi";
import type {
  CreateGroupLinkInput,
  CreateInvoiceLinkInput,
  CreatePaymentLinkInput,
  CreateUnlockLinkInput,
  FlowLinkV3Config,
  Link,
  LinkMode,
  LinkStatus,
  Profile,
  UpsertProfileInput,
} from "./types";

type FlowLinkWalletClient = ReturnType<typeof createFlowLinkV3WalletClient>;

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
      string,
      boolean,
    ];

type RawProfile =
  | Profile
  | readonly [Address, string, string, string, string, boolean, bigint, bigint];

export function createFlowLinkV3PublicClient(rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL) {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

export function createFlowLinkV3WalletClient(
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

export async function upsertProfile(config: FlowLinkV3Config, input: UpsertProfileInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "upsertProfile",
    args: [input.username ?? "", input.displayName ?? "", input.bio ?? "", input.avatarUrl ?? ""],
  });
}

export async function getProfileByAddress(config: FlowLinkV3Config, owner: Address): Promise<Profile> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getProfileByAddress",
    args: [owner],
  });
  return normalizeProfile(raw as RawProfile);
}

export async function getProfileByUsername(config: FlowLinkV3Config, username: string): Promise<Profile> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getProfileByUsername",
    args: [username],
  });
  return normalizeProfile(raw as RawProfile);
}

export async function getAddressByUsername(config: FlowLinkV3Config, username: string): Promise<Address> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getAddressByUsername",
    args: [username],
  }) as Promise<Address>;
}

export async function createPaymentLink(config: FlowLinkV3Config, input: CreatePaymentLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "createPaymentLink",
    args: [input.recipient, input.amount, input.deadline ?? 0n, input.title, input.description ?? "", input.slug, input.listed],
  });
}

export async function createInvoiceLink(config: FlowLinkV3Config, input: CreateInvoiceLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "createInvoiceLink",
    args: [
      input.recipient,
      input.amount,
      input.deadline ?? 0n,
      input.clientName,
      input.invoiceNumber ?? "",
      input.serviceTitle,
      input.description ?? "",
      input.slug,
      input.listed,
    ],
  });
}

export async function createUnlockLink(config: FlowLinkV3Config, input: CreateUnlockLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "createUnlockLink",
    args: [
      input.recipient,
      input.amount,
      input.deadline ?? 0n,
      input.title,
      input.description ?? "",
      input.successMessage ?? "",
      input.unlockUrl ?? "",
      input.slug,
      input.listed,
    ],
  });
}

export async function createGroupLink(config: FlowLinkV3Config, input: CreateGroupLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "createGroupLink",
    args: [input.recipient, input.goalAmount, input.deadline, input.title, input.description ?? "", input.slug, input.listed],
  });
}

export async function payLink(config: FlowLinkV3Config, linkId: bigint, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "payLink",
    args: [linkId],
    value: amount,
  });
}

export async function payLinkBySlug(config: FlowLinkV3Config, slug: string, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "payLinkBySlug",
    args: [slug],
    value: amount,
  });
}

export async function contributeGroup(config: FlowLinkV3Config, linkId: bigint, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "contributeGroup",
    args: [linkId],
    value: amount,
  });
}

export async function contributeGroupBySlug(config: FlowLinkV3Config, slug: string, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "contributeGroupBySlug",
    args: [slug],
    value: amount,
  });
}

export async function refundGroup(config: FlowLinkV3Config, linkId: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "refundGroup",
    args: [linkId],
  });
}

export async function refundGroupBySlug(config: FlowLinkV3Config, slug: string): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "refundGroupBySlug",
    args: [slug],
  });
}

export async function cancelLink(config: FlowLinkV3Config, linkId: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "cancelLink",
    args: [linkId],
  });
}

export async function cancelLinkBySlug(config: FlowLinkV3Config, slug: string): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "cancelLinkBySlug",
    args: [slug],
  });
}

export async function getLink(config: FlowLinkV3Config, linkId: bigint): Promise<Link> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getLink",
    args: [linkId],
  });
  return normalizeLink(raw as RawLink);
}

export async function getLinkBySlug(config: FlowLinkV3Config, slug: string): Promise<Link> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getLinkBySlug",
    args: [slug],
  });
  return normalizeLink(raw as RawLink);
}

export async function getLinkIdBySlug(config: FlowLinkV3Config, slug: string): Promise<bigint> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getLinkIdBySlug",
    args: [slug],
  }) as Promise<bigint>;
}

export async function getCreatorLinks(config: FlowLinkV3Config, creator: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getCreatorLinks",
    args: [creator],
  });
  return [...(result as bigint[])];
}

export async function getListedCreatorLinks(config: FlowLinkV3Config, creator: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getListedCreatorLinks",
    args: [creator],
  });
  return [...(result as bigint[])];
}

export async function getPayerLinks(config: FlowLinkV3Config, payer: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getPayerLinks",
    args: [payer],
  });
  return [...(result as bigint[])];
}

export async function getGroupContributors(config: FlowLinkV3Config, linkId: bigint): Promise<Address[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getGroupContributors",
    args: [linkId],
  });
  return [...(result as Address[])];
}

export async function getGroupContribution(
  config: FlowLinkV3Config,
  linkId: bigint,
  contributor: Address,
): Promise<bigint> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getGroupContribution",
    args: [linkId, contributor],
  }) as Promise<bigint>;
}

export async function isPayable(config: FlowLinkV3Config, linkId: bigint): Promise<boolean> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "isPayable",
    args: [linkId],
  }) as Promise<boolean>;
}

export async function getLinkStatus(config: FlowLinkV3Config, linkId: bigint): Promise<LinkStatus> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV3Abi,
    functionName: "getLinkStatus",
    args: [linkId],
  });
  return normalizeLinkStatus(result as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint]);
}

function requirePublicClient(config: FlowLinkV3Config): PublicClient {
  return config.publicClient ?? createFlowLinkV3PublicClient(config.rpcUrl);
}

function requireWalletClient(config: FlowLinkV3Config): FlowLinkWalletClient {
  if (config.walletClient) return config.walletClient as FlowLinkWalletClient;

  const privateKey = config.privateKey ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("FlowLink walletClient or PRIVATE_KEY is required for write operations.");
  }

  return createFlowLinkV3WalletClient(normalizePrivateKey(privateKey), config.rpcUrl);
}

function resolveContractAddress(config: FlowLinkV3Config): Address {
  const address =
    config.contractAddress ??
    process.env.FLOWLINK_V3_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_FLOWLINK_V3_CONTRACT_ADDRESS;

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
    slug: raw[20],
    listed: raw[21],
  };
}

export function normalizeProfile(raw: RawProfile): Profile {
  if (!Array.isArray(raw)) return raw as Profile;

  return {
    owner: raw[0],
    username: raw[1],
    displayName: raw[2],
    bio: raw[3],
    avatarUrl: raw[4],
    exists: raw[5],
    createdAt: raw[6],
    updatedAt: raw[7],
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
