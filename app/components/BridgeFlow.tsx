"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  readArcNativeUsdcBalance,
  readSepoliaUsdcBalance,
  type TokenBalance,
} from "../../src/arc/balances";
import {
  bridgeUsdc,
  canBridgeDirection,
  canUseBridge,
  getBridgeDirectionLabel,
  getDefaultBridgeRoute,
  getDestinationWagmiChain,
  getRequiredSourceWagmiChain,
  type AppKitBridgeResult,
  type AppKitBridgeStatus,
  type AppKitProvider,
  type BridgeDirection,
  type BridgeRoute,
  type NormalizedAppKitBridgeStep,
} from "../../src/arc/appkit";
import {
  ARC_TESTNET_WALLET_CHAIN,
  ETHEREUM_SEPOLIA_WALLET_CHAIN,
  getCurrentWalletChainId,
  getWalletProvider,
  switchOrAddWalletChain,
  type WalletChainTarget,
} from "../../src/arc/walletNetwork";
import { safeJsonStringify } from "../lib/safeJson";
import { Button } from "./Button";
import { WalletConnectButton } from "./WalletConnectButton";

type BridgeFlowProps = {
  initialAmount?: string;
  initialDirection?: BridgeDirection;
  returnTo?: string;
};

type BridgeStepId = "wallet" | "source" | "processing" | "destination";
type BridgeStepStatus = "pending" | "active" | "completed" | "failed" | "skipped";
type BridgeRunState = "idle" | "switching-network" | "checking" | "awaiting-wallet" | "submitted" | "processing" | "completed" | "failed";

type BridgeStepperStep = {
  id: BridgeStepId;
  title: string;
  description: string;
  status: BridgeStepStatus;
  txHash?: string;
  explorerUrl?: string;
};

