import { keccak256, stringToHex, type Address, type Hex } from "viem";

export const ARC_MEMO_CONTRACT_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505" as const;

export const arcMemoAbi = [
  {
    type: "function",
    name: "memo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "memoId", type: "bytes32" },
      { name: "memoData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Memo",
    anonymous: false,
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "callDataHash", type: "bytes32", indexed: false },
      { name: "memoId", type: "bytes32", indexed: true },
      { name: "memo", type: "bytes", indexed: false },
      { name: "memoIndex", type: "uint256", indexed: false },
    ],
  },
] as const;

export type ArcletMemoInput = {
  mode: string;
  slug: string;
  creator: Address;
  recipient: Address;
  amount: string;
  reference: string;
  invoiceNumber?: string;
  clientName?: string;
  serviceTitle?: string;
};

export type ArcletMemo = {
  memoId: Hex;
  memoData: Hex;
  payload: {
    app: "arclet";
    action: "create_link";
    mode: string;
    slug: string;
    reference: string;
    creator: Address;
    recipient: Address;
    amount: string;
    invoiceNumber?: string;
    clientName?: string;
    serviceTitle?: string;
  };
};

export function buildArcletCreateMemo(input: ArcletMemoInput): ArcletMemo {
  const reference = input.reference.trim();
  const payload = {
    app: "arclet",
    action: "create_link",
    mode: input.mode,
    slug: input.slug.trim(),
    reference,
    creator: input.creator,
    recipient: input.recipient,
    amount: input.amount,
    ...(input.invoiceNumber?.trim() ? { invoiceNumber: input.invoiceNumber.trim() } : {}),
    ...(input.clientName?.trim() ? { clientName: input.clientName.trim() } : {}),
    ...(input.serviceTitle?.trim() ? { serviceTitle: input.serviceTitle.trim() } : {}),
  } as const;

  return {
    memoId: keccak256(stringToHex(`arclet:create:${payload.mode}:${payload.slug}:${reference}`)),
    memoData: stringToHex(JSON.stringify(payload)),
    payload,
  };
}
