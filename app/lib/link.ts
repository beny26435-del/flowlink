import type { Address, Hex } from "viem";
import type { Link, LinkMode, LinkStatus, Profile } from "../../src/flowlink-v4/types";
import { getModeLabel, getProgressPercent } from "../../src/flowlink-v4/utils";

export type RawLink =
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

export type RawProfile = Profile | readonly [Address, string, string, string, string, boolean, bigint, bigint, boolean, bigint];

export function normalizePaymentLink(raw: RawLink): Link {
  if (Array.isArray(raw)) {
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

  return raw as Link;
}

export function normalizeLinkStatus(
  raw?: readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint],
): LinkStatus | undefined {
  if (!raw) return undefined;

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

export function formatDateTime(timestamp: bigint) {
  if (timestamp === 0n) return "-";
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export function getStatusText(status?: LinkStatus) {
  if (!status?.exists) return "Unavailable";
  if (status.paid) return status.mode === 3 ? "Funded" : "Paid";
  if (status.cancelled) return "Cancelled";
  if (status.expired) return "Expired";
  if (status.active) return status.mode === 3 ? "Funding" : "Payable";
  return "Inactive";
}

export function getModeText(mode: LinkMode) {
  return getModeLabel(mode);
}

export function getGroupProgress(link: Link) {
  return getProgressPercent(link.paidAmount, link.amount);
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
