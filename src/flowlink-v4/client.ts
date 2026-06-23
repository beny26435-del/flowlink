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
import { flowLinkV4Abi } from "./abi";
import type {
  CreateGroupLinkInput,
  CreateInvoiceLinkInput,
  CreatePaymentLinkInput,
  CreateUnlockLinkInput,
  FlowLinkV4Config,
  Link,
  LinkMode,
  LinkStatus,
  Profile,
  ProfileTipStats,
  UpsertProfileInput,
} from "./types";

type FlowLinkWalletClient = ReturnType<typeof createFlowLinkV4WalletClient>;

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
  | readonly [Address, string, string, string, string, boolean, bigint, bigint, boolean, bigint];

export function createFlowLinkV4PublicClient(rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL) {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

export function createFlowLinkV4WalletClient(
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

export async function upsertProfile(config: FlowLinkV4Config, input: UpsertProfileInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "upsertProfile",
    args: [
      input.username ?? "",
      input.displayName ?? "",
      input.bio ?? "",
      input.avatarUrl ?? "",
      input.tipsEnabled ?? false,
      input.minimumTipAmount ?? 0n,
    ],
  });
}

export async function getProfileByAddress(config: FlowLinkV4Config, owner: Address): Promise<Profile> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getProfileByAddress",
    args: [owner],
  });
  return normalizeProfile(raw as RawProfile);
}

export async function getProfileByUsername(config: FlowLinkV4Config, username: string): Promise<Profile> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getProfileByUsername",
    args: [username],
  });
  return normalizeProfile(raw as RawProfile);
}

export async function getAddressByUsername(config: FlowLinkV4Config, username: string): Promise<Address> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getAddressByUsername",
    args: [username],
  }) as Promise<Address>;
}

export async function createPaymentLink(config: FlowLinkV4Config, input: CreatePaymentLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "createPaymentLink",
    args: [input.recipient, input.amount, input.deadline ?? 0n, input.title, input.description ?? "", input.slug, input.listed],
  });
}

export async function createInvoiceLink(config: FlowLinkV4Config, input: CreateInvoiceLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
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

export async function createUnlockLink(config: FlowLinkV4Config, input: CreateUnlockLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
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

export async function createGroupLink(config: FlowLinkV4Config, input: CreateGroupLinkInput): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "createGroupLink",
    args: [input.recipient, input.goalAmount, input.deadline, input.title, input.description ?? "", input.slug, input.listed],
  });
}

export async function payLink(config: FlowLinkV4Config, linkId: bigint, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "payLink",
    args: [linkId],
    value: amount,
  });
}

export async function contributeGroup(config: FlowLinkV4Config, linkId: bigint, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "contributeGroup",
    args: [linkId],
    value: amount,
  });
}

export async function refundGroup(config: FlowLinkV4Config, linkId: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "refundGroup",
    args: [linkId],
  });
}

export async function cancelLink(config: FlowLinkV4Config, linkId: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "cancelLink",
    args: [linkId],
  });
}

export async function getLink(config: FlowLinkV4Config, linkId: bigint): Promise<Link> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getLink",
    args: [linkId],
  });
  return normalizeLink(raw as RawLink);
}

export async function getLinkBySlug(config: FlowLinkV4Config, slug: string): Promise<Link> {
  const raw = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getLinkBySlug",
    args: [slug],
  });
  return normalizeLink(raw as RawLink);
}

export async function getLinkIdBySlug(config: FlowLinkV4Config, slug: string): Promise<bigint> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getLinkIdBySlug",
    args: [slug],
  }) as Promise<bigint>;
}

export async function getCreatorLinks(config: FlowLinkV4Config, creator: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getCreatorLinks",
    args: [creator],
  });
  return [...(result as bigint[])];
}

export async function getListedCreatorLinks(config: FlowLinkV4Config, creator: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getListedCreatorLinks",
    args: [creator],
  });
  return [...(result as bigint[])];
}

export async function getPayerLinks(config: FlowLinkV4Config, payer: Address): Promise<bigint[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getPayerLinks",
    args: [payer],
  });
  return [...(result as bigint[])];
}

export async function getGroupContributors(config: FlowLinkV4Config, linkId: bigint): Promise<Address[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getGroupContributors",
    args: [linkId],
  });
  return [...(result as Address[])];
}

export async function getGroupContribution(
  config: FlowLinkV4Config,
  linkId: bigint,
  contributor: Address,
): Promise<bigint> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getGroupContribution",
    args: [linkId, contributor],
  }) as Promise<bigint>;
}

export async function tipProfile(config: FlowLinkV4Config, creator: Address, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "tipProfile",
    args: [creator],
    value: amount,
  });
}

export async function tipProfileByUsername(config: FlowLinkV4Config, username: string, amount: bigint): Promise<Hex> {
  return requireWalletClient(config).writeContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "tipProfileByUsername",
    args: [username],
    value: amount,
  });
}

export async function getProfileTippers(config: FlowLinkV4Config, creator: Address): Promise<Address[]> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getProfileTippers",
    args: [creator],
  });
  return [...(result as Address[])];
}

export async function getProfileTipFromPayer(config: FlowLinkV4Config, creator: Address, payer: Address): Promise<bigint> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getProfileTipFromPayer",
    args: [creator, payer],
  }) as Promise<bigint>;
}

export async function getProfileTipStats(config: FlowLinkV4Config, creator: Address): Promise<ProfileTipStats> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getProfileTipStats",
    args: [creator],
  });
  const [totalTips, tipCount, minimumTipAmount, tipsEnabled] = result as readonly [bigint, bigint, bigint, boolean];
  return { totalTips, tipCount, minimumTipAmount, tipsEnabled };
}

export async function isPayable(config: FlowLinkV4Config, linkId: bigint): Promise<boolean> {
  return requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "isPayable",
    args: [linkId],
  }) as Promise<boolean>;
}

export async function getLinkStatus(config: FlowLinkV4Config, linkId: bigint): Promise<LinkStatus> {
  const result = await requirePublicClient(config).readContract({
    address: resolveContractAddress(config),
    abi: flowLinkV4Abi,
    functionName: "getLinkStatus",
    args: [linkId],
  });
  return normalizeLinkStatus(result as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint]);
}

function requirePublicClient(config: FlowLinkV4Config): PublicClient {
  return config.publicClient ?? createFlowLinkV4PublicClient(config.rpcUrl);
}

function requireWalletClient(config: FlowLinkV4Config): FlowLinkWalletClient {
  if (config.walletClient) return config.walletClient as FlowLinkWalletClient;

  const privateKey = config.privateKey ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("FlowLink walletClient or PRIVATE_KEY is required for write operations.");
  }

  return createFlowLinkV4WalletClient(normalizePrivateKey(privateKey), config.rpcUrl);
}

function resolveContractAddress(config: FlowLinkV4Config): Address {
  const address =
    config.contractAddress ??
    process.env.ARCLET_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_ARCLET_CONTRACT_ADDRESS ??
    process.env.FLOWLINK_V4_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS;

  if (!address) throw new Error("Arclet contract address is required.");
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
    tipsEnabled: raw[8],
    minimumTipAmount: raw[9],
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
