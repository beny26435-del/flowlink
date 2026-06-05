import type { Address, Hex, PublicClient, WalletClient } from "viem";

export const LINK_MODES = ["Payment", "Invoice", "Unlock", "Group"] as const;

export type LinkMode = 0 | 1 | 2 | 3;
export type LinkModeLabel = (typeof LINK_MODES)[number];

export type Link = {
  mode: LinkMode;
  creator: Address;
  recipient: Address;
  amount: bigint;
  paidAmount: bigint;
  deadline: bigint;
  title: string;
  description: string;
  active: boolean;
  paid: boolean;
  payer: Address;
  paidAt: bigint;
  receiptId: Hex;
  createdAt: bigint;
  cancelledAt: bigint;
  clientName: string;
  invoiceNumber: string;
  serviceTitle: string;
  successMessage: string;
  unlockUrl: string;
  slug: string;
  listed: boolean;
};

export type Profile = {
  owner: Address;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  exists: boolean;
  createdAt: bigint;
  updatedAt: bigint;
};

export type LinkStatus = {
  exists: boolean;
  active: boolean;
  paid: boolean;
  expired: boolean;
  cancelled: boolean;
  mode: LinkMode;
  paidAmount: bigint;
  remainingAmount: bigint;
};

export type CreatePaymentLinkInput = {
  recipient: Address;
  amount: bigint;
  deadline?: bigint;
  title: string;
  description?: string;
  slug: string;
  listed: boolean;
};

export type CreateInvoiceLinkInput = {
  recipient: Address;
  amount: bigint;
  deadline?: bigint;
  clientName: string;
  invoiceNumber?: string;
  serviceTitle: string;
  description?: string;
  slug: string;
  listed: boolean;
};

export type CreateUnlockLinkInput = {
  recipient: Address;
  amount: bigint;
  deadline?: bigint;
  title: string;
  description?: string;
  successMessage?: string;
  unlockUrl?: string;
  slug: string;
  listed: boolean;
};

export type CreateGroupLinkInput = {
  recipient: Address;
  goalAmount: bigint;
  deadline: bigint;
  title: string;
  description?: string;
  slug: string;
  listed: boolean;
};

export type UpsertProfileInput = {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
};

export type FlowLinkV3Config = {
  contractAddress?: Address;
  rpcUrl?: string;
  privateKey?: Hex;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
};
