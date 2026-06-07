import "dotenv/config";
import { getAddress, isAddress, parseEventLogs, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET_RPC_URL } from "../src/arc/chain";
import { flowLinkV2Abi } from "../src/flowlink-v2/abi";
import {
  createFlowLinkV2PublicClient,
  createFlowLinkV2WalletClient,
  createGroupLink,
  createInvoiceLink,
  createPaymentLink,
  createUnlockLink,
  getLink,
  getLinkStatus,
} from "../src/flowlink-v2/client";
import {
  buildExplorerAddressUrl,
  buildExplorerTxUrl,
  formatNativeUsdcAmount,
  getModeLabel,
  parseNativeUsdcAmount,
} from "../src/flowlink-v2/utils";

const rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL;
const contractAddress = readContractAddress();
const privateKey = readPrivateKey();
const account = privateKeyToAccount(privateKey);
const recipient = readRecipient(account.address);
const amount = parseNativeUsdcAmount(process.env.SMOKE_AMOUNT_USDC ?? "0.01");
const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

const publicClient = createFlowLinkV2PublicClient(rpcUrl);
const walletClient = createFlowLinkV2WalletClient(privateKey, rpcUrl);
const config = {
  contractAddress,
  rpcUrl,
  publicClient,
  walletClient,
};

console.log("FlowLink multi-mode smoke test");
console.log("Network: Arc Testnet");
console.log(`Contract: ${contractAddress}`);
console.log(`Contract URL: ${buildExplorerAddressUrl(contractAddress)}`);
console.log(`Creator: ${account.address}`);
console.log(`Recipient: ${recipient}`);
console.log("Pay/contribute/refund are disabled in this smoke script unless you extend it with explicit flags.");

const created = [
  await createAndRead(
    "Payment Link",
    createPaymentLink(config, {
      recipient,
      amount,
      deadline: 0n,
      title: "FlowLink smoke payment",
      description: `Created by scripts/smoke-v2.ts at ${new Date().toISOString()}`,
    }),
  ),
  await createAndRead(
    "Invoice",
    createInvoiceLink(config, {
      recipient,
      amount,
      deadline,
      clientName: "Smoke Client",
      invoiceNumber: `SMOKE-${Date.now()}`,
      serviceTitle: "Arc Testnet smoke invoice",
      description: "Invoice smoke test",
    }),
  ),
  await createAndRead(
    "Unlock",
    createUnlockLink(config, {
      recipient,
      amount,
      deadline: 0n,
      title: "FlowLink smoke unlock",
      description: "Unlock smoke test",
      successMessage: "Unlocked by smoke test",
      unlockUrl: "https://example.com/flowlink-smoke",
    }),
  ),
  await createAndRead(
    "Group",
    createGroupLink(config, {
      recipient,
      goalAmount: amount,
      deadline,
      title: "FlowLink smoke group",
      description: "Group smoke test",
    }),
  ),
];

for (const item of created) {
  console.log(item);
}

async function createAndRead(label: string, txPromise: Promise<Hex>) {
  const txHash = await txPromise;
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const logs = parseEventLogs({
    abi: flowLinkV2Abi,
    eventName: "LinkCreated",
    logs: receipt.logs,
  });

  const linkId = (logs[0] as any)?.args?.linkId;
  if (!linkId) throw new Error(`${label}: LinkCreated event not found.`);

  const link = await getLink(config, linkId);
  const status = await getLinkStatus(config, linkId);

  return [
    `${label}:`,
    `  Link ID: ${linkId.toString()}`,
    `  Mode: ${getModeLabel(link.mode)}`,
    `  Title: ${link.title}`,
    `  Amount: ${formatNativeUsdcAmount(link.amount)} native Arc USDC`,
    `  Paid amount: ${formatNativeUsdcAmount(status.paidAmount)} native Arc USDC`,
    `  Remaining: ${formatNativeUsdcAmount(status.remainingAmount)} native Arc USDC`,
    `  Create tx: ${txHash}`,
    `  Create tx URL: ${buildExplorerTxUrl(txHash)}`,
  ].join("\n");
}

function readContractAddress(): Address {
  const value = process.env.FLOWLINK_V2_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS;
  if (!value || !isAddress(value)) {
    throw new Error("Set FLOWLINK_V2_CONTRACT_ADDRESS or NEXT_PUBLIC_FLOWLINK_V2_CONTRACT_ADDRESS to the deployed FlowLink address.");
  }

  return getAddress(value);
}

function readPrivateKey(): Hex {
  const value = process.env.PRIVATE_KEY;
  if (!value) {
    throw new Error("Set PRIVATE_KEY in .env to create smoke-test FlowLinks.");
  }

  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

function readRecipient(defaultRecipient: Address): Address {
  const value = process.env.SMOKE_RECIPIENT;
  if (!value) return defaultRecipient;
  if (!isAddress(value)) throw new Error("SMOKE_RECIPIENT must be a valid EVM address.");
  return getAddress(value);
}
