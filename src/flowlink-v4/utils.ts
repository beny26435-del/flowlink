import { formatNativeUsdcAmount, parseNativeUsdcAmount } from "../flowlink/utils";
import { LINK_MODES, type LinkMode, type LinkModeLabel, type Profile } from "./types";

export { buildExplorerAddressUrl, buildExplorerTxUrl } from "../flowlink/utils";
export { formatNativeUsdcAmount, parseNativeUsdcAmount };

const SLUG_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;

export function getModeLabel(mode: LinkMode): LinkModeLabel {
  return LINK_MODES[mode] ?? "Payment";
}

export function isExactPaymentMode(mode: LinkMode): boolean {
  return mode === 0 || mode === 1 || mode === 2;
}

export function getProgressPercent(paidAmount: bigint, amount: bigint): number {
  if (amount === 0n) return 0;
  const basisPoints = Number((paidAmount * 10000n) / amount);
  return Math.min(100, Math.max(0, basisPoints / 100));
}

export function normalizeSlugInput(slug: string): string {
  return slug.trim();
}

export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(normalizeSlugInput(slug));
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): boolean {
  const normalized = normalizeUsername(username);
  return normalized.length === 0 || USERNAME_PATTERN.test(normalized);
}

export function generateRandomSlug(mode: LinkMode | "payment" | "invoice" | "unlock" | "group"): string {
  const prefix =
    typeof mode === "number"
      ? ["pay", "inv", "unlock", "group"][mode]
      : mode === "payment"
        ? "pay"
        : mode === "invoice"
          ? "inv"
          : mode;
  return `${prefix}_${randomToken(10)}`;
}

export function buildPublicPayUrl(baseUrl: string, slug: string): string {
  return `${trimTrailingSlash(baseUrl)}/p/${encodeURIComponent(normalizeSlugInput(slug))}`;
}

export function buildProfileUrl(baseUrl: string, profile: Pick<Profile, "owner" | "username">): string {
  const root = trimTrailingSlash(baseUrl);
  return profile.username ? `${root}/@${encodeURIComponent(profile.username)}` : `${root}/u/${profile.owner}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
