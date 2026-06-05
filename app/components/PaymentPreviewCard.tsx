"use client";

import { motion } from "framer-motion";
import { AddressDisplay } from "./AddressDisplay";

export type PreviewMode = "payment" | "invoice" | "unlock" | "group";

export function PaymentPreviewCard({
  mode,
  title,
  description,
  amount,
  recipient,
  deadline,
  clientName,
  invoiceNumber,
  serviceTitle,
  publicUrl,
}: {
  mode: PreviewMode;
  title: string;
  description: string;
  amount: string;
  recipient: string;
  deadline: string;
  clientName?: string;
  invoiceNumber?: string;
  serviceTitle?: string;
  publicUrl?: string;
}) {
  const modeLabel = getModeLabel(mode);
  const previewTitle = getPreviewTitle(mode, title, serviceTitle, invoiceNumber);

  return (
    <motion.aside className="preview-card sticky-panel" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
      <div className="preview-header">
        <span className={mode === "group" ? "badge good pulse" : "badge warn"}>
          {mode === "group" ? "Group funding" : "Draft preview"}
        </span>
        <span className="badge">{modeLabel}</span>
      </div>
      <span className="mock-label">{mode === "group" ? "Funding goal" : "Payment request"}</span>
      <h2 className="preview-title">{previewTitle}</h2>
      <p className="muted">{description || getDescriptionFallback(mode)}</p>
      <div className="amount-xl preview-amount">{amount || "0.00"} USDC</div>

      {mode === "group" && (
        <div className="progress-wrap" aria-label="Funding progress preview">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: "0%" }} />
          </div>
          <span className="small">0% funded</span>
        </div>
      )}

      <div className="preview-divider" />
      <div className="data-list">
        {mode === "invoice" && (
          <>
            <div className="data-row">
              <span>Client</span>
              <span>{clientName || "Client name"}</span>
            </div>
            <div className="data-row">
              <span>Invoice</span>
              <span>{invoiceNumber || "Not set"}</span>
            </div>
          </>
        )}
        {mode === "unlock" && (
          <div className="notice">
            Unlock content is stored as onchain metadata. Do not use private secrets.
          </div>
        )}
        <div className="data-row">
          <span>Recipient</span>
          <span>{recipient ? <AddressDisplay address={recipient} /> : "0x..."}</span>
        </div>
        <div className="data-row">
          <span>Public URL</span>
          <span className="mono">{publicUrl || "/p/your-link"}</span>
        </div>
        <div className="data-row">
          <span>{mode === "invoice" ? "Due date" : "Deadline"}</span>
          <span>{deadline || (mode === "group" ? "Required" : "No deadline")}</span>
        </div>
      </div>
      <div className="actions">
        <button className="button preview-pay-button" type="button" disabled>
          {mode === "group" ? "Contribute native Arc USDC" : "Pay with native Arc USDC"}
        </button>
      </div>
      <p className="small">Preview only. Onchain state is created after wallet confirmation.</p>
    </motion.aside>
  );
}

function getModeLabel(mode: PreviewMode) {
  if (mode === "payment") return "Payment Link";
  if (mode === "invoice") return "Invoice";
  if (mode === "unlock") return "Unlock";
  return "Group";
}

function getPreviewTitle(mode: PreviewMode, title: string, serviceTitle?: string, invoiceNumber?: string) {
  if (mode === "invoice") {
    const service = serviceTitle || "Service title";
    return invoiceNumber ? `Invoice #${invoiceNumber} - ${service}` : `Invoice - ${service}`;
  }

  if (title) return title;
  if (mode === "unlock") return "Unlock after payment";
  if (mode === "group") return "Group funding link";
  return "Untitled payment link";
}

function getDescriptionFallback(mode: PreviewMode) {
  if (mode === "invoice") return "Invoice details and service notes appear here.";
  if (mode === "unlock") return "Payers receive the unlock message and URL after payment.";
  if (mode === "group") return "Contributors fund this goal together before the deadline.";
  return "Add a short note so payers know what this link is for.";
}
