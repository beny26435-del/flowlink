"use client";

import { motion } from "framer-motion";

export function AnimatedBackground() {
  return (
    <div className="animated-background" aria-hidden="true">
      <motion.div
        className="ambient-ribbon ribbon-one"
        style={{ rotate: "-8deg" }}
        animate={{
          x: ["-6%", "5%", "-6%"],
          y: [0, 18, 0],
          opacity: [0.32, 0.5, 0.32],
          scaleX: [0.98, 1.06, 0.98],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-ribbon ribbon-two"
        style={{ rotate: "7deg" }}
        animate={{
          x: ["8%", "-8%", "8%"],
          y: [0, -18, 0],
          opacity: [0.32, 0.5, 0.32],
          scaleX: [1.04, 0.96, 1.04],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-ribbon ribbon-three"
        style={{ rotate: "10deg" }}
        animate={{
          x: ["3%", "-6%", "3%"],
          y: [0, 16, 0],
          opacity: [0.2, 0.36, 0.2],
          scaleX: [0.94, 1.06, 0.94],
        }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-edge-glow"
        style={{ rotate: "-19deg" }}
        animate={{
          x: ["-12%", "8%", "-12%"],
          y: [18, -22, 18],
          opacity: [0.1, 0.22, 0.1],
          scaleX: [0.96, 1.06, 0.96],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-sheen"
        style={{ rotate: "-12deg" }}
        animate={{
          x: ["-12%", "10%", "-12%"],
          y: [0, 14, 0],
          opacity: [0.14, 0.28, 0.14],
          scaleX: [0.94, 1.1, 0.94],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
