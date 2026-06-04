"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { arcTestnet } from "../../src/arc/chain";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];
  const wrongNetwork = isConnected && chainId !== arcTestnet.id;

  if (!isConnected || !address) {
    return (
      <motion.button
        className="button"
        type="button"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </motion.button>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div className="status-row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <span className={wrongNetwork ? "badge warn" : "badge good pulse"}>
          {shortAddress(address)}
          {wrongNetwork ? " - wrong network" : ""}
        </span>
        <motion.button className="secondary-button" type="button" onClick={() => disconnect()} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
          Disconnect
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