export function BridgeFlow({ initialAmount = "", initialDirection = "sepolia-to-arc", returnTo = "" }: BridgeFlowProps) {
  const { address, connector, chainId, isConnected } = useAccount();
  const [amount, setAmount] = useState(initialAmount);
  const [direction, setDirection] = useState<BridgeDirection>(initialDirection);
  const [status, setStatus] = useState<AppKitBridgeStatus>("idle");
  const [bridgeRunState, setBridgeRunState] = useState<BridgeRunState>("idle");
  const [result, setResult] = useState<AppKitBridgeResult | null>(null);
  const [error, setError] = useState("");
  const [observedChainId, setObservedChainId] = useState<number | undefined>();
  const [isSwitchingWalletNetwork, setIsSwitchingWalletNetwork] = useState(false);

  const route = useMemo(() => getDefaultBridgeRoute(direction), [direction]);
  const destinationChain = useMemo(() => getDestinationWagmiChain(direction), [direction]);
  const sourceChain = useMemo(() => getRequiredSourceWagmiChain(direction), [direction]);
  const effectiveChainId = observedChainId ?? chainId;
  const hasWalletProvider = Boolean(connector);
  const bridgeCapability = canBridgeDirection(direction);
  const readiness = canUseBridge({ connected: isConnected, currentChainId: effectiveChainId, hasProvider: hasWalletProvider, direction });
  const bridgeBalances = useQuery({
    queryKey: ["bridge-balances", address],
    queryFn: () => readBridgeBalances(address as Address),
    enabled: Boolean(address),
  });
  const amountIsValid = isPositiveDecimalInput(amount);
  const busy = status === "preparing" || status === "wallet-confirmation" || status === "submitted" || status === "bridging";
  const isOnRequiredSourceChain = effectiveChainId === route.sourceChainId;
  const readyToBridge = Boolean(readiness.ok && bridgeCapability.ok && hasWalletProvider && address && amountIsValid && !busy);
  const backHref = returnTo || "/dashboard";
  const receivePreview = amountIsValid ? `≈ ${formatBridgeAmount(amount)} USDC` : "Enter amount";
  const stepperSteps = useMemo(() => buildBridgeStepperSteps(bridgeRunState, result, route), [bridgeRunState, result, route]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    void getWalletProvider(connector, { connectedAddress: address })
      .then((provider) => {
        if (!mounted || !provider) return;
        void getCurrentWalletChainId(provider)
          .then((nextChainId) => {
            if (mounted) setObservedChainId(nextChainId);
          })
          .catch(() => undefined);

        const onChainChanged = (nextChainId: unknown) => {
          const parsed = parseWalletChainId(nextChainId);
          if (parsed) setObservedChainId(parsed);
          setStatus((current) => (current === "switching-network" ? "idle" : current));
          setBridgeRunState((current) => (current === "switching-network" ? "idle" : current));
          setIsSwitchingWalletNetwork(false);
        };

        provider.on?.("chainChanged", onChainChanged);
        cleanup = () => provider.removeListener?.("chainChanged", onChainChanged);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [connector, isConnected, address]);

  function swapDirection() {
    const nextDirection: BridgeDirection = direction === "sepolia-to-arc" ? "arc-to-sepolia" : "sepolia-to-arc";
    setDirection(nextDirection);
    setStatus("idle");
    setBridgeRunState("idle");
    setResult(null);
    setError("");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("direction", nextDirection);
      if (amount.trim()) url.searchParams.set("amount", amount.trim());
      window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
    }
  }

  async function handleSwitchNetwork() {
    setError("");
    setResult(null);
    setBridgeRunState("switching-network");
    setIsSwitchingWalletNetwork(true);
    setStatus("switching-network");
    try {
      const nextChainId = await switchOrAddWalletChain({ chain: getWalletChainTarget(sourceChain.id), connector, connectedAddress: address });
      setObservedChainId(nextChainId ?? (await getCurrentWalletChainId(connector, { connectedAddress: address })));
      setStatus("idle");
      setBridgeRunState("idle");
    } catch (caught) {
      setStatus("failed");
      setBridgeRunState("idle");
      setError(getWalletSwitchError(caught, sourceChain.name));
    } finally {
      setIsSwitchingWalletNetwork(false);
    }
  }

  async function switchToDestination() {
    setError("");
    setIsSwitchingWalletNetwork(true);
    try {
      const nextChainId = await switchOrAddWalletChain({ chain: getWalletChainTarget(destinationChain.id), connector, connectedAddress: address });
      setObservedChainId(nextChainId ?? (await getCurrentWalletChainId(connector, { connectedAddress: address })));
    } catch (caught) {
      setError(getWalletSwitchError(caught, destinationChain.name));
    } finally {
      setIsSwitchingWalletNetwork(false);
    }
  }

  async function handleStartBridge() {
    if (!connector || !address) {
      setStatus("wallet-not-connected");
      setBridgeRunState("idle");
      setError("Connect a wallet to use Arc App Kit Bridge.");
      return;
    }

    if (!amountIsValid) {
      setStatus("idle");
      setBridgeRunState("idle");
      setError("Enter a valid USDC amount to bridge.");
      return;
    }

    setError("");
    setResult(null);
    setBridgeRunState("checking");

    if (!bridgeCapability.ok) {
      setStatus("setup-needed");
      setBridgeRunState("failed");
      setError(bridgeCapability.reason ?? "This route is not available from the current App Kit configuration.");
      return;
    }

    if (!isOnRequiredSourceChain) {
      setStatus("wrong-source-chain");
      setBridgeRunState("idle");
      setError(`Switch to ${route.sourceName} to bridge USDC.`);
      return;
    }

    if (!readiness.ok) {
      setStatus(readiness.status);
      setBridgeRunState("idle");
      setError(readiness.reason);
      return;
    }

    setStatus("preparing");
    setBridgeRunState("awaiting-wallet");

    try {
      const provider = (await getWalletProvider(connector, { connectedAddress: address })) as AppKitProvider | undefined;
      if (!provider) throw new Error("Wallet provider not available.");
      setStatus("wallet-confirmation");
      setBridgeRunState("awaiting-wallet");
      const bridgeResult = await bridgeUsdc({
        provider,
        direction,
        destinationAddress: address as Address,
        amount: amount.trim(),
        currentChainId: effectiveChainId,
      });

      setResult(bridgeResult);
      setStatus(bridgeResult.status);
      setBridgeRunState(getBridgeRunStateFromResult(bridgeResult));
      if (bridgeResult.errorMessage) setError(bridgeResult.errorMessage);
    } catch (caught) {
      setStatus("failed");
      setBridgeRunState("failed");
      setError(caught instanceof Error ? caught.message : "Arc App Kit Bridge failed.");
    }
  }

  return (
    <motion.section className="bridge-shell" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }}>
      <div className="bridge-card">
        <div className="bridge-card-header">
          <div>
            <span className="eyebrow">USDC Bridge</span>
            <h2>{getBridgeDirectionLabel(direction)}</h2>
            <p className="bridge-subcopy">Bridge USDC between Sepolia and Arc. Arclet checkout stays separate.</p>
          </div>
          <span className={bridgeCapability.ok ? "bridge-appkit-badge good" : "bridge-appkit-badge warn"}>{bridgeCapability.ok ? "Arc App Kit" : "Setup needed"}</span>
        </div>

        <BridgeTokenPanel
          label="From"
          helper="You send"
          route={route}
          networkName={route.sourceName}
          networkShortName={route.sourceShortName}
          walletConnected={isConnected}
          active={effectiveChainId === route.sourceChainId}
          amount={amount}
          onAmountChange={setAmount}
          balanceState={getSourceBalanceState(direction, bridgeBalances, Boolean(address))}
          editable
        />

        <div className="bridge-midline">
          <button className="bridge-direction-button" type="button" onClick={swapDirection} aria-label="Swap bridge direction">
            ⇅
          </button>
          <div className="bridge-route-summary">
            <strong>{route.sourceShortName} → {route.destinationShortName}</strong>
            <span>Powered by Arc App Kit</span>
          </div>
        </div>

        <BridgeTokenPanel
          label="To"
          helper="You receive"
          route={route}
          networkName={route.destinationName}
          networkShortName={route.destinationShortName}
          walletConnected={isConnected}
          active={effectiveChainId === route.destinationChainId}
          amount={receivePreview}
          showEstimate={amountIsValid}
          destinationBalanceState={getDestinationBalanceState(direction, bridgeBalances, Boolean(address))}
          destinationWallet={address}
        />

        <div className="bridge-actions">
          {!isConnected ? (
            <WalletConnectButton />
          ) : !amount.trim() || !amountIsValid ? (
            <Button type="button" disabled>
              {getBridgeButtonLabel(status, amount, bridgeRunState)}
            </Button>
          ) : !isOnRequiredSourceChain ? (
            <Button type="button" disabled={isSwitchingWalletNetwork || busy} onClick={handleSwitchNetwork}>
              {isSwitchingWalletNetwork || status === "switching-network" ? "Switching..." : `Switch to ${route.sourceName}`}
            </Button>
          ) : (
            <Button type="button" disabled={!readyToBridge} onClick={handleStartBridge}>
              {getBridgeButtonLabel(status, amount, bridgeRunState)}
            </Button>
          )}

          <Button href={backHref} variant="secondary">
            {returnTo ? "Return to checkout" : "Go to dashboard"}
          </Button>
        </div>

        {bridgeRunState !== "idle" && <BridgeStepper steps={stepperSteps} />}

        <BridgeStatusMessage
          status={status}
          result={result}
          error={error}
          direction={direction}
          route={route}
          onSwitchToDestination={switchToDestination}
          switchingChain={isSwitchingWalletNetwork}
          returnTo={returnTo}
        />

        {result?.rawResult && (
          <details className="appkit-technical-details">
            <summary>Bridge technical details</summary>
            <pre>{safeJsonStringify(result.rawResult)}</pre>
          </details>
        )}
      </div>
    </motion.section>
  );
}

