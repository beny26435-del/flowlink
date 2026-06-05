"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { flowLinkV4Abi } from "../../src/flowlink-v4/abi";
import { buildProfileUrl, formatNativeUsdcAmount, normalizeUsername, parseNativeUsdcAmount, validateUsername } from "../../src/flowlink-v4/utils";
import { arcTestnet } from "../../src/arc/chain";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { Input, Textarea } from "../components/FormControls";
import { NetworkNotice } from "../components/NetworkNotice";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { WalletConnectButton } from "../components/WalletConnectButton";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasFlowLinkContractAddress } from "../config";
import { normalizeProfile, type RawProfile } from "../lib/link";

export default function ProfilePage() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tipsEnabled, setTipsEnabled] = useState(false);
  const [minimumTipAmount, setMinimumTipAmount] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [error, setError] = useState("");

  const profileRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getProfileByAddress",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(hasFlowLinkContractAddress && address) },
  });

  const profile = profileRead.data ? normalizeProfile(profileRead.data as RawProfile) : undefined;

  const tipStatsRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getProfileTipStats",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(hasFlowLinkContractAddress && address && profile?.exists) },
  });

  const tipStats = tipStatsRead.data as readonly [bigint, bigint, bigint, boolean] | undefined;

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setAvatarUrl(profile.avatarUrl);
    setTipsEnabled(profile.tipsEnabled);
    setMinimumTipAmount(profile.minimumTipAmount > 0n ? formatNativeUsdcAmount(profile.minimumTipAmount) : "");
  }, [profile]);

  const normalizedUsername = normalizeUsername(username);
  const usernameIsValid = validateUsername(normalizedUsername);
  const profileUrl = useMemo(() => {
    if (!address || typeof window === "undefined") return "";
    return buildProfileUrl(window.location.origin, {
      owner: address,
      username: normalizedUsername,
    });
  }, [address, normalizedUsername]);

  const canSubmit = Boolean(
    hasFlowLinkContractAddress &&
      isConnected &&
      address &&
      chainId === arcTestnet.id &&
      usernameIsValid &&
      displayName.length <= 80 &&
      bio.length <= 280 &&
      avatarUrl.length <= 500,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTxHash(null);

    if (!flowLinkContractAddress || !publicClient) {
      setError(FLOWLINK_CONTRACT_MISSING_MESSAGE);
      return;
    }

    if (!usernameIsValid) {
      setError("Username can use lowercase letters, numbers, hyphen, or underscore. Use 3–32 characters.");
      return;
    }

    let parsedMinimumTipAmount: bigint;
    try {
      parsedMinimumTipAmount = minimumTipAmount.trim() ? parseNativeUsdcAmount(minimumTipAmount) : 0n;
    } catch {
      setError("Enter a valid minimum tip amount.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV4Abi,
        functionName: "upsertProfile",
        args: [normalizedUsername, displayName.trim(), bio.trim(), avatarUrl.trim(), tipsEnabled, parsedMinimumTipAmount],
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await profileRead.refetch();
      await tipStatsRead.refetch();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Profile update failed.";
      setError(message.includes("UsernameAlreadyTaken") ? "That username is already taken. Try another one." : message);
    }
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Profile"
        title="Your FlowLink profile"
        subtitle="Create one public profile for invoices, payment links, unlocks, group funding, and profile tips."
        actions={<WalletConnectButton />}
      />
      <NetworkNotice />
      {!hasFlowLinkContractAddress && <div className="error">{FLOWLINK_CONTRACT_MISSING_MESSAGE}</div>}

      {!isConnected ? (
        <section className="empty-state">
          <div className="empty-orb" />
          <h2>Connect your wallet</h2>
          <p className="page-subtitle">Use your connected wallet to create or edit your public profile.</p>
          <WalletConnectButton />
        </section>
      ) : (
        <section className="builder-grid">
          <motion.form className="form-panel form" onSubmit={handleSubmit} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Input
              id="username"
              label="Username"
              help="Optional. Lowercase letters, numbers, hyphen, or underscore. 3–32 characters."
              value={username}
              maxLength={32}
              placeholder="alice_pay"
              aria-invalid={Boolean(username && !usernameIsValid)}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
            />
            <Input
              id="displayName"
              label="Display name"
              value={displayName}
              maxLength={80}
              placeholder="Alice Studio"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Textarea
              id="bio"
              label="Bio"
              value={bio}
              maxLength={280}
              placeholder="Stablecoin invoices and product design on Arc."
              onChange={(event) => setBio(event.target.value)}
            />
            <Input
              id="avatarUrl"
              label="Avatar URL"
              value={avatarUrl}
              maxLength={500}
              placeholder="https://..."
              onChange={(event) => setAvatarUrl(event.target.value)}
            />

            <div className="section compact-profile-settings">
              <div className="preview-header">
                <div>
                  <span className="badge good">Tip Jar</span>
                  <h2>Profile tips</h2>
                  <p className="muted">Let supporters send flexible native Arc USDC directly from your public profile.</p>
                </div>
              </div>
              <label className="toggle-row">
                <input type="checkbox" checked={tipsEnabled} onChange={(event) => setTipsEnabled(event.target.checked)} />
                <span>Enable tips on my public profile</span>
              </label>
              <Input
                id="minimumTipAmount"
                label="Minimum tip amount"
                help="Optional. Leave empty or 0 for open tipping. Tips forward immediately and are not refundable."
                value={minimumTipAmount}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(event) => setMinimumTipAmount(event.target.value)}
              />
              <div className="dashboard-meta-grid">
                <div className="data-row">
                  <span>Total tips</span>
                  <strong>{formatNativeUsdcAmount(tipStats?.[0] ?? 0n)} USDC</strong>
                </div>
                <div className="data-row">
                  <span>Tip count</span>
                  <strong>{(tipStats?.[1] ?? 0n).toString()}</strong>
                </div>
              </div>
            </div>

            {profileUrl && (
              <div className="notice">
                Public profile: <span className="mono">{normalizedUsername ? `/@${normalizedUsername}` : `/u/${address}`}</span>
              </div>
            )}

            {error && <div className="error">{error}</div>}

            <div className="actions">
              <Button type="submit" disabled={!canSubmit || isPending}>
                {isPending ? "Saving..." : "Save profile"}
              </Button>
              {profileUrl && <CopyButton value={profileUrl} label="Copy profile link" />}
              {profileUrl && (
                <Button href={normalizedUsername ? `/@${normalizedUsername}` : `/u/${address}`} variant="secondary">
                  Open public profile
                </Button>
              )}
            </div>

            {txHash && <p className="small">Profile saved on Arc Testnet.</p>}
          </motion.form>

          <aside className="preview-card">
            <div className="preview-header">
              <span className="badge good">Public profile</span>
              <span className="badge">FlowLink</span>
            </div>
            <ProfileAvatarPreview avatarUrl={avatarUrl} displayName={displayName} />
            <h2 className="preview-title">{displayName || "Your display name"}</h2>
            {normalizedUsername && <p className="muted">@{normalizedUsername}</p>}
            <p className="muted">{bio || "Add a short bio so payers know who they are paying."}</p>
            <div className="preview-divider" />
            <div className="notice">
              Tip Jar: {tipsEnabled ? `Enabled${minimumTipAmount ? ` · Minimum ${minimumTipAmount} USDC` : " · No minimum"}` : "Disabled"}
            </div>
            <p className="small">Listed FlowLinks will appear on this public profile.</p>
          </aside>
        </section>
      )}
    </PageTransition>
  );
}

function ProfileAvatarPreview({ avatarUrl, displayName }: { avatarUrl: string; displayName: string }) {
  if (avatarUrl) return <img className="profile-avatar preview-profile-avatar" src={avatarUrl} alt="" />;
  return <div className="profile-avatar fallback-avatar preview-profile-avatar">{(displayName || "FL").slice(0, 2).toUpperCase()}</div>;
}
