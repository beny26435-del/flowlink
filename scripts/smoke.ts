import "dotenv/config";
import { getAddress, isAddress, parseEventLogs, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET_RPC_URL } from "../src/arc/chain.js";
import { flowLinkAbi } from "../src/flowlink/abi.js";
import {
  createFlowLinkPublicClient,
  createFlowLinkWalletClient,
  createLink,
  getLink,
  getLinkStatus,
  isPayable,
  payLink,
} from "../src/flowlink/client.js";
import {
  buildExplorerAddressUrl,
  buildExplorerTxUrl,
  formatNativeUsdcAmount,
  parseNativeUsdcAmount,
} from "../src/flowlink/utils.js";

const shouldPay = process.argv.includes("--pay");
const rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL;
const contractAddress = readContractAddress();
const privateKey = readPrivateKey();
const account = privateKeyToAccount(privateKey);
const recipient = readRecipient(account.address);
const amount = parseNativeUsdcAmount(process.env.SMOKE_AMOUNT_USDC ?? "0.01");

const publicClient = createFlowLinkPublicClient(rpcUrl);
const walletClient = createFlowLinkWalletClient(privateKey, rpcUrl);
const config = {
  contractAddress,
  rpcUrl,
  publicClient,
  walletClient,
};

console.log("FlowLink smoke test");
console.log("Network: Arc Testnet");
console.log(`Contract: ${contractAddress}`);
console.log(`Contract URL: ${buildExplorerAddressUrl(contractAddress)}`);
console.log(`Creator: ${account.address}`);
console.log(`Recipient: ${recipient}`);
console.log(`Amount: ${formatNativeUsdcAmount(amount)} native Arc USDC`);
console.log(`Pay enabled: ${shouldPay ? "yes" : "no (--pay was provided)"}`);

const createTxHash = await createLink(config, {
  recipient,
  amount,
  title: "FlowLink smoke test",
  description: `Created by scripts/smoke.ts at ${new Date().toISOString()}`,
});

console.log(`Create tx: ${createTxHash}`);
console.log(`Create tx URL: ${buildExplorerTxUrl(createTxHash)}`);

const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash });
const createdLogs = parseEventLogs({
  abi: flowLinkAbi,
  eventName: "LinkCreated",
  logs: createReceipt.logs,
});

if (createdLogs.length === 0) {
  throw new Error("LinkCreated event was not found in the createLink transaction receipt.");
}

const linkId = createdLogs[0].args.linkId;
const link = await getLink(config, linkId);
const status = await getLinkStatus(config, linkId);
const payable = await isPayable(config, linkId);

printLink("Created link", linkId, link, status, payable);

if (!shouldPay) {
  console.log("Skipping payment. Re-run with --pay to send the exact native Arc USDC amount.");
  process.exit(0);
}

const payTxHash = await payLink(config, linkId, amount);
console.log(`Pay tx: ${payTxHash}`);
console.log(`Pay tx URL: ${buildExplorerTxUrl(payTxHash)}`);

await publicClient.waitForTransactionReceipt({ hash: payTxHash });

const paidLink = await getLink(config, linkId);
const paidStatus = await getLinkStatus(config, linkId);
const paidPayable = await isPayable(config, linkId);

printLink("Paid link", linkId, paidLink, paidStatus, paidPayable);

function readContractAddress(): Address {
  const value = process.env.FLOWLINK_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS;
  if (!value || !isAddress(value)) {
    throw new Error("Set FLOWLINK_CONTRACT_ADDRESS or NEXT_PUBLIC_FLOWLINK_CONTRACT_ADDRESS to the deployed FlowLink address.");
  }

  return getAddress(value);
}

function readPrivateKey(): Hex {
  const value = process.env.PRIVATE_KEY;
  if (!value) {
    throw new Error("Set PRIVATE_KEY in .env to create a smoke-test payment link.");
  }

  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

function readRecipient(defaultRecipient: Address): Address {
  const value = process.env.SMOKE_RECIPIENT;
  if (!value) return defaultRecipient;
  if (!isAddress(value)) throw new Error("SMOKE_RECIPIENT must be a valid EVM address.");
  return getAddress(value);
}

function printLink(
  label: string,
  linkId: bigint,
  link: Awaited<ReturnType<typeof getLink>>,
  status: Awaited<ReturnType<typeof getLinkStatus>>,
  payable: boolean,
) {
  console.log(label);
  console.log(`  Link ID: ${linkId.toString()}`);
  console.log(`  Creator: ${link.creator}`);
  console.log(`  Recipient: ${link.recipient}`);
  console.log(`  Amount: ${formatNativeUsdcAmount(link.amount)} native Arc USDC`);
  console.log(`  Active: ${link.active}`);
  console.log(`  Paid: ${link.paid}`);
  console.log(`  Payer: ${link.payer}`);
  console.log(`  Paid at: ${link.paidAt.toString()}`);
  console.log(`  Receipt ID: ${link.receiptId}`);
  console.log(
    `  Status: exists=${status.exists} active=${status.active} paid=${status.paid} expired=${status.expired} cancelled=${status.cancelled}`,
  );
  console.log(`  Is payable: ${payable}`);
}
