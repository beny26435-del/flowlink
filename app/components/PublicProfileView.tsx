"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { arcTestnet } from "../../src/arc/chain";
import { flowLinkV4Abi } from "../../src/flowlink-v4/abi";
import type { Link, LinkMode, LinkStatus, Profile } from "../../src/flowlink-v4/types";
import { buildExplorerTxUrl, buildPublicPayUrl, formatNativeUsdcAmount, parseNativeUsdcAmount, validateUsername } from "../../src/flowlink-v4/utils";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasArcletContractAddress } from "../config";
import { productText } from "../lib/displayText";
import { formatDateTime, getGroupProgress, getModeText, normalizeLinkStatus, normalizePaymentLink, normalizeProfile, type RawLink, type RawProfile } from "../lib/link";
import { AddressDisplay } from "./AddressDisplay";
import { AmountDisplay } from "./AmountDisplay";
import { AppKitFundingCenter } from "./AppKitFundingCenter";
import { Button } from "./Button";
import { CopyButton } from "./CopyButton";
import { LinkStatusBadge } from "./LinkStatusBadge";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PageTransition } from "./PageTransition";
import { StatCard } from "./StatCard";

type PublicProfileViewProps =
  | { address: string; username?: never }
  | { address?: never; username: string };

type ListedSummary = {
  linkId: bigint;
  link?: Link;
  status?: LinkStatus;
};

