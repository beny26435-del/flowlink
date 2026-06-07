"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getAddress, isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { arcTestnet } from "../../src/arc/chain";
import {
  getAppKitCapabilities,
  getAppKitConfigStatus,
  getBridgeCapabilityStatus,
  getDefaultBridgeRoute,
  sendUsdcOnArcWithAppKit,
  type AppKitProvider,
  type AppKitSendResult,
} from "../../src/arc/appkit";
import { buildExplorerTxUrl, formatNativeUsdcAmount } from "../../src/flowlink-v4/utils";
import { Button } from "./Button";

type AppKitFundingCenterProps = {
  recipient?: Address | string;
  amount?: bigint;
  mode?: string;
  reference?: string;
};

export function AppKitFundingCenter({ recipient, amount, mode, reference }: AppKitFundingCenterProps) {
  const pathname = usePathname();
  const { connector, chainId, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState(amount && amount > 0n ? formatNativeUsdcAmount(amount) : "");
  const [sendStatusText, setSendStatusText] = useState("");
  const [sendResult, setSendResult] = useState<AppKitSendResult | null>(null);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  const capabilities = useMemo(() => getAppKitCapabilities(), []);
  const configStatus = useMemo(() => getAppKitConfigStatus(), []);
  const bridgeCapability = useMemo(() => getBridgeCapabilityStatus(), []);
  const bridgeRoute = useMemo(() => getDefaultBridgeRoute(), []);
  const normalizedRecipient = useMemo(() => {
    if (!recipient || !isAddress(recipient)) return undefined;
    return getAddress(recipient);
  }, [recipient]);

  useEffect(() => {
    if (amount && amount > 0n) {
      setSendAmount(formatNativeUsdcAmount(amount));
    }
  }, [amount]);

  const bridgeHref = useMemo(() => {
    const params = new URLSearchParams();
    if (amount && amount > 0n) params.set("amount", formatNativeUsdcAmount(amount));
    params.set("direction", "sepolia-to-arc");
    if (pathname) params.set("returnTo", pathname);
    const query = params.toString();
    return query ? `/bridge?${query}` : "/bridge";
  }, [amount, pathname]);

  const canSend = Boolean(capabilities.sendUsdcOnArc.available && normalizedRecipient && isConnected && chainId === arcTestnet.id && connector && sendAmount.trim());
  const sendDisableReason = !normalizedRecipient
    ? "No recipient is available for this funding assist."
    : !isConnected
      ? "Connect a wallet to use Arc App Kit Send."
      : chainId !== arcTestnet.id
        ? "Switch to Arc Testnet to use App Kit Send."
        : !sendAmount.trim()
          ? "Enter an amount to send."
          : "";

  async function handleSend() {
    if (!connector || !normalizedRecipient) return;

    setSendError("");
    setSendResult(null);
    setSendStatusText("Opening wallet with Arc App Kit Send...");
    setSending(true);

    try {
      const provider = (await connector.getProvider()) as AppKitProvider;
      const result = await sendUsdcOnArcWithAppKit({
        provider,
        recipient: normalizedRecipient,
        amount: sendAmount.trim(),
      });

      setSendResult(result);
      setSendStatusText(result.state === "success" ? "USDC send completed through Arc App Kit." : `App Kit Send finished with status: ${result.state}.`);
      if (result.errorMessage) setSendError(result.errorMessage);
    } catch (caught) {
      setSendStatusText("");
      setSendError(caught instanceof Error ? caught.message : "Arc App Kit Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.section className="appkit-funding-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
      <button className="appkit-funding-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>
          <strong>Need USDC on Arc?</strong>
          <small>Use Arc App Kit to prepare funds.</small>
        </span>
        <span className="badge">{open ? "Close" : "Open"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="appkit-funding-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <p className="small">FlowLink handles checkout and receipts. Arc App Kit helps users prepare and move USDC.</p>

            <div className="appkit-capability-grid">
              <CapabilityRow title={capabilities.sendUsdcOnArc.label} body={capabilities.sendUsdcOnArc.description} status="Live" active />
              <CapabilityRow
                title={capabilities.bridgeToArc.label}
                body={capabilities.bridgeToArc.description}
                status={bridgeCapability.ready ? "Live" : "Setup needed"}
                active={bridgeCapability.ready}
              />
              <CapabilityRow title={capabilities.unifiedBalance.label} body={capabilities.unifiedBalance.description} status="Next" />
            </div>

            <div className="appkit-bridge-panel appkit-bridge-launcher">
              <div className="preview-header">
                <span className={bridgeCapability.ready ? "badge good" : "badge warn"}>{bridgeCapability.ready ? "Bridge live" : "Setup needed"}</span>
                <span className="badge">USDC</span>
              </div>
              <h3>Bridge USDC to Arc</h3>
              <p className="small">Open the dedicated bridge page to move USDC between Ethereum Sepolia and Arc Testnet, then return here to complete checkout.</p>

              <div className="data-list">
                <div className="data-row">
                  <span>Source</span>
                  <span>{bridgeRoute.sourceName}</span>
                </div>
                <div className="data-row">
                  <span>Destination</span>
                  <span>{bridgeRoute.destinationName}</span>
                </div>
                {amount && amount > 0n && (
                  <div className="data-row">
                    <span>Suggested amount</span>
                    <span>{formatNativeUsdcAmount(amount)} USDC</span>
                  </div>
                )}
                {mode && (
                  <div className="data-row">
                    <span>Context</span>
                    <span>{reference ? `${mode} - ${reference}` : mode}</span>
                  </div>
                )}
              </div>

              {!bridgeCapability.ready && <p className="small">{bridgeCapability.reason}</p>}
              <Button href={bridgeHref}>Open Bridge</Button>
            </div>

            <details className="appkit-secondary-tools">
              <summary>Send USDC on Arc</summary>
              <div className="appkit-send-panel">
                <div className="data-list">
                  <div className="data-row">
                    <span>Recipient</span>
                    <span className="mono">{normalizedRecipient ?? "Not available"}</span>
                  </div>
                  <div className="data-row">
                    <span>Network</span>
                    <span>Arc Testnet</span>
                  </div>
                </div>

                <label className="field appkit-amount-field">
                  <span>Amount for App Kit Send</span>
                  <input value={sendAmount} inputMode="decimal" placeholder="10.00" onChange={(event) => setSendAmount(event.target.value)} />
                </label>

                {sendDisableReason && <p className="small">{sendDisableReason}</p>}
                {!configStatus.publicKitKeyAvailable && (
                  <p className="small">No public App Kit key is configured. If your Circle setup requires one, add NEXT_PUBLIC_APP_KIT_KEY.</p>
                )}

                <Button type="button" variant="secondary" disabled={!canSend || sending} onClick={handleSend}>
                  {sending ? "Sending with App Kit..." : "Send USDC on Arc"}
                </Button>

                {sendStatusText && <div className="notice appkit-status">{sendStatusText}</div>}
                {sendResult?.txHash && (
                  <a className="secondary-button tx-action-link" href={sendResult.explorerUrl ?? buildExplorerTxUrl(sendResult.txHash)} target="_blank" rel="noreferrer">
                    View transaction
                  </a>
                )}
                {sendError && <div className="error">{sendError}</div>}
              </div>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function CapabilityRow({ title, body, status, active = false }: { title: string; body: string; status: string; active?: boolean }) {
  return (
    <div className="appkit-capability-row">
      <span className={active ? "badge good" : status === "Setup needed" ? "badge warn" : "badge"}>{status}</span>
      <div>
        <strong>{title}</strong>
        <p className="small">{body}</p>
      </div>
    </div>
  );
}
