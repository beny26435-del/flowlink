import type { Address, Hex, PublicClient, WalletClient } from "viem";

export type CreateLinkInput = {
  recipient: Address;
  amount: bigint;
  deadline?: bigint;
  title: string;
  description?: string;
};

export type PayLinkInput = {
  linkId: bigint;
  amount: bigint;
};

export type PaymentLink = {
  creator: Address;
  recipient: Address;
  amount: bigint;
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
};

export type LinkStatus = {
  exists: boolean;
  active: boolean;
  paid: boolean;
  expired: boolean;
  cancelled: boolean;
};

export type FlowLinkConfig = {
  contractAddress?: Address;
  rpcUrl?: string;
  privateKey?: Hex;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
};