function BridgeTokenPanel({
  label,
  helper,
  networkName,
  networkShortName,
  walletConnected,
  active,
  amount,
  onAmountChange,
  balanceState,
  destinationBalanceState,
  showEstimate = false,
  editable = false,
  destinationWallet,
}: {
  label: string;
  helper: string;
  route: BridgeRoute;
  networkName: string;
  networkShortName: string;
  walletConnected: boolean;
  active: boolean;
  amount: string;
  onAmountChange?: (value: string) => void;
  balanceState?: BridgeBalanceState;
  destinationBalanceState?: BridgeDestinationBalanceState;
  showEstimate?: boolean;
  editable?: boolean;
  destinationWallet?: Address;
}) {
  return (
    <div className="bridge-token-panel">
      <div className="bridge-token-row">
        <div className="bridge-compact-left">
          <div className="bridge-network-card">
            <span className="bridge-network-icon">{networkShortName.slice(0, 1)}</span>
            <div>
              <div className="bridge-network-title-row">
                <span>{label}</span>
                {walletConnected && <span className={active ? "badge good" : "badge"}>{active ? "Active network" : "Destination"}</span>}
              </div>
              <strong>{networkName}</strong>
              {balanceState ? <BridgeBalanceDisplay balanceState={balanceState} onMax={onAmountChange} /> : null}
              {destinationBalanceState ? <BridgeDestinationBalanceDisplay balanceState={destinationBalanceState} /> : null}
            </div>
          </div>
        </div>
        <div className="bridge-compact-amount">
          <span>{helper}</span>
          {editable ? (
            <div className="bridge-amount-entry">
              <input value={amount} inputMode="decimal" placeholder="0.00" onChange={(event) => onAmountChange?.(event.target.value)} aria-label="Bridge amount in USDC" />
              <span className="bridge-token-pill">USDC</span>
            </div>
          ) : (
            <div className="bridge-receive-stack">
              <strong className="bridge-receive-preview">{amount}</strong>
              {showEstimate && <span>estimated</span>}
            </div>
          )}
        </div>
      </div>
      {destinationWallet && (
        <div className="data-row bridge-wallet-row">
          <span>Destination</span>
          <span className="mono">{shortAddress(destinationWallet)}</span>
        </div>
      )}
    </div>
  );
}

