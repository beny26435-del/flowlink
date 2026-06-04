"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AddressDisplay } from "../components/AddressDisplay";
import { AmountDisplay } from "../components/AmountDisplay";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { ExplorerLink } from "../components/ExplorerLink";
import { LinkStatusBadge } from "../components/LinkStatusBadge";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { NetworkNotice } from "../components/NetworkNotice";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { StatCard } from "../components/StatCard";
import { WalletConnectButton } from "../components/WalletConnectButton";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasFlowLinkContractAddress } from "../config";
import { formatDateTime, getGroupProgress, getModeText, normalizeLinkStatus, normalizePaymentLink, type RawLink } from "../lib/link";
import { arcTestnet } from "../../src/arc/chain";
import { flowLinkV2Abi } from "../../src/flowlink-v2/abi";
import { buildPaymentUrl, formatNativeUsdcAmount } from "../../src/flowlink-v2/utils";
import type { Link, LinkMode, LinkStatus } from "../../src/flowlink-v2/types";

type Filter = "all" | "payable" | "paid" | "cancelled" | "expired" | "payment" | "invoice" | "unlock" | "group";

type Summary = {
  linkId: bigint;
  link?: Link;
  status?: LinkStatus;
};

const filters: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "payable", label: "Payable" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired", label: "Expired" },
  { key: "payment", label: "Payment" },
  { key: "invoice", label: "Invoice" },
  { key: "unlock", label: "Unlock" },
  { key: "group", label: "Group" },
];

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<Filter>("all");

  const creatorLinksRead = useReadContract({
    address: flowLinkContractAddress,
    abi: flowLinkV2Abi,
    functionName: "getCreatorLinks",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(hasFlowLinkContractAddress && address) },
  });

  const linkIds = useMemo(() => [...(creatorLinksRead.data ?? [])].reverse(), [creatorLinksRead.data]);

  const linksRead = useReadContracts({
    contracts: linkIds.map((linkId) => ({
      address: flowLinkContractAddress,
      abi: flowLinkV2Abi,
      functionName: "getLink",
      args: [linkId],
    })),
    query: { enabled: Boolean(hasFlowLinkContractAddress && linkIds.length > 0) },
  });

  const statusesRead = useReadContracts({
    contracts: linkIds.map((linkId) => ({
      address: flowLinkContractAddress,
      abi: flowLinkV2Abi,
      functionName: "getLinkStatus",
      args: [linkId],
    })),
    query: { enabled: Boolean(hasFlowLinkContractAddress && linkIds.length > 0) },
  });

  const summaries = useMemo<Summary[]>(() => {
    return linkIds.map((linkId, index) => ({
      linkId,
      link: linksRead.data?.[index]?.status === "success" ? normalizePaymentLink(linksRead.data[index].result as unknown as RawLink) : undefined,
      status:
        statusesRead.data?.[index]?.status === "success"
          ? normalizeLinkStatus(statusesRead.data[index].result as unknown as readonly [boolean, boolean, boolean, boolean, boolean, LinkMode, bigint, bigint])
          : undefined,
    }));
  }, [linkIds, linksRead.data, statusesRead.data]);

  const filtered = summaries.filter((summary) => matchesFilter(summary.status, filter));
  const totalVolume = summaries.reduce((sum, item) => sum + (item.link?.amount ?? 0n), 0n);
  const paidVolume = summaries.reduce((sum, item) => sum + (item.status?.paid ? item.link?.paidAmount || item.link?.amount || 0n : 0n), 0n);
  const payableCount = summaries.filter((item) => item.status?.active && !item.status.paid && !item.status.expired && !item.status.cancelled).length;
  const paidCount = summaries.filter((item) => item.status?.paid).length;

  async function refreshAll() {
    await Promise.all([creatorLinksRead.refetch(), linksRead.refetch(), statusesRead.refetch()]);
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Creator dashboard"
        title="Dashboard"
        subtitle="Manage FlowLink payment links, invoices, unlocks, and group funding links from your connected wallet."
        actions={
          <>
            <WalletConnectButton />
            <Button href="/create" variant="secondary">
              Create Link
            </Button>
          </>
        }
      />
      <NetworkNotice />
      {!hasFlowLinkContractAddress && <div className="error">{FLOWLINK_CONTRACT_MISSING_MESSAGE}</div>}

      {!isConnected ? (
        <section className="empty-state">
          <div className="empty-orb" />
          <h2>Connect your wallet</h2>
          <p className="page-subtitle">Load the FlowLinks created by your wallet on Arc Testnet.</p>
          <WalletConnectButton />
        </section>
      ) : !hasFlowLinkContractAddress ? (
        <section className="empty-state">
          <div className="empty-orb" />
          <h2>FlowLink unavailable</h2>
          <p className="page-subtitle">{FLOWLINK_CONTRACT_MISSING_MESSAGE}</p>
        </section>
      ) : creatorLinksRead.isLoading ? (
        <section className="section">
          <LoadingSkeleton rows={6} />
        </section>
      ) : linkIds.length === 0 ? (
        <section className="empty-state">
          <div className="empty-orb" />
          <h2>No FlowLinks yet</h2>
          <p className="page-subtitle">Create your first FlowLink on Arc Testnet.</p>
          <Button href="/create">Create your first link</Button>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard label="Total links" value={summaries.length} detail="Created by this wallet" />
            <StatCard label="Payable" value={payableCount} detail="Active and unpaid" delay={0.04} />
            <StatCard label="Paid/Funded" value={paidCount} detail={`${formatNativeUsdcAmount(paidVolume)} USDC received`} delay={0.08} />
            <StatCard label="Total volume" value={`${formatNativeUsdcAmount(totalVolume)} USDC`} detail="Created goal amount" delay={0.12} />
          </section>

          <section className="filter-bar" aria-label="Dashboard filters">
            {filters.map((item) => (
              <button className={filter === item.key ? "filter-button active" : "filter-button"} type="button" onClick={() => setFilter(item.key)} key={item.key}>
                {item.label}
              </button>
            ))}
          </section>

          {filtered.length === 0 ? (
            <section className="empty-state">
              <div className="empty-orb" />
              <h2>No links match this filter</h2>
              <p className="page-subtitle">Try another filter or create a new FlowLink.</p>
            </section>
          ) : (
            <section className="link-list">
              {filtered.map((summary, index) => (
                <DashboardLink key={summary.linkId.toString()} summary={summary} index={index} onChanged={refreshAll} />
              ))}
            </section>
          )}
        </>
      )}
    </PageTransition>
  );
}

