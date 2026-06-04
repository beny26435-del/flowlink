"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function StatCard({ label, value, detail, delay = 0 }: { label: string; value: ReactNode; detail?: string; delay?: number }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay }}
      whileHover={{ y: -4, boxShadow: "0 28px 90px rgba(0, 0, 0, 0.52)" }}
    >
      <span className="mock-label">{label}</span>
      <div className="stat-value">{value}</div>
      {detail && <p className="small">{detail}</p>}
    </motion.div>
  );
}
