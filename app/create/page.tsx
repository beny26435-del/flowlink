"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { encodeFunctionData, getAddress, isAddress, parseEventLogs, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { ExplorerLink } from "../components/ExplorerLink";
import { Input, Textarea } from "../components/FormControls";
import { NetworkNotice } from "../components/NetworkNotice";
import { PageHeader } from "../components/PageHeader";
import { PageTransition } from "../components/PageTransition";
import { PaymentPreviewCard, type PreviewMode } from "../components/PaymentPreviewCard";
import { WalletConnectButton } from "../components/WalletConnectButton";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasArcletContractAddress } from "../config";
import { arcTestnet } from "../../src/arc/chain";
import { ARC_MEMO_CONTRACT_ADDRESS, arcMemoAbi, buildArcletCreateMemo, type ArcletMemo } from "../../src/arc/memos";
import { flowLinkV4Abi } from "../../src/flowlink-v4/abi";
import { buildPublicPayUrl, generateRandomSlug, parseNativeUsdcAmount, validateSlug } from "../../src/flowlink-v4/utils";

type LinkCreatedLog = {
  args: {
    linkId?: bigint;
  };
};

type CreatedLink = {
  linkId: bigint;
  txHash: Hex;
  paymentUrl: string;
  slug: string;
  memo?: ArcletMemo;
};

type CreateCall = {
  functionName: "createPaymentLink" | "createInvoiceLink" | "createUnlockLink" | "createGroupLink";
  args: readonly unknown[];
};

const modes: Array<{ key: PreviewMode; label: string; helper: string }> = [
  { key: "payment", label: "Payment Link", helper: "Exact native Arc USDC payment" },
  { key: "invoice", label: "Invoice", helper: "Client and service details" },
  { key: "unlock", label: "Unlock", helper: "Reveal metadata after payment" },
  { key: "group", label: "Group", helper: "Contributors fund a goal" },
];

function getCreateCall(input: {
  mode: PreviewMode;
  recipient: string;
  amount: bigint;
  deadline: bigint;
  title: string;
  description: string;
  clientName: string;
  invoiceNumber: string;
  serviceTitle: string;
  successMessage: string;
  unlockUrl: string;
  slug: string;
  listed: boolean;
}): CreateCall {
  if (input.mode === "invoice") {
    return {
      functionName: "createInvoiceLink",
      args: [
        input.recipient,
        input.amount,
        input.deadline,
        input.clientName,
        input.invoiceNumber,
        input.serviceTitle,
        input.description,
        input.slug,
        input.listed,
      ],
    };
  }

  if (input.mode === "unlock") {
    return {
      functionName: "createUnlockLink",
      args: [
        input.recipient,
        input.amount,
        input.deadline,
        input.title,
        input.description,
        input.successMessage,
        input.unlockUrl,
        input.slug,
        input.listed,
      ],
    };
  }

  if (input.mode === "group") {
    return {
      functionName: "createGroupLink",
      args: [input.recipient, input.amount, input.deadline, input.title, input.description, input.slug, input.listed],
    };
  }

  return {
    functionName: "createPaymentLink",
    args: [input.recipient, input.amount, input.deadline, input.title, input.description, input.slug, input.listed],
  };
}

