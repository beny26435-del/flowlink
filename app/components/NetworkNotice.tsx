"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { motion } from "framer-motion";
import { arcTestnet } from "../../src/arc/chain";

export function NetworkNotice() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === arcTestnet.id) return null;

  return (
    <motion.div className="notice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <p>Switch your wallet to Arc Testnet to create or pay Arclet links.</p>
      <button className="secondary-button" type="button" disabled={isPending} onClick={() => switchChain({ chainId: arcTestnet.id })}>
        {isPending ? "Switching..." : "Switch to Arc Testnet"}
      </button>
    </motion.div>
  );
}
