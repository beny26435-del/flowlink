"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { sepolia } from "viem/chains";
import { useAccount, useSwitchChain } from "wagmi";
import { arcTestnet } from "../../src/arc/chain";
import {
  bridgeUsdcToArc,
  canUseBridge,
  getAppKitCapabilities,
  getAppKitConfigStatus,
  getBridgeCapabilityStatus,
  getDefaultBridgeRoute,
  sendUsdcOnArcWithAppKit,
  type AppKitBridgeResult,
  type AppKitBridgeStatus,
  type AppKitProvider,
  type AppKitSendResult,
  type NormalizedAppKitBridgeStep,
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
  const { address, connector, chainId, isConnected } = useAccount();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState(amount && amount > 0n ? formatNativeUsdcAmount(amount) : "");
  const [bridgeAmount, setBridgeAmount] = useState(amount && amount > 0n ? formatNativeUsdcAmount(amount) : "");
  const [sendStatusText, setSendStatusText] = useState("");
  const [sendResult, setSendResult] = useState<AppKitSendResult | null>(null);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<AppKitBridgeStatus>("idle");
  const [bridgeResult, setBridgeResult] = useState<AppKitBridgeResult | null>(null);
  const [bridgeError, setBridgeError] = useState("");

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
      const formatted = formatNativeUsdcAmount(amount);
      setSendAmount(formatted);
      setBridgeAmount(formatted);
    }
  }, [amount]);

  const bridgeReadiness = canUseBridge({ connected: isConnected, currentChainId: chainId, hasProvider: Boolean(connector) });
  const canBridge = Boolean(bridgeReadiness.ok && address && connector && bridgeAmount.trim());
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

  async function handleBridge() {
    if (!connector || !address) return;

    setBridgeError("");
    setBridgeResult(null);

    if (!bridgeReadiness.ok) {
      setBridgeStatus(bridgeReadiness.status === "setup-needed" ? "setup-needed" : bridgeReadiness.status === "switch-source-chain" ? "switch-source-chain" : "idle");
      setBridgeError(bridgeReadiness.reason);
      return;
    }

    setBridgeStatus("preparing");

    try {
      const provider = (await connector.getProvider()) as AppKitProvider;
      setBridgeStatus("wallet-confirmation");
      const result = await bridgeUsdcToArc({
        provider,
        destinationAddress: address,
        amount: bridgeAmount.trim(),
        currentChainId: chainId,
      });

      setBridgeResult(result);
      setBridgeStatus(result.status);
      if (result.errorMessage) setBridgeError(result.errorMessage);
    } catch (caught) {
      setBridgeStatus("failed");
      setBridgeError(caught instanceof Error ? caught.message : "Arc App Kit Bridge failed.");
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

            <div className="appkit-bridge-panel">
              <div className="preview-header">
                <span className={bridgeCapability.ready ? "badge good" : "badge warn"}>{bridgeCapability.ready ? "Bridge live" : "Setup needed"}</span>
                <span className="badge">USDC</span>
              </div>
              <h3>Bridge USDC to Arc</h3>
              <p className="small">Bridge USDC to your Arc wallet, then complete the FlowLink checkout.</p>

              <div className="data-list">
                <div className="data-row">
                  <span>Source</span>
                  <span>{bridgeRoute.sourceName}</span>
                </div>
                <div className="data-row">
                  <span>Destination</span>
                  <span>{bridgeRoute.destinationName}</span>
                </div>
                <div className="data-row">
                  <span>Destination wallet</span>
                  <span className="mono">{address ?? "Connect wallet"}</span>
                </div>
                {mode && (
                  <div className="data-row">
                    <span>Context</span>
                    <span>{reference ? `${mode} - ${reference}` : mode}</span>
                  </div>
                )}
              </div>

              <label className="field appkit-amount-field">
                <span>Bridge amount</span>
                <input value={bridgeAmount} inputMode="decimal" placeholder="10.00" onChange={(event) => setBridgeAmount(event.target.value)} />
              </label>

              {!bridgeReadiness.ok && <p className="small">{bridgeReadiness.reason}</p>}
              {!bridgeCapability.ready && <p className="small">Set NEXT_PUBLIC_APP_KIT_BRIDGE_ENABLED=true and NEXT_PUBLIC_APP_KIT_KEY to enable this bridge route.</p>}
              {bridgeReadiness.ok === false && bridgeReadiness.status === "switch-source-chain" && (
                <Button type="button" variant="secondary" disabled={switchingChain} onClick={() => switchChain({ chainId: sepolia.id })}>
                  {switchingChain ? "Switching..." : "Switch to Ethereum Sepolia"}
                </Button>
              )}

              <Button type="button" disabled={!canBridge || bridgeStatus === "preparing" || bridgeStatus === "wallet-confirmation" || bridgeStatus === "bridging"} onClick={handleBridge}>
                {getBridgeButtonLabel(bridgeStatus)}
              </Button>

              <BridgeStatusMessage status={bridgeStatus} result={bridgeResult} error={bridgeError} />
              {bridgeResult?.steps.length ? <BridgeSteps steps={bridgeResult.steps} /> : null}

              {bridgeResult?.rawResult && (
                <details className="appkit-technical-details">
                  <summary>Bridge technical details</summary>
                  <pre>{JSON.stringify(bridgeResult.rawResult, null, 2)}</pre>
                </details>
              )}
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

function BridgeStatusMessage({ status, result, error }: { status: AppKitBridgeStatus; result: AppKitBridgeResult | null; error: string }) {
  const firstLinkedStep = result?.steps.find((step) => step.txHash && step.explorerUrl);

  if (status === "idle") return null;
  if (status === "completed") {
    return (
      <div className="state-message good checkout-state-panel">
        <strong>USDC moved to Arc</strong>
        <span>After bridging, complete the FlowLink payment with native Arc USDC.</span>
        {firstLinkedStep?.explorerUrl && (
          <a className="secondary-button tx-action-link" href={firstLinkedStep.explorerUrl} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
      </div>
    );
  }
  if (status === "failed" || status === "setup-needed" || status === "switch-source-chain") {
    return (
      <div className={status === "switch-source-chain" ? "notice appkit-status" : "error"}>
        {error || (status === "switch-source-chain" ? "Switch to Ethereum Sepolia to bridge USDC to Arc." : "Bridge could not start.")}
      </div>
    );
  }

  return (
    <div className="notice appkit-status">
      {status === "preparing" && "Preparing Arc App Kit Bridge..."}
      {status === "wallet-confirmation" && "Confirm the bridge steps in your wallet."}
      {status === "submitted" && "Bridge transaction submitted."}
      {status === "bridging" && "Bridge is processing. This may take a few minutes."}
    </div>
  );
}

function BridgeSteps({ steps }: { steps: NormalizedAppKitBridgeStep[] }) {
  return (
    <div className="appkit-bridge-steps">
      {steps.map((step) => (
        <div className="appkit-bridge-step" key={`${step.name}-${step.txHash ?? step.state}`}>
          <span className={step.state === "success" ? "badge good" : step.state === "error" ? "badge danger" : "badge"}>{step.state}</span>
          <div>
            <strong>{step.name}</strong>
            {step.txHash && step.explorerUrl ? (
              <a className="mono" href={step.explorerUrl} target="_blank" rel="noreferrer">
                {step.txHash}
              </a>
            ) : step.txHash ? (
              <span className="mono">{step.txHash}</span>
            ) : null}
            {step.errorMessage && <p className="small">{step.errorMessage}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function getBridgeButtonLabel(status: AppKitBridgeStatus) {
  if (status === "preparing") return "Preparing Bridge...";
  if (status === "wallet-confirmation") return "Confirm in Wallet...";
  if (status === "bridging") return "Bridge Processing...";
  return "Bridge USDC to Arc";
}
