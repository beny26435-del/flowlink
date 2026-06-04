"use client";

import { CopyButton } from "./CopyButton";

export function shortAddress(address: string, lead = 6, tail = 4) {
  if (!address || address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

export function AddressDisplay({ address, copy = false }: { address: string; copy?: boolean }) {
  return (
    <span className="address-inline">
      <span className="address-text" title={address}>
        {shortAddress(address)}
      </span>
      {copy && <CopyButton value={address} label="Copy" compact />}
    </span>
  );
}