export function PublicProfileView(props: PublicProfileViewProps) {
  const addressParam = "address" in props ? props.address : undefined;
  const usernameParam = "username" in props ? props.username : undefined;
  const validAddress = addressParam && isAddress(addressParam) ? getAddress(addressParam) : undefined;
  const validUsername = usernameParam ? usernameParam.trim().toLowerCase() : undefined;
  const usernameIsValid = validUsername ? validateUsername(validUsername) : true;

  const usernameProfileRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getProfileByUsername",
    args: validUsername ? [validUsername] : undefined,
    query: { enabled: Boolean(hasArcletContractAddress && validUsername && usernameIsValid) },
  });

  const usernameProfile = usernameProfileRead.data ? normalizeProfile(usernameProfileRead.data as RawProfile) : undefined;
  const owner = validAddress ?? usernameProfile?.owner;

  const addressProfileRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getProfileByAddress",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(hasArcletContractAddress && owner && validAddress) },
  });

  const addressProfile = addressProfileRead.data ? normalizeProfile(addressProfileRead.data as RawProfile) : undefined;
  const profile = usernameProfile ?? addressProfile ?? makeEmptyProfile(owner);

  const listedIdsRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getListedCreatorLinks",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(hasArcletContractAddress && owner) },
  });

  const linkIds = useMemo(() => [...((listedIdsRead.data as bigint[] | undefined) ?? [])].reverse(), [listedIdsRead.data]);

  const linksRead = useReadContracts({
    contracts: linkIds.map((linkId) => ({
      address: flowLinkContractAddress,
      abi: flowLinkV4Abi,
      functionName: "getLink",
      args: [linkId],
    })),
    query: { enabled: Boolean(hasArcletContractAddress && linkIds.length > 0) },
  });

  const statusesRead = useReadContracts({
    contracts: linkIds.map((linkId) => ({
      address: flowLinkContractAddress,
      abi: flowLinkV4Abi,
      functionName: "getLinkStatus",
      args: [linkId],
    })),
    query: { enabled: Boolean(hasArcletContractAddress && linkIds.length > 0) },
  });

  const summaries = useMemo<ListedSummary[]>(() => {
    return linkIds.map((linkId, index) => ({
      linkId,
      link: linksRead.data?.[index]?.status === "success" ? normalizePaymentLink(linksRead.data[index].result as unknown as RawLink) : undefined,
      status:
        statusesRead.data?.[index]?.status === "success"
          ? normalizeLinkStatus(statusesRead.data[index].result as unknown as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint])
          : undefined,
    }));
  }, [linkIds, linksRead.data, statusesRead.data]);

  const displayName = productText(profile?.displayName) || (owner ? shortAddress(owner) : "Arclet profile");
  const totalVolume = summaries.reduce((sum, item) => sum + (item.link?.amount ?? 0n), 0n);
  const paidCount = summaries.filter((item) => item.status?.paid).length;
  const loading = Boolean(usernameProfileRead.isLoading || addressProfileRead.isLoading || listedIdsRead.isLoading);
  const usernameNotFound = Boolean(validUsername && !usernameProfileRead.isLoading && (usernameProfileRead.error || !usernameProfile));

  const tipStatsRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getProfileTipStats",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(hasArcletContractAddress && owner && profile?.exists) },
  });

  const tipStats = tipStatsRead.data as readonly [bigint, bigint, bigint, boolean] | undefined;

  if (!hasArcletContractAddress) {
    return <ProfileNotFound title="Arclet unavailable" body={FLOWLINK_CONTRACT_MISSING_MESSAGE} />;
  }

  if (validUsername && (!usernameIsValid || usernameNotFound)) {
    return <ProfileNotFound title="Profile not found" body="This public profile is not available on Arc Testnet." />;
  }

  if ("address" in props && !validAddress) {
    return <ProfileNotFound title="Invalid profile" body="This profile address is not valid." />;
  }

  return (
    <PageTransition>
      <section className="profile-hero section">
        {loading && !owner ? (
          <LoadingSkeleton rows={5} />
        ) : (
          <>
            <ProfileAvatar profile={profile} owner={owner} />
            <div className="profile-copy">
              <span className="eyebrow">Public profile</span>
              <h1 className="page-title">{displayName}</h1>
              {profile?.username && <p className="page-subtitle">@{profile.username}</p>}
              {profile?.bio && <p className="page-subtitle">{productText(profile.bio)}</p>}
              {owner && (
                <div className="actions">
                  <AddressDisplay address={owner} copy />
                  <CopyButton value={typeof window === "undefined" ? "" : window.location.href} label="Copy profile link" />
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="stats-grid">
        <StatCard label="Listed links" value={summaries.length} detail="Visible on this profile" />
        <StatCard label="Paid/Funded" value={paidCount} detail="Completed Arclet links" delay={0.04} />
        <StatCard
          label="Profile tips"
          value={`${formatNativeUsdcAmount(tipStats?.[0] ?? 0n)} USDC`}
          detail={`${(tipStats?.[1] ?? 0n).toString()} tips received`}
          delay={0.08}
        />
        <StatCard label="Network" value="Arc Testnet" detail="Native USDC payments" delay={0.12} />
      </section>

      {owner && profile?.tipsEnabled && (
        <>
          <TipProfileCard profile={profile} owner={owner} stats={tipStats} onTipped={() => void tipStatsRead.refetch()} />
          <AppKitFundingCenter recipient={owner} amount={tipStats?.[2] ?? profile.minimumTipAmount} mode="Profile Tip Jar" reference={profile.username ? `@${profile.username}` : undefined} />
        </>
      )}

      {listedIdsRead.isLoading ? (
        <section className="section">
          <LoadingSkeleton rows={6} />
        </section>
      ) : summaries.length === 0 ? (
        <section className="empty-state">
          <div className="empty-orb" />
          <h2>No listed links yet</h2>
          <p className="page-subtitle">This profile does not have public Arclet links right now.</p>
          <Button href="/create">Create your own Arclet</Button>
        </section>
      ) : (
        <section className="link-list">
          {summaries.map((summary, index) => (
            <ListedLinkCard key={summary.linkId.toString()} summary={summary} index={index} />
          ))}
        </section>
      )}
    </PageTransition>
  );
}

function ListedLinkCard({ summary, index }: { summary: ListedSummary; index: number }) {
  const { link, status } = summary;
  const paymentUrl = typeof window !== "undefined" && link?.slug ? buildPublicPayUrl(window.location.origin, link.slug) : "";

  return (
    <motion.article className="item-card dashboard-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.035 }}>
      {!link ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="dashboard-card-head">
            <div>
              <div className="status-row">
                <LinkStatusBadge status={status} />
                <span className="badge">{getModeText(link.mode)}</span>
              </div>
              <h2>{productText(link.title)}</h2>
              {link.description && <p className="muted">{productText(link.description)}</p>}
            </div>
            <div className="dashboard-amount">
              <AmountDisplay amount={link.amount} />
            </div>
          </div>

          {link.mode === 3 && (
            <div className="progress-wrap compact">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${getGroupProgress(link)}%` }} />
              </div>
              <span className="small">
                {formatNativeUsdcAmount(link.paidAmount)} of {formatNativeUsdcAmount(link.amount)} USDC funded
              </span>
            </div>
          )}

          <div className="dashboard-meta-grid">
            <DataRow label="Payment page" value={`/p/${link.slug}`} />
            <DataRow label="Deadline" value={formatDateTime(link.deadline)} />
            <DataRow label="Recipient" value={<AddressDisplay address={link.recipient} />} />
          </div>

          <div className="actions">
            <Button href={`/p/${link.slug}`} variant="secondary">
              Open payment page
            </Button>
            {paymentUrl && <CopyButton value={paymentUrl} label="Copy link" />}
          </div>
        </>
      )}
    </motion.article>
  );
}

function TipProfileCard({
  profile,
  owner,
  stats,
  onTipped,
}: {
  profile: Profile;
  owner: Address;
  stats?: readonly [bigint, bigint, bigint, boolean];
  onTipped: () => void;
}) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState<bigint | null>(null);
  const [error, setError] = useState("");
  const minimumTipAmount = stats?.[2] ?? profile.minimumTipAmount;
  const tipsEnabled = stats?.[3] ?? profile.tipsEnabled;
  const amountValidation = getTipAmountValidation(amount, minimumTipAmount);

  useEffect(() => {
    setAmount(minimumTipAmount > 0n ? formatNativeUsdcAmount(minimumTipAmount) : "");
  }, [minimumTipAmount, owner]);

  async function handleTip() {
    if (!flowLinkContractAddress || !publicClient) return;
    setError("");
    setTxHash(null);
    setConfirmedAmount(null);

    const validation = getTipAmountValidation(amount, minimumTipAmount);
    if (validation) {
      setError(validation);
      return;
    }

    let parsed: bigint;
    try {
      parsed = parseNativeUsdcAmount(amount);
    } catch {
      setError("Enter a valid native Arc USDC tip amount.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV4Abi,
        functionName: profile.username ? "tipProfileByUsername" : "tipProfile",
        args: profile.username ? [profile.username] : [owner],
        value: parsed,
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setConfirmedAmount(parsed);
      onTipped();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tip failed.");
    }
  }

  return (
    <motion.section className="section profile-tip-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }}>
      <div className="dashboard-card-head">
        <div>
          <span className="badge good pulse">Tip Jar</span>
          <h2>Tip this creator</h2>
          <p className="muted">Send flexible native Arc USDC directly to this profile. Tips forward immediately and are not refundable.</p>
        </div>
        <div className="dashboard-amount">
          {minimumTipAmount > 0n ? <AmountDisplay amount={minimumTipAmount} /> : <span className="amount-xl">Open</span>}
          <p className="small">{minimumTipAmount > 0n ? "Minimum tip" : "No minimum"}</p>
        </div>
      </div>

      <div className="dashboard-meta-grid">
        <DataRow label="Total tips" value={`${formatNativeUsdcAmount(stats?.[0] ?? 0n)} USDC`} />
        <DataRow label="Tip count" value={(stats?.[1] ?? 0n).toString()} />
        <DataRow label="Creator" value={<AddressDisplay address={owner} copy />} />
      </div>

      {tipsEnabled ? (
        <div className="actions">
          <label className="field inline-field">
            <span>Tip amount</span>
            <input
              value={amount}
              inputMode="decimal"
              placeholder={minimumTipAmount > 0n ? formatNativeUsdcAmount(minimumTipAmount) : "1.00"}
              onChange={(event) => {
                setAmount(event.target.value);
                setError("");
              }}
            />
            {amountValidation && <small>{amountValidation}</small>}
          </label>
          <Button type="button" disabled={Boolean(amountValidation) || !isConnected || chainId !== arcTestnet.id || isPending || address?.toLowerCase() === owner.toLowerCase()} onClick={handleTip}>
            {isPending ? "Sending tip..." : "Send tip"}
          </Button>
        </div>
      ) : (
        <div className="notice">Tips are not enabled for this profile.</div>
      )}

      {confirmedAmount !== null && (
        <div className="state-message good checkout-state-panel">
          <strong>Tip sent</strong>
          <span>{formatNativeUsdcAmount(confirmedAmount)} native Arc USDC was sent to this creator.</span>
          {txHash && (
            <a className="secondary-button tx-action-link" href={buildExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </motion.section>
  );
}

function ProfileAvatar({ profile, owner }: { profile?: Profile; owner?: Address }) {
  if (profile?.avatarUrl) {
    return <img className="profile-avatar" src={profile.avatarUrl} alt="" />;
  }

  return <div className="profile-avatar fallback-avatar">{owner ? shortAddress(owner).slice(2, 4).toUpperCase() : "AR"}</div>;
}

function ProfileNotFound({ title, body }: { title: string; body: string }) {
  return (
    <PageTransition>
      <section className="empty-state">
        <div className="empty-orb" />
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{body}</p>
        <Button href="/create">Create an Arclet link</Button>
      </section>
    </PageTransition>
  );
}

function makeEmptyProfile(owner?: Address): Profile | undefined {
  if (!owner) return undefined;
  return {
    owner,
    username: "",
    displayName: "",
    bio: "",
    avatarUrl: "",
    exists: false,
    createdAt: 0n,
    updatedAt: 0n,
    tipsEnabled: false,
    minimumTipAmount: 0n,
  };
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTipAmountValidation(amount: string, minimumTipAmount: bigint): string {
  if (!amount.trim()) return "Enter an amount";

  let parsed: bigint;
  try {
    parsed = parseNativeUsdcAmount(amount);
  } catch {
    return "Enter a valid native Arc USDC tip amount.";
  }

  if (parsed <= 0n) return "Tip amount must be greater than zero.";
  if (minimumTipAmount > 0n && parsed < minimumTipAmount) return `Minimum tip is ${formatNativeUsdcAmount(minimumTipAmount)} native Arc USDC.`;
  return "";
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