export default function CreatePage() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [mode, setMode] = useState<PreviewMode>("payment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [clientName, setClientName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [unlockUrl, setUnlockUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [listed, setListed] = useState(true);
  const [memoReference, setMemoReference] = useState("");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSlug(generateRandomSlug(mode));
  }, [mode]);

  const amountIsValid = useMemo(() => {
    try {
      const parsed = amount.trim() ? parseNativeUsdcAmount(amount) : 0n;
      return parsed > 0n;
    } catch {
      return false;
    }
  }, [amount, mode]);

  const deadlineText = useMemo(() => (deadline ? new Date(deadline).toLocaleString() : ""), [deadline]);
  const titleIsValid = mode === "invoice" ? Boolean(serviceTitle.trim()) : Boolean(title.trim());
  const deadlineIsValid = mode === "group" ? Boolean(deadline) : true;
  const slugIsValid = validateSlug(slug);
  const canSubmit = Boolean(
    hasArcletContractAddress &&
      titleIsValid &&
      isAddress(recipient) &&
      amountIsValid &&
      deadlineIsValid &&
      slugIsValid &&
      isConnected &&
      chainId === arcTestnet.id,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreated(null);

    if (!hasArcletContractAddress || !flowLinkContractAddress) {
      setError(FLOWLINK_CONTRACT_MISSING_MESSAGE);
      return;
    }

    if (!address) {
      setError("Connect a wallet before creating an Arclet link.");
      return;
    }

    if (!isAddress(recipient)) {
      setError("Recipient must be a valid EVM address.");
      return;
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = amount.trim() ? parseNativeUsdcAmount(amount) : 0n;
    } catch {
      setError("Enter a valid native Arc USDC amount.");
      return;
    }

    if (parsedAmount <= 0n) {
      setError("Amount must be greater than zero.");
      return;
    }

    const deadlineTimestamp = deadline ? BigInt(Math.floor(new Date(deadline).getTime() / 1000)) : 0n;
    if (deadlineTimestamp !== 0n && deadlineTimestamp <= BigInt(Math.floor(Date.now() / 1000))) {
      setError("Deadline must be in the future.");
      return;
    }

    if (mode === "group" && deadlineTimestamp === 0n) {
      setError("Group links require a future deadline.");
      return;
    }

    if (mode === "invoice" && !serviceTitle.trim()) {
      setError("Service title is required for invoices.");
      return;
    }

    if (!validateSlug(slug)) {
      setError("Use letters, numbers, hyphen, or underscore. Slugs must be 6–64 characters.");
      return;
    }

    if (!publicClient) {
      setError("Arc Testnet public client is not ready.");
      return;
    }

    try {
      const base = {
        address: flowLinkContractAddress,
        abi: flowLinkV4Abi,
        chainId: arcTestnet.id,
      } as const;
      const createCall = getCreateCall({
        mode,
        recipient: getAddress(recipient),
        amount: parsedAmount,
        deadline: deadlineTimestamp,
        title: title.trim(),
        description: description.trim(),
        clientName: clientName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        serviceTitle: serviceTitle.trim(),
        successMessage: successMessage.trim(),
        unlockUrl: unlockUrl.trim(),
        slug: slug.trim(),
        listed,
      });
      const memo = memoReference.trim()
        ? buildArcletCreateMemo({
            mode,
            slug,
            creator: address,
            recipient: getAddress(recipient),
            amount: amount.trim(),
            reference: memoReference,
            invoiceNumber,
            clientName,
            serviceTitle,
          })
        : undefined;

      const txHash = memo
        ? await writeContractAsync({
            address: ARC_MEMO_CONTRACT_ADDRESS,
            abi: arcMemoAbi,
            chainId: arcTestnet.id,
            functionName: "memo",
            args: [
              flowLinkContractAddress,
              encodeFunctionData({
                abi: flowLinkV4Abi,
                functionName: createCall.functionName,
                args: createCall.args,
              }),
              memo.memoId,
              memo.memoData,
            ],
          })
        : await writeContractAsync({
            ...base,
            functionName: createCall.functionName,
            args: createCall.args,
          });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const logs = parseEventLogs({
        abi: flowLinkV4Abi,
        eventName: "LinkCreated",
        logs: receipt.logs,
      });

      let linkId = (logs as LinkCreatedLog[])[0]?.args.linkId;

      if (!linkId) {
        const creatorLinks = (await publicClient.readContract({
          address: flowLinkContractAddress,
          abi: flowLinkV4Abi,
          functionName: "getCreatorLinks",
          args: [address],
        })) as bigint[];
        linkId = creatorLinks[creatorLinks.length - 1];
      }

      if (!linkId) throw new Error("Created transaction confirmed, but link id was not found.");

      const paymentUrl = buildPublicPayUrl(window.location.origin, slug);
      setCreated({ linkId, txHash, paymentUrl, slug: slug.trim(), memo });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Create Arclet failed.";
      setError(message.includes("SlugAlreadyTaken") ? "That payment URL is already taken. Try another one." : message);
    }
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Payment link builder"
        title="Create an Arclet link"
        subtitle="Create payment links, invoices, unlocks, and group funding links on Arc Testnet."
        actions={<WalletConnectButton />}
      />
      <NetworkNotice />
      {!hasArcletContractAddress && <div className="error">{FLOWLINK_CONTRACT_MISSING_MESSAGE}</div>}

      <section className="mode-tabs" aria-label="Arclet mode">
        {modes.map((item) => (
          <button className={mode === item.key ? "mode-tab active" : "mode-tab"} type="button" key={item.key} onClick={() => setMode(item.key)}>
            <span>{item.label}</span>
            <small>{item.helper}</small>
          </button>
        ))}
      </section>

      <div className="builder-grid">
        <motion.section className="form-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <form className="form" onSubmit={handleSubmit}>
            <ModeFields
              mode={mode}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              recipient={recipient}
              setRecipient={setRecipient}
              amount={amount}
              setAmount={setAmount}
              amountIsValid={amountIsValid}
              deadline={deadline}
              setDeadline={setDeadline}
              clientName={clientName}
              setClientName={setClientName}
              invoiceNumber={invoiceNumber}
              setInvoiceNumber={setInvoiceNumber}
              serviceTitle={serviceTitle}
              setServiceTitle={setServiceTitle}
              successMessage={successMessage}
              setSuccessMessage={setSuccessMessage}
              unlockUrl={unlockUrl}
              setUnlockUrl={setUnlockUrl}
            />

            <div className="field">
              <label htmlFor="slug">Payment URL</label>
              <div className="slug-input-row">
                <input
                  id="slug"
                  value={slug}
                  aria-invalid={Boolean(slug && !slugIsValid)}
                  onChange={(event) => setSlug(event.target.value.trim())}
                />
                <Button type="button" variant="secondary" onClick={() => setSlug(generateRandomSlug(mode))}>
                  Generate
                </Button>
              </div>
              <span className="field-help">Use letters, numbers, hyphen, or underscore. 6–64 characters.</span>
            </div>

            <label className="toggle-row">
              <input type="checkbox" checked={listed} onChange={(event) => setListed(event.target.checked)} />
              <span>Show on my public profile</span>
            </label>

            <div className="notice">Public URL: {slugIsValid ? `/p/${slug}` : "Choose a valid payment URL"}</div>

            <div className="section memo-builder-card">
              <div className="preview-header">
                <div>
                  <span className="badge good">Arc Memo</span>
                  <h2>Transaction memo</h2>
                  <p className="muted">Attach a business reference to this create transaction for reconciliation and reporting.</p>
                </div>
              </div>
              <Input
                id="memoReference"
                label="Business reference"
                help="Optional. Example: INV-2026-0042, CLIENT-ACME, ORDER-1009. If set, Arclet creates this link through Arc's Memo contract."
                value={memoReference}
                maxLength={120}
                placeholder={mode === "invoice" ? "INV-2026-0042" : "ORDER-1009"}
                onChange={(event) => setMemoReference(event.target.value)}
              />
              <p className="small">Memos are attached to link creation only in this preview. Checkout payments still use native Arc USDC.</p>
            </div>

            {error && <motion.div className="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}

            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? "Creating on Arc..." : `Create ${getModeButtonLabel(mode)}`}
            </Button>
          </form>

          <AnimatePresence>
            {created && (
              <motion.div
                className="section create-success-card"
                initial={{ opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.42 }}
                style={{ marginTop: 18 }}
              >
                <div className="receipt-header">
                  <div>
                    <span className="badge good pulse">Created</span>
                    <h2>Arclet ready</h2>
                    <p className="muted">Share this Arclet. Native Arc USDC moves directly through the Arclet contract.</p>
                  </div>
                  <motion.span className="success-mark" initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
                    ✓
                  </motion.span>
                </div>
                <div className="data-list">
                  <div className="data-row">
                    <span>Link ID</span>
                    <strong>{created.linkId.toString()}</strong>
                  </div>
                  <div className="data-row">
                    <span>Public URL</span>
                    <Link className="mono" href={`/p/${created.slug}`}>
                      {created.paymentUrl}
                    </Link>
                  </div>
                  {created.memo && (
                    <>
                      <div className="data-row">
                        <span>Memo reference</span>
                        <strong>{created.memo.payload.reference}</strong>
                      </div>
                      <div className="data-row">
                        <span>Memo ID</span>
                        <span className="mono">{created.memo.memoId}</span>
                      </div>
                    </>
                  )}
                  <details className="technical-panel compact-technical">
                    <summary>
                      <span>Technical details</span>
                      <span className="technical-summary-copy">Raw payment page and memo data</span>
                    </summary>
                    <div className="data-list technical-data-list">
                      <div className="data-row">
                        <span>Link ID</span>
                        <strong>{created.linkId.toString()}</strong>
                      </div>
                      <div className="data-row">
                        <span>Raw pay route</span>
                        <Link className="mono" href={`/pay/${created.linkId.toString()}`}>
                          /pay/{created.linkId.toString()}
                        </Link>
                      </div>
                      {created.memo && (
                        <>
                          <div className="data-row">
                            <span>Memo contract</span>
                            <span className="mono">{ARC_MEMO_CONTRACT_ADDRESS}</span>
                          </div>
                          <div className="data-row">
                            <span>Memo payload</span>
                            <span className="mono breakable">{JSON.stringify(created.memo.payload)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                </div>
                <div className="actions">
                  <CopyButton value={created.paymentUrl} label="Copy payment URL" />
                  <Button href={`/p/${created.slug}`} variant="secondary">
                    Open pay page
                  </Button>
                  <ExplorerLink kind="tx" value={created.txHash} label="Arcscan tx" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <PaymentPreviewCard
          mode={mode}
          title={title}
          description={description}
          amount={amount}
          recipient={recipient}
          deadline={deadlineText}
          clientName={clientName}
          invoiceNumber={invoiceNumber}
          serviceTitle={serviceTitle}
          publicUrl={slugIsValid ? `/p/${slug}` : ""}
        />
      </div>
    </PageTransition>
  );
}

function ModeFields(props: {
  mode: PreviewMode;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  recipient: string;
  setRecipient: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  amountIsValid: boolean;
  deadline: string;
  setDeadline: (value: string) => void;
  clientName: string;
  setClientName: (value: string) => void;
  invoiceNumber: string;
  setInvoiceNumber: (value: string) => void;
  serviceTitle: string;
  setServiceTitle: (value: string) => void;
  successMessage: string;
  setSuccessMessage: (value: string) => void;
  unlockUrl: string;
  setUnlockUrl: (value: string) => void;
}) {
  const amountLabel = props.mode === "group" ? "Goal amount in native Arc USDC" : "Amount in native Arc USDC";

  return (
    <>
      {props.mode === "invoice" ? (
        <>
          <Input id="clientName" label="Client name" value={props.clientName} placeholder="Acme Studio" onChange={(event) => props.setClientName(event.target.value)} />
          <Input id="invoiceNumber" label="Invoice number" value={props.invoiceNumber} placeholder="INV-100" onChange={(event) => props.setInvoiceNumber(event.target.value)} />
          <Input
            id="serviceTitle"
            label="Service title"
            help="Required. Used to generate the invoice title onchain."
            value={props.serviceTitle}
            placeholder="Design sprint"
            onChange={(event) => props.setServiceTitle(event.target.value)}
          />
        </>
      ) : (
        <Input
          id="title"
          label="Title"
          value={props.title}
          maxLength={120}
          placeholder={props.mode === "group" ? "Team launch fund" : props.mode === "unlock" ? "Premium research pack" : "Design sprint invoice"}
          help="Shown prominently on the payment page. Max 120 bytes onchain."
          onChange={(event) => props.setTitle(event.target.value)}
        />
      )}

      <Textarea
        id="description"
        label="Description"
        help="Optional context for the payer. Max 1000 bytes onchain."
        value={props.description}
        maxLength={1000}
        placeholder={props.mode === "group" ? "Help fund this shared payment before the deadline." : "Payment for June product design work."}
        onChange={(event) => props.setDescription(event.target.value)}
      />

      <Input
        id="recipient"
        label="Recipient address"
        help={props.recipient && !isAddress(props.recipient) ? "Enter a valid EVM address." : "Native Arc USDC will be forwarded here."}
        value={props.recipient}
        placeholder="0x..."
        aria-invalid={Boolean(props.recipient && !isAddress(props.recipient))}
        onChange={(event) => props.setRecipient(event.target.value)}
      />

      <Input
        id="amount"
        label={amountLabel}
        help={
          props.amount && !props.amountIsValid
              ? "Amount must be greater than zero."
              : "Native Arc USDC is sent as msg.value."
        }
        value={props.amount}
        placeholder={props.mode === "group" ? "500.00" : "125.00"}
        inputMode="decimal"
        aria-invalid={Boolean(props.amount && !props.amountIsValid)}
        onChange={(event) => props.setAmount(event.target.value)}
      />

      <Input
        id="deadline"
        label={props.mode === "invoice" ? "Due date" : props.mode === "group" ? "Deadline" : "Optional deadline"}
        help={props.mode === "group" ? "Required for group funding. Contributors can refund after expiry if the goal is not funded." : "Leave empty for no expiry."}
        type="datetime-local"
        value={props.deadline}
        onChange={(event) => props.setDeadline(event.target.value)}
      />

      {props.mode === "unlock" && (
        <>
          <Input
            id="successMessage"
            label="Success message"
            value={props.successMessage}
            maxLength={500}
            placeholder="Thanks. Your access details are below."
            onChange={(event) => props.setSuccessMessage(event.target.value)}
          />
          <Input
            id="unlockUrl"
            label="Unlock URL"
            value={props.unlockUrl}
            maxLength={500}
            placeholder="https://..."
            onChange={(event) => props.setUnlockUrl(event.target.value)}
          />
          <div className="notice">Unlock content is stored as onchain metadata. Do not use private secrets.</div>
        </>
      )}
    </>
  );
}

function getModeButtonLabel(mode: PreviewMode) {
  if (mode === "payment") return "Payment Link";
  if (mode === "invoice") return "Invoice";
  if (mode === "unlock") return "Unlock";
  return "Group";
}