type BridgeBalanceState = {
  usdcBalance: string;
  maxAmount?: string;
  loading: boolean;
};

function BridgeBalanceDisplay({ balanceState, onMax }: { balanceState: BridgeBalanceState; onMax?: (value: string) => void }) {
  if (balanceState.loading) return <p className="small">Loading balance...</p>;

  return (
    <div className="bridge-balance-stack">
      <div className="bridge-balance-line">
        <span>USDC balance</span>
        <strong>{balanceState.usdcBalance}</strong>
        {balanceState.maxAmount && onMax && (
          <button className="bridge-max-button" type="button" onClick={() => onMax(balanceState.maxAmount!)}>
            Max
          </button>
        )}
      </div>
    </div>
  );
}

type BridgeDestinationBalanceState = {
  label: string;
  balance: string;
  loading: boolean;
};

function BridgeDestinationBalanceDisplay({ balanceState }: { balanceState: BridgeDestinationBalanceState }) {
  return (
    <div className="bridge-destination-balance">
      <span>{balanceState.label}</span>
      <strong>{balanceState.loading ? "Loading balance..." : balanceState.balance}</strong>
    </div>
  );
}

function BridgeStatusMessage({
  status,
  result,
  error,
  direction,
  route,
  onSwitchToDestination,
  switchingChain,
  returnTo,
}: {
  status: AppKitBridgeStatus;
  result: AppKitBridgeResult | null;
  error: string;
  direction: BridgeDirection;
  route: BridgeRoute;
  onSwitchToDestination: () => void;
  switchingChain: boolean;
  returnTo: string;
}) {
  const firstLinkedStep = result?.steps.find((step) => step.txHash && step.explorerUrl);
  const destinationIsArc = direction === "sepolia-to-arc";

  if (status === "idle") return error ? <div className="error">{error}</div> : null;
  if (status === "completed") {
    return (
      <div className="state-message good checkout-state-panel bridge-status-panel">
        <strong>Bridge complete</strong>
        <span>{destinationIsArc ? "USDC moved to Arc. You can now return to checkout and pay manually." : "USDC moved to Ethereum Sepolia."}</span>
        <div className="actions">
          {destinationIsArc && (
            <Button type="button" variant="secondary" disabled={switchingChain} onClick={onSwitchToDestination}>
              {switchingChain ? "Switching..." : "Switch to Arc Testnet"}
            </Button>
          )}
          {returnTo && (
            <Button href={returnTo} variant="secondary">
              Return to checkout
            </Button>
          )}
          {firstLinkedStep?.explorerUrl && (
            <a className="secondary-button tx-action-link" href={firstLinkedStep.explorerUrl} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
        </div>
      </div>
    );
  }
  if (status === "bridging" || status === "submitted") {
    return (
      <div className="notice appkit-status bridge-status-panel">
        <strong>Bridge submitted</strong>
        <span>App Kit is processing {route.sourceName} → {route.destinationName}. Do not complete checkout until funds arrive on Arc.</span>
      </div>
    );
  }
  if (status === "failed" || status === "setup-needed" || status === "wallet-not-connected" || status === "wrong-source-chain") {
    return <div className={status === "wrong-source-chain" ? "notice appkit-status" : "error"}>{error || "Bridge could not start."}</div>;
  }
  if (status === "switching-network") {
    return <div className="notice appkit-status">Switching wallet network...</div>;
  }

  return (
    <div className="notice appkit-status">
      {status === "preparing" && "Preparing Arc App Kit Bridge..."}
      {status === "wallet-confirmation" && "Confirm the bridge steps in your wallet."}
    </div>
  );
}

function BridgeStepper({ steps }: { steps: BridgeStepperStep[] }) {
  const activeIndex = steps.findIndex((step) => step.status === "active" || step.status === "failed");
  const pendingIndex = steps.findIndex((step) => step.status === "pending");
  const currentIndex = activeIndex >= 0 ? activeIndex : pendingIndex >= 0 ? pendingIndex : steps.length - 1;
  const currentStep = steps[currentIndex] ?? steps[0];

  return (
    <div className="bridge-stepper" aria-label="Bridge transaction steps">
      <div className="bridge-stepper-head">
        <strong>Step {currentIndex + 1} of 4: {currentStep.title}</strong>
        <span>{currentStep.status}</span>
      </div>
      {steps.map((step) => (
        <div className={`bridge-stepper-row ${step.status}`} key={step.id}>
          <span className="bridge-stepper-dot">{getStepperGlyph(step.status)}</span>
          <div>
            <div className="bridge-stepper-title">
              <strong>{step.title}</strong>
              <span>{step.status}</span>
            </div>
            <p>{step.description}</p>
            {step.txHash && step.explorerUrl && (
              <a className="mono" href={step.explorerUrl} target="_blank" rel="noreferrer">
                View transaction
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildBridgeStepperSteps(runState: BridgeRunState, result: AppKitBridgeResult | null, route: BridgeRoute): BridgeStepperStep[] {
  const sourceStep = getClassifiedStep(result?.steps, "source") ?? getFirstTxStep(result?.steps, undefined);
  const processingStep = getClassifiedStep(result?.steps, "processing");
  const destinationStep = getClassifiedStep(result?.steps, "destination");
  const failedStep = result?.steps.find((step) => step.state === "error");
  const sourceTxHash = sourceStep?.txHash ?? result?.txHashes[0];
  const destinationTxHash = destinationStep?.txHash ?? result?.txHashes[1];

  return [
    {
      id: "wallet",
      title: "Wallet confirmation",
      description: "Approve or confirm the required wallet steps.",
      status: getWalletStepStatus(runState, result, failedStep),
    },
    {
      id: "source",
      title: "Source transaction",
      description: "Bridge transaction submitted on the source network.",
      status: getSourceStepStatus(runState, result, sourceStep, failedStep),
      txHash: sourceTxHash,
      explorerUrl: getStepExplorerUrl(sourceStep, route.sourceChainId, sourceTxHash),
    },
    {
      id: "processing",
      title: "Processing",
      description: result?.status === "bridging" ? "Bridge submitted. Destination completion may take a few minutes." : "Waiting for bridge processing.",
      status: getProcessingStepStatus(runState, result, processingStep, failedStep),
      txHash: processingStep?.txHash,
      explorerUrl: getStepExplorerUrl(processingStep, route.sourceChainId),
    },
    {
      id: "destination",
      title: "Destination",
      description: "USDC arrives on the destination network.",
      status: getDestinationStepStatus(runState, result, destinationStep, failedStep),
      txHash: destinationTxHash,
      explorerUrl: getStepExplorerUrl(destinationStep, route.destinationChainId, destinationTxHash),
    },
  ];
}

function getWalletStepStatus(runState: BridgeRunState, result: AppKitBridgeResult | null, failedStep: NormalizedAppKitBridgeStep | undefined): BridgeStepStatus {
  if (runState === "failed" && !result) return "failed";
  if (failedStep && !result?.txHashes.length) return "failed";
  if (runState === "checking" || runState === "awaiting-wallet") return "active";
  if (runState === "submitted" || runState === "processing" || runState === "completed" || result?.txHashes.length) return "completed";
  return "pending";
}

function getSourceStepStatus(
  runState: BridgeRunState,
  result: AppKitBridgeResult | null,
  sourceStep: NormalizedAppKitBridgeStep | undefined,
  failedStep: NormalizedAppKitBridgeStep | undefined
): BridgeStepStatus {
  if (sourceStep?.state === "error" || (failedStep && classifyBridgeSdkStep(failedStep) === "source")) return "failed";
  if (sourceStep?.txHash || sourceStep?.state === "success" || result?.txHashes.length) return "completed";
  if (runState === "submitted") return "active";
  if (runState === "failed" && !result?.txHashes.length) return "failed";
  return "pending";
}

function getProcessingStepStatus(
  runState: BridgeRunState,
  result: AppKitBridgeResult | null,
  processingStep: NormalizedAppKitBridgeStep | undefined,
  failedStep: NormalizedAppKitBridgeStep | undefined
): BridgeStepStatus {
  if (processingStep?.state === "error" || (failedStep && classifyBridgeSdkStep(failedStep) === "processing")) return "failed";
  if (processingStep?.state === "success" || result?.status === "completed") return "completed";
  if (runState === "processing" || result?.status === "bridging") return "active";
  return "pending";
}

function getDestinationStepStatus(
  runState: BridgeRunState,
  result: AppKitBridgeResult | null,
  destinationStep: NormalizedAppKitBridgeStep | undefined,
  failedStep: NormalizedAppKitBridgeStep | undefined
): BridgeStepStatus {
  if (destinationStep?.state === "error" || (failedStep && classifyBridgeSdkStep(failedStep) === "destination")) return "failed";
  if (destinationStep?.state === "success" || result?.status === "completed" || runState === "completed") return "completed";
  if (result?.status === "bridging" || runState === "processing") return "pending";
  return "pending";
}

function getBridgeRunStateFromResult(result: AppKitBridgeResult): BridgeRunState {
  if (result.status === "completed") return "completed";
  if (result.status === "bridging") return "processing";
  if (result.status === "submitted") return "submitted";
  if (result.status === "failed") return "failed";
  return "submitted";
}

function getClassifiedStep(steps: NormalizedAppKitBridgeStep[] | undefined, expected: BridgeStepId): NormalizedAppKitBridgeStep | undefined {
  return steps?.find((step) => classifyBridgeSdkStep(step) === expected);
}

function getFirstTxStep(
  steps: NormalizedAppKitBridgeStep[] | undefined,
  excludedStep: NormalizedAppKitBridgeStep | undefined
): NormalizedAppKitBridgeStep | undefined {
  return steps?.find((step) => step !== excludedStep && Boolean(step.txHash));
}

function classifyBridgeSdkStep(step: NormalizedAppKitBridgeStep): BridgeStepId {
  const name = step.name.toLowerCase();
  if (/destination|complete|mint|redeem|receive/.test(name)) return "destination";
  if (/attestation|process|bridge processing|wait|pending/.test(name)) return "processing";
  if (/wallet|approve|allow|allowance|permit|spend/.test(name) && !step.txHash) return "wallet";
  return "source";
}

function getStepExplorerUrl(step: NormalizedAppKitBridgeStep | undefined, chainId: number, fallbackTxHash?: string): string | undefined {
  const txHash = step?.txHash ?? fallbackTxHash;
  if (!txHash) return undefined;
  if (step?.explorerUrl) return step.explorerUrl;
  return chainId === ETHEREUM_SEPOLIA_WALLET_CHAIN.chainId ? `https://sepolia.etherscan.io/tx/${txHash}` : `https://testnet.arcscan.app/tx/${txHash}`;
}

function getStepperGlyph(status: BridgeStepStatus): string {
  if (status === "completed") return "✓";
  if (status === "failed") return "!";
  if (status === "skipped") return "–";
  return "";
}

function getBridgeButtonLabel(status: AppKitBridgeStatus, amount: string, runState: BridgeRunState) {
  if (runState === "checking" || runState === "awaiting-wallet") return "Confirm wallet steps";
  if (runState === "submitted" || runState === "processing") return "Bridging...";
  if (runState === "completed") return "Bridge complete";
  if (runState === "failed") return "Try again";
  if (status === "preparing") return "Preparing Bridge...";
  if (status === "wallet-confirmation") return "Confirm in Wallet...";
  if (status === "submitted") return "Bridge Submitted...";
  if (status === "bridging") return "Bridge Processing...";
  if (!amount.trim()) return "Enter amount";
  if (!isPositiveDecimalInput(amount)) return "Enter valid amount";
  return "Bridge USDC";
}

function formatBridgeAmount(value: string) {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(trimmed)) return trimmed;
  const [whole, fraction = ""] = trimmed.startsWith(".") ? ["0", trimmed.slice(1)] : trimmed.split(".");
  if (fraction.length === 0) return `${whole}.00`;
  if (fraction.length === 1) return `${whole}.${fraction}0`;
  return `${whole}.${fraction}`;
}

function isPositiveDecimalInput(value: string): boolean {
  const trimmed = value.trim();
  return /^(?:\d+|\d+\.\d+|\.\d+)$/.test(trimmed) && Number(trimmed) > 0;
}

function getSourceBalanceState(
  direction: BridgeDirection,
  balances: ReturnType<typeof useQuery<BridgeBalances>>,
  hasAddress: boolean
): BridgeBalanceState {
  if (!hasAddress) {
    return {
      usdcBalance: "Connect wallet to view balance",
      loading: false,
    };
  }

  if (balances.isLoading) {
    return {
      usdcBalance: "Loading balance...",
      loading: true,
    };
  }

  const data = balances.data;
  if (direction === "arc-to-sepolia") {
    const native = formatTokenBalance(data?.arcNativeUsdc);
    return {
      usdcBalance: native,
      loading: false,
    };
  }

  return {
    usdcBalance: formatTokenBalance(data?.sepoliaUsdc),
    maxAmount: data?.sepoliaUsdc ? data.sepoliaUsdc.formatted : undefined,
    loading: false,
  };
}

function getDestinationBalanceState(
  direction: BridgeDirection,
  balances: ReturnType<typeof useQuery<BridgeBalances>>,
  hasAddress: boolean
): BridgeDestinationBalanceState {
  const label = "Destination balance";

  if (!hasAddress) {
    return {
      label,
      balance: "Connect wallet to view balance",
      loading: false,
    };
  }

  if (balances.isLoading) {
    return {
      label,
      balance: "Loading balance...",
      loading: true,
    };
  }

  return {
    label,
    balance: direction === "sepolia-to-arc" ? formatTokenBalance(balances.data?.arcNativeUsdc) : formatTokenBalance(balances.data?.sepoliaUsdc),
    loading: false,
  };
}

type BridgeBalances = {
  sepoliaUsdc?: TokenBalance;
  arcNativeUsdc?: TokenBalance;
};

async function readBridgeBalances(owner: Address): Promise<BridgeBalances> {
  const [sepoliaUsdc, arcNativeUsdc] = await Promise.allSettled([
    readSepoliaUsdcBalance(owner),
    readArcNativeUsdcBalance(owner),
  ]);

  return {
    sepoliaUsdc: sepoliaUsdc.status === "fulfilled" ? sepoliaUsdc.value : undefined,
    arcNativeUsdc: arcNativeUsdc.status === "fulfilled" ? arcNativeUsdc.value : undefined,
  };
}

function formatTokenBalance(balance: TokenBalance | undefined): string {
  if (!balance) return "Balance unavailable";
  return `${balance.formatted} ${balance.symbol}`;
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getWalletChainTarget(chainId: number): WalletChainTarget {
  if (chainId === ARC_TESTNET_WALLET_CHAIN.chainId) return ARC_TESTNET_WALLET_CHAIN;
  if (chainId === ETHEREUM_SEPOLIA_WALLET_CHAIN.chainId) return ETHEREUM_SEPOLIA_WALLET_CHAIN;
  throw new Error("Wallet provider not available.");
}

function parseWalletChainId(chainId: unknown): number | undefined {
  if (typeof chainId === "number") return chainId;
  if (typeof chainId === "string") return Number.parseInt(chainId, chainId.startsWith("0x") ? 16 : 10);
  return undefined;
}

function getWalletSwitchError(error: unknown, chainName: string) {
  if (error instanceof Error && error.message) return error.message;
  return error instanceof Error ? error.message : `Could not switch to ${chainName}.`;
}
