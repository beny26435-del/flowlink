"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet, ARC_TESTNET_RPC_URL } from "../src/arc/chain";

export const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || ARC_TESTNET_RPC_URL),
  },
  ssr: true,
});
