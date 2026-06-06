"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Address, Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { arcTestnet } from "../../src/arc/chain";
import { flowLinkV4Abi } from "../../src/flowlink-v4/abi";
import type { LinkMode } from "../../src/flowlink-v4/types";
import { buildExplorerAddressUrl, buildExplorerTxUrl, formatNativeUsdcAmount, parseNativeUsdcAmount } from "../../src/flowlink-v4/utils";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasFlowLinkContractAddress } from "../config";
import { productText } from "../lib/displayText";
import { formatDateTime, getGroupProgress, getModeText, normalizeLinkStatus, normalizePaymentLink, type RawLink } from "../lib/link";
import { AddressDisplay } from "./AddressDisplay";
import { AmountDisplay } from "./AmountDisplay";
import { AppKitFundingCenter } from "./AppKitFundingCenter";
import { Button } from "./Button";
import { CopyButton } from "./CopyButton";
import { LinkStatusBadge } from "./LinkStatusBadge";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { NetworkNotice } from "./NetworkNotice";
import { PageTransition } from "./PageTransition";
import { ReceiptCard } from "./ReceiptCard";
import { WalletConnectButton } from "./WalletConnectButton";

type PayLinkViewProps = {
  linkId?: bigint;
  routeKey: string;
  slug?: string;
};

