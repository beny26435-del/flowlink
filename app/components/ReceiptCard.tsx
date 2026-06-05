"use client";

import type { Hex } from "viem";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { AmountDisplay } from "./AmountDisplay";
import { AddressDisplay } from "./AddressDisplay";
import { CopyButton } from "./CopyButton";
import { buildExplorerTxUrl } from "../../src/flowlink-v4/utils";
import type { Link } from "../../src/flowlink-v4/types";
import { formatDateTime, getModeText } from "../lib/link";

export function ReceiptCard({
  linkId,
  link,
  txHash,
  amountOverride,
}: {
  linkId: bigint;
  link: Link;
  txHash?: Hex | null;
  amountOverride?: bigint | null;
}) {
  const amount = amountOverride ?? (link.paidAmount > 0n ? link.paidAmount : link.amount);

  return (
    <motion.section
      className="receipt-card"
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="receipt-header">
        <div>
          <span className="badge good pulse">Arc Testnet receipt</span>
          <h2>Payment receipt</h2>
        </div>
        <motion.span className="success-mark" initial={{ scale: 0.72, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 240, damping: 16 }}>
          ✓
        </motion.span>
      </div>
      <div className="receipt-list">
        <ReceiptRow label="Link ID" value={linkId.toString()} />
        <ReceiptRow label="Mode" value={getModeText(link.mode)} />
        <ReceiptRow label="Payer" value={<AddressDisplay address={link.payer} copy />} />
        <ReceiptRow label="Recipient" value={<AddressDisplay address={link.recipient} copy />} />
        <ReceiptRow label="Amount" value={<AmountDisplay amount={amount} />} />
        <ReceiptRow label="Paid at" value={formatDateTime(link.paidAt)} />
        <ReceiptRow label="Receipt ID" value={<span className="mono">{link.receiptId}</span>} />
        {txHash && (
          <ReceiptRow
            label="Payment tx"
            value={
              <div className="hash-field">
                <a className="mono hash-value" href={buildExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
                  {txHash}
                </a>
                <div className="hash-actions">
                  <CopyButton value={txHash} label="Copy hash" compact />
                  <a className="copy-button" href={buildExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              </div>
            }
          />
        )}
      </div>
      <div className="actions">
        <CopyButton value={link.receiptId} label="Copy receipt ID" />
      </div>
    </motion.section>
  );
}

function ReceiptRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="receipt-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
