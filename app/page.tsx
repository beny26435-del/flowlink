"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Button } from "./components/Button";
import { CopyButton } from "./components/CopyButton";
import { ExplorerLink } from "./components/ExplorerLink";
import { PageTransition } from "./components/PageTransition";
import { FLOWLINK_CONTRACT_MISSING_MESSAGE, flowLinkContractAddress, hasArcletContractAddress } from "./config";

const features = [
  {
    title: "Native Arc USDC",
    body: "Arclet uses native Arc value through msg.value, so the payment flow stays direct and stablecoin-native.",
  },
  {
    title: "Onchain receipts",
    body: "Every paid link stores payer, timestamp, amount, and receipt ID onchain for durable proof.",
  },
  {
    title: "No manual tx checking",
    body: "Creators can read dashboard state from the contract instead of chasing payment screenshots.",
  },
  {
    title: "Public profiles",
    body: "Share one profile for payment links, invoices, tips, unlocks, and group funding.",
  },
];

const trust = ["Arc Testnet", "Native USDC", "Onchain receipts", "No database"];

export default function HomePage() {
  return (
    <PageTransition>
      <section className="hero-premium">
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
          <motion.p className="eyebrow" variants={fadeUp}>
            Arclet checkout
          </motion.p>
          <motion.h1 className="hero-title gradient-text" variants={fadeUp} aria-label="Stablecoin payment links for Arc">
            <span>Stablecoin</span>
            <span>payment links</span>
            <span>for Arc</span>
          </motion.h1>
          <motion.p className="hero-copy" variants={fadeUp}>
            Create shareable payment links, accept native Arc USDC, and generate onchain receipts in seconds.
          </motion.p>
          <motion.div className="actions" variants={fadeUp}>
            <Button href="/create">Create Link</Button>
            <Button href="/bridge?direction=sepolia-to-arc" variant="secondary">
              Bridge USDC
            </Button>
            <Button href="/dashboard" variant="secondary">
              View Dashboard
            </Button>
            <Button href="/profile" variant="secondary">
              Create your Arclet profile
            </Button>
          </motion.div>
          <motion.div className="hero-funding-note" variants={fadeUp}>
            <span className="trust-pill bridge-pill">Sepolia ↔ Arc bridge</span>
            <span>Need funds on Arc? Bridge USDC from Sepolia with Arc App Kit.</span>
          </motion.div>
          <motion.div className="trust-row" variants={fadeUp}>
            {trust.map((item) => (
              <span className="trust-pill" key={item}>
                {item}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <motion.aside
          className="hero-visual"
          initial={{ opacity: 0, x: 34, rotate: 1.5 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="preview-header">
            <span className="badge good pulse">Arc Testnet</span>
            <span className="badge">Native USDC</span>
          </div>
          <span className="mock-label">Payment link</span>
          <div className="amount-xl">125.00 USDC</div>
          <p className="muted">Design sprint invoice</p>
          <div className="mock-terminal">
            <div className="mock-grid">
              <MockRow label="Amount due" value="125.00 native Arc USDC" />
              <MockRow label="Recipient" value="0x3dBd...D8b7" />
              <MockRow label="Status" value="Payable" />
              <MockRow label="Receipt ID" value="0x8f12...c9a4" />
            </div>
          </div>
          <div className="actions">
            <button className="button" type="button" disabled>
              Pay with native Arc USDC
            </button>
          </div>
        </motion.aside>
      </section>

      <motion.section className="feature-grid" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
        {features.map((feature) => (
          <motion.article className="glass-card section" variants={fadeUp} whileHover={{ y: -6 }} key={feature.title}>
            <span className="eyebrow">{feature.title}</span>
            <p className="muted">{feature.body}</p>
          </motion.article>
        ))}
      </motion.section>

      <motion.section className="section" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.18 }}>
        <div className="page-header">
          <div>
            <p className="eyebrow">Arclet contract</p>
            <h2>Arc Testnet contract</h2>
            <p className="muted">This demo reads and writes to the Arclet contract. No database or mocked payment states.</p>
          </div>
          <span className="badge good">Chain ID 5042002</span>
        </div>
        {hasArcletContractAddress && flowLinkContractAddress ? (
          <div className="data-list">
            <div className="data-row">
              <span>Contract address</span>
              <span className="mono">{flowLinkContractAddress}</span>
            </div>
            <div className="actions">
              <CopyButton value={flowLinkContractAddress} label="Copy contract" />
              <ExplorerLink kind="address" value={flowLinkContractAddress} label="Open contract" />
            </div>
          </div>
        ) : (
          <div className="error">{FLOWLINK_CONTRACT_MISSING_MESSAGE}</div>
        )}
      </motion.section>
    </PageTransition>
  );
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: "easeOut" } },
};

function MockRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mock-row">
      <span className="mock-label">{label}</span>
      <span className="mock-value mono">{value}</span>
    </div>
  );
}
