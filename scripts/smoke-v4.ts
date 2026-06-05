import "dotenv/config";
import { getAddress, isAddress, parseEventLogs, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET_RPC_URL } from "../src/arc/chain";
import { flowLinkV4Abi } from "../src/flowlink-v4/abi";
import {
  createFlowLinkV4PublicClient,
  createFlowLinkV4WalletClient,
  createGroupLink,
  createInvoiceLink,
  createPaymentLink,
  createUnlockLink,
  getLinkBySlug,
  getLinkIdBySlug,
  getListedCreatorLinks,
  getProfileByAddress,
  getProfileTipStats,
  upsertProfile,
} from "../src/flowlink-v4/client";
import {
  buildExplorerAddressUrl,
  buildExplorerTxUrl,
  buildProfileUrl,
  buildPublicPayUrl,
  formatNativeUsdcAmount,
  generateRandomSlug,
  getModeLabel,
  parseNativeUsdcAmount,
} from "../src/flowlink-v4/utils";

type LinkCreatedLog = {
  args: {
    linkId?: bigint;
    slug?: string;
  };
};

const rpcUrl = process.env.ARC_TESTNET_RPC_URL ?? ARC_TESTNET_RPC_URL;
const contractAddress = readContractAddress();
const privateKey = readPrivateKey();
const account = privateKeyToAccount(privateKey);
const recipient = readRecipient(account.address);
const amount = parseNativeUsdcAmount(process.env.SMOKE_AMOUNT_USDC ?? "0.01");
const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const runTag = Date.now().toString(36).toLowerCase();
const username = `smoke_${runTag.slice(-8)}`;

const publicClient = createFlowLinkV4PublicClient(rpcUrl);
const walletClient = createFlowLinkV4WalletClient(privateKey, rpcUrl);
const config = {
  contractAddress,
  rpcUrl,
  publicClient,
  walletClient,
};
const paymentSlug = generateRandomSlug("payment");
const invoiceSlug = generateRandomSlug("invoice");
const unlockSlug = generateRandomSlug("unlock");
const groupSlug = generateRandomSlug("group");
const minimumTipAmount = parseNativeUsdcAmount(process.env.SMOKE_MINIMUM_TIP_USDC ?? "0.01");

console.log("FlowLink profile and slug smoke test");
console.log("Network: Arc Testnet");
console.log(`Contract: ${contractAddress}`);
console.log(`Contract URL: ${buildExplorerAddressUrl(contractAddress)}`);
console.log(`Creator: ${account.address}`);
console.log(`Recipient: ${recipient}`);
console.log("Pay/contribute/tip/refund are disabled in this smoke script.");

const profileTx = await upsertProfile(config, {
  username,
  displayName: "FlowLink Smoke",
  bio: "Created by scripts/smoke-v4.ts on Arc Testnet.",
  avatarUrl: "",
  tipsEnabled: true,
  minimumTipAmount,
});
await publicClient.waitForTransactionReceipt({ hash: profileTx });

const profile = await getProfileByAddress(config, account.address);
const profileUrl = buildProfileUrl(baseUrl, profile);
console.log(`Profile username: ${profile.username || "(none)"}`);
console.log(`Profile URL: ${profileUrl}`);
console.log(`Profile tx URL: ${buildExplorerTxUrl(profileTx)}`);
const tipStats = await getProfileTipStats(config, account.address);
console.log(`Profile tips enabled: ${String(tipStats.tipsEnabled)}`);
console.log(`Profile minimum tip: ${formatNativeUsdcAmount(tipStats.minimumTipAmount)} native Arc USDC`);
console.log(`Profile total tips: ${formatNativeUsdcAmount(tipStats.totalTips)} native Arc USDC`);
console.log(`Profile tip count: ${tipStats.tipCount.toString()}`);

const created = [
  await createAndRead(
    "Payment Link",
    paymentSlug,
    createPaymentLink(config, {
      recipient,
      amount,
      deadline: 0n,
      title: "FlowLink smoke payment",
      description: `Created by scripts/smoke-v4.ts at ${new Date().toISOString()}`,
      slug: paymentSlug,
      listed: true,
    }),
  ),
  await createAndRead(
    "Invoice",
    invoiceSlug,
    createInvoiceLink(config, {
      recipient,
      amount,
      deadline,
      clientName: "Smoke Client",
      invoiceNumber: `SMOKE-${runTag}`,
      serviceTitle: "Arc Testnet smoke invoice",
      description: "Invoice smoke test",
      slug: invoiceSlug,
      listed: true,
    }),
  ),
  await createAndRead(
    "Unlock",
    unlockSlug,
    createUnlockLink(config, {
      recipient,
      amount,
      deadline: 0n,
      title: "FlowLink smoke unlock",
      description: "Unlock smoke test",
      successMessage: "Unlocked by smoke test",
      unlockUrl: "https://example.com/flowlink-smoke",
      slug: unlockSlug,
      listed: true,
    }),
  ),
  await createAndRead(
    "Group",
    groupSlug,
    createGroupLink(config, {
      recipient,
      goalAmount: amount,
      deadline,
      title: "FlowLink smoke group",
      description: "Group smoke test",
      slug: groupSlug,
      listed: true,
    }),
  ),
];

for (const item of created) {
  console.log(item);
}

const listed = await getListedCreatorLinks(config, account.address);
console.log(`Listed link count for creator: ${listed.length}`);

async function createAndRead(label: string, fallbackSlug: string, txPromise: Promise<Hex>) {
  const txHash = await txPromise;
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const logs = parseEventLogs({
    abi: flowLinkV4Abi,
    eventName: "LinkCreated",
    logs: receipt.logs,
  }) as LinkCreatedLog[];

  const slug = logs[0]?.args.slug ?? fallbackSlug;
  const linkId = logs[0]?.args.linkId ?? (await getLinkIdBySlug(config, slug));
  const link = await getLinkBySlug(config, slug);

  return [
    `${label}:`,
    `  Link ID: ${linkId.toString()}`,
    `  Slug: ${link.slug}`,
    `  Public URL: ${buildPublicPayUrl(baseUrl, link.slug)}`,
    `  Mode: ${getModeLabel(link.mode)}`,
    `  Title: ${link.title}`,
    `  Amount: ${formatNativeUsdcAmount(link.amount)} native Arc USDC`,
    `  Listed: ${String(link.listed)}`,
    `  Create tx: ${txHash}`,
    `  Create tx URL: ${buildExplorerTxUrl(txHash)}`,
  ].join("\n");
}

function readContractAddress(): Address {
  const value = process.env.FLOWLINK_V4_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS;
  if (!value || !isAddress(value)) {
    throw new Error("Set FLOWLINK_V4_CONTRACT_ADDRESS or NEXT_PUBLIC_FLOWLINK_V4_CONTRACT_ADDRESS to the deployed FlowLink address.");
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