function DashboardLink({ summary, index, onChanged }: { summary: Summary; index: number; onChanged: () => void }) {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [cancelTxHash, setCancelTxHash] = useState<Hex | null>(null);
  const [error, setError] = useState("");
  const { linkId, link, status } = summary;

  const paymentUrl = typeof window === "undefined" ? `/pay/${linkId.toString()}` : buildPaymentUrl(window.location.origin, linkId);
  const canCancel =
    Boolean(flowLinkContractAddress && link && status?.active && !status.paid && address && link.creator.toLowerCase() === address.toLowerCase()) &&
    chainId === arcTestnet.id;

  async function handleCancel() {
    if (!publicClient || !flowLinkContractAddress) return;
    setError("");
    setCancelTxHash(null);

    try {
      const txHash = await writeContractAsync({
        address: flowLinkContractAddress,
        abi: flowLinkV2Abi,
        functionName: "cancelLink",
        args: [linkId],
        chainId: arcTestnet.id,
      });

      setCancelTxHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cancel failed.");
    }
  }

  return (
    <motion.article
      className="item-card dashboard-card"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.035 }}
      whileHover={{ y: -6, boxShadow: "0 28px 90px rgba(0, 0, 0, 0.5)" }}
    >
      {!link ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="dashboard-card-head">
            <div>
              <div className="status-row">
                <LinkStatusBadge status={status} />
                <span className="badge">{getModeText(link.mode)}</span>
                <span className="badge">Link #{linkId.toString()}</span>
              </div>
              <h2>{link.title}</h2>
              {link.description && <p className="muted">{link.description}</p>}
            </div>
            <div className="dashboard-amount">
              <AmountDisplay amount={link.amount} />
            </div>
          </div>

          {link.mode === 3 && <DashboardGroupProgress link={link} />}
          {link.mode === 1 && (
            <div className="notice">Invoice for {link.clientName || "client"}{link.invoiceNumber ? ` · ${link.invoiceNumber}` : ""}</div>
          )}
          {link.mode === 2 && <div className="notice">Unlock content is available after payment.</div>}

          <div className="dashboard-meta-grid">
            <DataRow label="Recipient" value={<AddressDisplay address={link.recipient} copy />} />
            <DataRow label="Deadline" value={formatDateTime(link.deadline)} />
            <DataRow label="Pay page" value={`/pay/${linkId.toString()}`} />
          </div>

          {link.mode === 3 && (status?.cancelled || status?.expired) && !status.paid && (
            <p className="small">Contributors can refund from the pay page.</p>
          )}

          <div className="actions">
            <Button href={`/pay/${linkId.toString()}`} variant="secondary">
              Open pay page
            </Button>
            <CopyButton value={paymentUrl} label="Copy link" />
            {flowLinkContractAddress && <ExplorerLink kind="address" value={flowLinkContractAddress} label="Contract" />}
            {canCancel && (
              <Button variant="danger" type="button" disabled={isPending} onClick={handleCancel}>
                {isPending ? "Cancelling..." : "Cancel"}
              </Button>
            )}
          </div>

          {cancelTxHash && (
            <p className="small">
              Cancel tx:{" "}
              <a className="mono" href={`https://testnet.arcscan.app/tx/${cancelTxHash}`} target="_blank" rel="noreferrer">
                {cancelTxHash}
              </a>
            </p>
          )}
          {error && <div className="error">{error}</div>}
        </>
      )}
    </motion.article>
  );
}

function DashboardGroupProgress({ link }: { link: Link }) {
  const progress = getGroupProgress(link);

  return (
    <div className="progress-wrap compact">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="small">
        {formatNativeUsdcAmount(link.paidAmount)} of {formatNativeUsdcAmount(link.amount)} USDC funded
      </span>
    </div>
  );
}

function matchesFilter(status: LinkStatus | undefined, filter: Filter) {
  if (filter === "all") return true;
  if (!status) return false;
  if (filter === "payable") return status.active && !status.paid && !status.expired && !status.cancelled;
  if (filter === "paid") return status.paid;
  if (filter === "cancelled") return status.cancelled;
  if (filter === "expired") return status.expired;
  if (filter === "payment") return status.mode === 0;
  if (filter === "invoice") return status.mode === 1;
  if (filter === "unlock") return status.mode === 2;
  if (filter === "group") return status.mode === 3;
  return true;
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