export function PayLinkView({ linkId, slug, routeKey }: PayLinkViewProps) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [txConfirmed, setTxConfirmed] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTxHash(null);
    setTxConfirmed(false);
    setError("");
    setContributionAmount("");
  }, [routeKey]);

  const slugMode = Boolean(slug);
  const validRoute = Boolean(slug || linkId);
  const enabled = Boolean(hasFlowLinkContractAddress && flowLinkContractAddress && validRoute);

  const slugIdRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getLinkIdBySlug",
    args: slug ? [slug] : undefined,
    query: { enabled: Boolean(enabled && slug) },
  });

  const resolvedLinkId = linkId ?? (slugIdRead.data as bigint | undefined);

  const linkRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: slugMode ? "getLinkBySlug" : "getLink",
    args: slugMode ? (slug ? [slug] : undefined) : linkId ? [linkId] : undefined,
    query: { enabled },
  });

  const statusRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: slugMode ? "getLinkStatusBySlug" : "getLinkStatus",
    args: slugMode ? (slug ? [slug] : undefined) : linkId ? [linkId] : undefined,
    query: { enabled },
  });

  const payableRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: slugMode ? "isPayableBySlug" : "isPayable",
    args: slugMode ? (slug ? [slug] : undefined) : linkId ? [linkId] : undefined,
    query: { enabled },
  });

  const link = linkRead.data ? normalizePaymentLink(linkRead.data as RawLink) : undefined;
  const status = normalizeLinkStatus(statusRead.data as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint] | undefined);
  const isGroup = link?.mode === 3;
  const payability = Boolean(payableRead.data);
  const loading = Boolean(enabled && (linkRead.isLoading || statusRead.isLoading || payableRead.isLoading || (slugMode && slugIdRead.isLoading)));
  const invalid = !validRoute || status?.exists === false || Boolean((linkRead.error || slugIdRead.error) && !link);
  const canWrite = Boolean(isConnected && chainId === arcTestnet.id && flowLinkContractAddress);
  const canPay = Boolean(link && !isGroup && payability && canWrite);

  const contributorsRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getGroupContributors",
    args: resolvedLinkId ? [resolvedLinkId] : undefined,
    query: { enabled: Boolean(enabled && isGroup && resolvedLinkId) },
  });

  const contributionRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV4Abi,
    functionName: "getGroupContribution",
    args: resolvedLinkId && address ? [resolvedLinkId, address] : undefined,
    query: { enabled: Boolean(enabled && isGroup && resolvedLinkId && address) },
  });

  const userContribution = (contributionRead.data as bigint | undefined) ?? 0n;
  const canRefund = Boolean(isGroup && link && userContribution > 0n && !link.paid && (status?.expired || status?.cancelled) && canWrite);

  async function refresh() {
    await Promise.all([
      slugIdRead.refetch(),
      linkRead.refetch(),
      statusRead.refetch(),
      payableRead.refetch(),
      contributorsRead.refetch(),
      contributionRead.refetch(),
    ]);
  }

  async function handlePay() {
    if (!link || !flowLinkContractAddress || !publicClient) return;

    setError("");
    setTxHash(null);
    setTxConfirmed(false);

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV4Abi,
        functionName: "payLink",
        args: [resolvedLinkId!],
        value: link.amount,
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxConfirmed(true);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed.");
    }
  }

  async function handleContribute() {
    if (!flowLinkContractAddress || !publicClient) return;

    setError("");
    setTxHash(null);
    setTxConfirmed(false);

    let parsed: bigint;
    try {
      parsed = parseNativeUsdcAmount(contributionAmount);
    } catch {
      setError("Enter a valid native Arc USDC contribution.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV4Abi,
        functionName: "contributeGroup",
        args: [resolvedLinkId!],
        value: parsed,
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxConfirmed(true);
      setContributionAmount("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contribution failed.");
    }
  }

  async function handleRefund() {
    if (!flowLinkContractAddress || !publicClient) return;
    setError("");
    setTxHash(null);
    setTxConfirmed(false);

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV4Abi,
        functionName: "refundGroup",
        args: [resolvedLinkId!],
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxConfirmed(true);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Refund failed.");
    }
  }

  if (!hasFlowLinkContractAddress) {
    return (
      <PageTransition>
        <InvalidState title="FlowLink unavailable" body={FLOWLINK_CONTRACT_MISSING_MESSAGE} />
      </PageTransition>
    );
  }

  if (!validRoute) {
    return (
      <PageTransition>
        <InvalidState title="Invalid payment page" body="This payment page could not be resolved." />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {loading ? (
        <section className="checkout-grid pay-checkout-grid">
          <div className="section checkout-card">
            <LoadingSkeleton rows={7} />
          </div>
          <aside className="section checkout-side-card">
            <LoadingSkeleton rows={3} />
          </aside>
        </section>
      ) : invalid || !link ? (
        <InvalidState title="Payment page not found" body="This FlowLink payment page does not exist on the Arc Testnet contract." />
      ) : (
        <section className="checkout-grid pay-checkout-grid">
          <motion.div className="section checkout-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="status-row">
              <LinkStatusBadge status={status} />
              <span className="badge">{getModeText(link.mode)}</span>
              {slugMode ? <span className="badge">/{link.slug}</span> : <span className="badge">Link #{resolvedLinkId?.toString()}</span>}
              <span className="badge">Arc Testnet</span>
            </div>

            <div className="checkout-amount">
              <AmountDisplay amount={link.amount} />
            </div>
            <h1 className="page-title">{productText(link.title)}</h1>
            {link.description && <p className="page-subtitle">{productText(link.description)}</p>}

            {isGroup && <GroupProgress link={link} contributorsCount={(contributorsRead.data as Address[] | undefined)?.length ?? 0} />}
            {link.mode === 1 && <InvoiceDetails link={link} />}
            {link.mode === 2 && <UnlockDetails link={link} />}

            <div className="checkout-detail-grid data-list">
              <DataRow label="Creator" value={<AddressDisplay address={link.creator} copy />} />
              <DataRow label="Recipient" value={<AddressDisplay address={link.recipient} copy />} />
              <DataRow label="Deadline" value={formatDateTime(link.deadline)} />
              <DataRow label="Contract" value={<AddressDisplay address={flowLinkContractAddress!} />} />
              {link.receiptId !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                <DataRow label="Receipt ID" value={<span className="mono">{link.receiptId}</span>} />
              )}
            </div>
          </motion.div>

          <motion.aside className="section checkout-side-card" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
            <h2>{getPanelTitle(link, status)}</h2>
            <WalletConnectButton />
            <NetworkNotice />

            {isGroup ? (
              <GroupActionPanel
                link={link}
                status={status}
                userContribution={userContribution}
                contributionAmount={contributionAmount}
                setContributionAmount={setContributionAmount}
                canWrite={canWrite}
                canRefund={canRefund}
                isPending={isPending}
                onContribute={handleContribute}
                onRefund={handleRefund}
              />
            ) : link.paid ? (
              <div className="state-message good checkout-state-panel">
                <strong>Payment complete</strong>
                <span>The onchain receipt is shown below with payer, amount, timestamp, and receipt ID.</span>
              </div>
            ) : status?.cancelled ? (
              <div className="state-message danger checkout-state-panel">
                <strong>Payment unavailable</strong>
                <span>This link was cancelled by the creator and can no longer be paid.</span>
              </div>
            ) : status?.expired ? (
              <div className="state-message warn checkout-state-panel">
                <strong>Deadline passed</strong>
                <span>This payment link is expired and can no longer accept native Arc USDC.</span>
              </div>
            ) : (
              <div className="data-list">
                <DataRow label="You will send" value={<AmountDisplay amount={link.amount} />} />
                <DataRow label="To recipient" value={<AddressDisplay address={link.recipient} />} />
                <p className="small">You will send the exact native Arc USDC amount on Arc Testnet. This is a native msg.value payment, not ERC20 transferFrom.</p>
                <Button type="button" disabled={!canPay || isPending} onClick={handlePay}>
                  {isPending ? "Paying on Arc..." : "Pay with native Arc USDC"}
                </Button>
              </div>
            )}

            <AppKitFundingCenter
              recipient={link.recipient}
              amount={isGroup ? (status?.remainingAmount ?? link.amount - link.paidAmount) : link.amount}
              mode={getModeText(link.mode)}
              reference={slugMode ? `/${link.slug}` : resolvedLinkId ? `Link #${resolvedLinkId.toString()}` : undefined}
            />

            {error && <motion.div className="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}
            {txHash && <TransactionStatusAction txHash={txHash} complete={Boolean(link.paid)} confirmed={txConfirmed} label="Payment" />}
          </motion.aside>

          {link.paid && resolvedLinkId && <ReceiptCard linkId={resolvedLinkId} link={link} txHash={txHash} />}

          <details className="section technical-panel">
            <summary>
              <span>Technical details</span>
              <span className="technical-summary-copy">Contract status, tuple values, and Arcscan reference</span>
            </summary>
            <div className="data-list technical-data-list">
              {resolvedLinkId && <DataRow label="Raw link ID" value={resolvedLinkId.toString()} />}
              <DataRow label="Slug" value={<span className="mono">{link.slug}</span>} />
              <DataRow
                label="Status tuple"
                value={
                  status
                    ? `exists=${status.exists} active=${status.active} paid=${status.paid} expired=${status.expired} cancelled=${status.cancelled}`
                    : "Loading"
                }
              />
              <DataRow label="Is payable" value={String(payability)} />
              <DataRow label="Mode" value={getModeText(link.mode)} />
              <DataRow label="Paid amount" value={`${formatNativeUsdcAmount(link.paidAmount)} USDC`} />
              <DataRow label="Payer" value={<AddressDisplay address={link.payer} copy />} />
              <DataRow label="Paid at" value={formatDateTime(link.paidAt)} />
              {txHash && <DataRow label="Transaction hash" value={<HashField value={txHash} href={buildExplorerTxUrl(txHash)} />} />}
              <DataRow label="Contract URL" value={<a className="mono" href={buildExplorerAddressUrl(flowLinkContractAddress!)} target="_blank" rel="noreferrer">{buildExplorerAddressUrl(flowLinkContractAddress!)}</a>} />
            </div>
          </details>
        </section>
      )}
    </PageTransition>
  );
}

function TransactionStatusAction({ txHash, complete, confirmed, label }: { txHash: Hex; complete: boolean; confirmed: boolean; label: string }) {
  const message = complete
    ? `${label} confirmed on Arc Testnet.`
    : confirmed
      ? `Latest ${label.toLowerCase()} confirmed on Arc Testnet.`
      : "Transaction submitted. Waiting for Arc confirmation.";

  return (
    <div className="tx-action-panel">
      <span>{message}</span>
      <a className="secondary-button tx-action-link" href={buildExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
        View transaction
      </a>
    </div>
  );
}

function HashField({ value, href }: { value: Hex; href?: string }) {
  return (
    <div className="hash-field">
      {href ? (
        <a className="mono hash-value" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span className="mono hash-value">{value}</span>
      )}
      <div className="hash-actions">
        <CopyButton value={value} label="Copy hash" compact />
        {href && (
          <a className="copy-button" href={href} target="_blank" rel="noreferrer">
            Open
          </a>
        )}
      </div>
    </div>
  );
}

function GroupActionPanel({
  link,
  status,
  userContribution,
  contributionAmount,
  setContributionAmount,
  canWrite,
  canRefund,
  isPending,
  onContribute,
  onRefund,
}: {
  link: NonNullable<ReturnType<typeof normalizePaymentLink>>;
  status?: ReturnType<typeof normalizeLinkStatus>;
  userContribution: bigint;
  contributionAmount: string;
  setContributionAmount: (value: string) => void;
  canWrite: boolean;
  canRefund: boolean;
  isPending: boolean;
  onContribute: () => void;
  onRefund: () => void;
}) {
  if (link.paid) {
    return (
      <div className="state-message good checkout-state-panel">
        <strong>Group funded</strong>
        <span>The full goal was funded and forwarded to the recipient.</span>
      </div>
    );
  }

  return (
    <div className="data-list">
      <DataRow label="Remaining" value={`${formatNativeUsdcAmount(status?.remainingAmount ?? link.amount - link.paidAmount)} USDC`} />
      <DataRow label="Your contribution" value={`${formatNativeUsdcAmount(userContribution)} USDC`} />
      {status?.cancelled && <div className="state-message danger"><strong>Cancelled</strong><span>Contributors can refund from this page.</span></div>}
      {status?.expired && <div className="state-message warn"><strong>Expired</strong><span>Contributors can refund if the group was not funded.</span></div>}
      {!status?.cancelled && !status?.expired && (
        <>
          <label className="field">
            <span>Contribution amount</span>
            <input value={contributionAmount} inputMode="decimal" placeholder="25.00" onChange={(event) => setContributionAmount(event.target.value)} />
          </label>
          <Button type="button" disabled={!canWrite || isPending} onClick={onContribute}>
            {isPending ? "Contributing..." : "Contribute native Arc USDC"}
          </Button>
        </>
      )}
      {canRefund && (
        <Button type="button" variant="secondary" disabled={isPending} onClick={onRefund}>
          {isPending ? "Refunding..." : "Refund contribution"}
        </Button>
      )}
    </div>
  );
}

function GroupProgress({ link, contributorsCount }: { link: NonNullable<ReturnType<typeof normalizePaymentLink>>; contributorsCount: number }) {
  const progress = getGroupProgress(link);

  return (
    <div className="group-progress-card">
      <div className="preview-header">
        <span className="badge good">Group</span>
        <span className="small">{contributorsCount} contributors</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="data-list">
        <DataRow label="Funded" value={`${formatNativeUsdcAmount(link.paidAmount)} USDC`} />
        <DataRow label="Goal" value={`${formatNativeUsdcAmount(link.amount)} USDC`} />
        <DataRow label="Progress" value={`${progress.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function InvoiceDetails({ link }: { link: NonNullable<ReturnType<typeof normalizePaymentLink>> }) {
  return (
    <div className="mode-detail-panel">
      <DataRow label="Client" value={productText(link.clientName) || "-"} />
      <DataRow label="Invoice" value={productText(link.invoiceNumber) || "-"} />
      <DataRow label="Service" value={productText(link.serviceTitle) || "-"} />
    </div>
  );
}

function UnlockDetails({ link }: { link: NonNullable<ReturnType<typeof normalizePaymentLink>> }) {
  if (!link.paid) {
    return (
      <div className="state-message warn checkout-state-panel">
        <strong>Unlocks after payment</strong>
        <span>The success message and unlock URL are onchain metadata and become useful after payment.</span>
      </div>
    );
  }

  return (
    <div className="state-message good checkout-state-panel">
      <strong>{productText(link.successMessage) || "Unlocked"}</strong>
      {link.unlockUrl && (
        <a className="mono" href={link.unlockUrl} target="_blank" rel="noreferrer">
          {link.unlockUrl}
        </a>
      )}
      {link.receiptId && <CopyButton value={link.receiptId} label="Copy receipt ID" />}
    </div>
  );
}

function getPanelTitle(link: NonNullable<ReturnType<typeof normalizePaymentLink>>, status?: ReturnType<typeof normalizeLinkStatus>) {
  if (link.mode === 3) return link.paid ? "Funded" : "Group funding";
  if (link.paid) return "Paid";
  if (status?.cancelled) return "Cancelled";
  if (status?.expired) return "Expired";
  return "Checkout";
}

function InvalidState({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-state">
      <div className="empty-orb" />
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{body}</p>
      <Button href="/create">Create a FlowLink</Button>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
