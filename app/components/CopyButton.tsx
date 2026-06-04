"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function CopyButton({ value, label = "Copy", compact = false }: { value: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <motion.button
      className="copy-button"
      type="button"
      onClick={copy}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      animate={copied ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      style={compact ? { minHeight: 28, padding: "0 10px", fontSize: 12 } : undefined}
    >
      {copied ? "Copied" : label}
    </motion.button>
  );
}
