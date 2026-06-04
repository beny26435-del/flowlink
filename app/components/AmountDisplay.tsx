import { formatNativeUsdcAmount } from "../../src/flowlink/utils";

export function AmountDisplay({ amount }: { amount: bigint }) {
  return (
    <span className="amount-display">
      <span className="amount-number">{formatNativeUsdcAmount(amount)}</span>
      {" "}
      <span className="amount-unit">native Arc USDC</span>
    </span>
  );
}
