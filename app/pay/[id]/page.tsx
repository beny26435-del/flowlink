"use client";

import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { AddressDisplay } from "../../components/AddressDisplay";
import { AmountDisplay } from "../../components/AmountDisplay";
import { Button } from "../../components/Button";
import { CopyButton } from "../../components/CopyButton";
import { LinkStatusBadge } from "../../components/LinkStatusBadge";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { NetworkNotice } from "../../components/NetworkNotice";
import { PageTransition } from "../../components/PageTransition";
import { ReceiptCard } from "../../components/ReceiptCard";
import { WalletConnectButton } from "../../components/WalletConnectButton";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasFlowLinkContractAddress } from "../../config";
import { formatDateTime, getGroupProgress, getModeText, normalizeLinkStatus, normalizePaymentLink, type RawLink } from "../../lib/link";
import { arcTestnet } from "../../../src/arc/chain";
import { flowLinkV2Abi } from "../../../src/flowlink-v2/abi";
import { buildExplorerAddressUrl, buildExplorerTxUrl, formatNativeUsdcAmount, parseNativeUsdcAmount } from "../../../src/flowlink-v2/utils";
import type { LinkMode } from "../../../src/flowlink-v2/types";

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const linkId = useMemo(() => parseLinkId(params.id), [params.id]);
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [error, setError] = useState("");

  const enabled = Boolean(hasFlowLinkContractAddress && flowLinkContractAddress && linkId);

  const linkRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV2Abi,
    functionName: "getLink",
    args: linkId ? [linkId] : undefined,
    query: { enabled },
  });

  const statusRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV2Abi,
    functionName: "getLinkStatus",
    args: linkId ? [linkId] : undefined,
    query: { enabled },
  });

  const payableRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV2Abi,
    functionName: "isPayable",
    args: linkId ? [linkId] : undefined,
    query: { enabled },
  });

  const link = linkRead.data ? normalizePaymentLink(linkRead.data as RawLink) : undefined;
  const status = normalizeLinkStatus(statusRead.data as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint] | undefined);
  const isGroup = link?.mode === 3;
  const payability = Boolean(payableRead.data);
  const loading = Boolean(enabled && (linkRead.isLoading || statusRead.isLoading || payableRead.isLoading));
  const invalid = !linkId || status?.exists === false || Boolean(linkRead.error && !link);
  const canWrite = Boolean(isConnected && chainId === arcTestnet.id && flowLinkContractAddress);
  const canPay = Boolean(linkId && link && !isGroup && payability && canWrite);

  const contributorsRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV2Abi,
    functionName: "getGroupContributors",
    args: linkId ? [linkId] : undefined,
    query: { enabled: Boolean(enabled && isGroup) },
  });

  const contributionRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV2Abi,
    functionName: "getGroupContribution",
    args: linkId && address ? [linkId, address] : undefined,
    query: { enabled: Boolean(enabled && isGroup && address) },
  });

  const userContribution = contributionRead.data ?? 0n;
  const canRefund = Boolean(isGroup && link && userContribution > 0n && !link.paid && (status?.expired || status?.cancelled) && canWrite);

  async function refresh() {
    await Promise.all([
      linkRead.refetch(),
      statusRead.refetch(),
      payableRead.refetch(),
      contributorsRead.refetch(),
      contributionRead.refetch(),
    ]);
  }

  async function handlePay() {
    if (!linkId || !link || !flowLinkContractAddress || !publicClient) return;

    setError("");
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV2Abi,
        functionName: "payLink",
        args: [linkId],
        value: link.amount,
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed.");
    }
  }

  async function handleContribute() {
    if (!linkId || !flowLinkContractAddress || !publicClient) return;

    setError("");
    setTxHash(null);

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
        abi: flowLinkV2Abi,
        functionName: "contributeGroup",
        args: [linkId],
        value: parsed,
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setContributionAmount("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contribution failed.");
    }
  }

  async function handleRefund() {
    if (!linkId || !flowLinkContractAddress || !publicClient) return;
    setError("");
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV2Abi,
        functionName: "refundGroup",
        args: [linkId],
        chainId: arcTestnet.id,
      });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
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

  if (!linkId) {
    return (
      <PageTransition>
        <InvalidState title="Invalid payment link" body="The payment link id must be a positive number." />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {loading ? (
        <section className="checkout-grid">
          <div className="section checkout-card">
            <LoadingSkeleton rows={7} />
          </div>
          <aside className="section">
            <LoadingSkeleton rows={3} />
          </aside>
        </section>
      ) : invalid || !link ? (
        <InvalidState title="Payment link not found" body="This FlowLink ID does not exist on the Arc Testnet contract." />
      ) : (
        <section className="checkout-grid">
          <motion.div className="section checkout-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="status-row">
              <LinkStatusBadge status={status} />
              <span className="badge">{getModeText(link.mode)}</span>
              <span className="badge">Link #{linkId.toString()}</span>
              <span className="badge">Arc Testnet</span>
            </div>

            <div className="checkout-amount">
              <AmountDisplay amount={link.amount} />
            </div>
            <h1 className="page-title">{link.title}</h1>
            {link.description && <p className="page-subtitle">{link.description}</p>}

            {isGroup && <GroupProgress link={link} contributorsCount={contributorsRead.data?.length ?? 0} />}
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

          <motion.aside className="section sticky-panel checkout-side-card" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
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

            {error && <motion.div className="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}

            {txHash && (
              <div className="data-list">
                <DataRow label="Transaction" value={<a className="mono" href={buildExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">{txHash}</a>} />
              </div>
            )}
          </motion.aside>

          {link.paid && <ReceiptCard linkId={linkId} link={link} txHash={txHash} />}

          <section className="section technical-panel">
            <h2>Technical details</h2>
            <div className="data-list">
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
              <DataRow label="Contract URL" value={<a className="mono" href={buildExplorerAddressUrl(flowLinkContractAddress!)} target="_blank" rel="noreferrer">{buildExplorerAddressUrl(flowLinkContractAddress!)}</a>} />
            </div>
          </section>
        </section>
      )}
    </PageTransition>
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
      <DataRow label="Client" value={link.clientName || "-"} />
      <DataRow label="Invoice" value={link.invoiceNumber || "-"} />
      <DataRow label="Service" value={link.serviceTitle || "-"} />
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
      <strong>{link.successMessage || "Unlocked"}</strong>
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

function parseLinkId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return undefined;
  return BigInt(raw);
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
