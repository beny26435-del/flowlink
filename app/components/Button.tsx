"use client";

import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { motion } from "framer-motion";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
};

export function Button({ children, href, variant = "primary", className = "", ...props }: ButtonProps) {
  const classNames = `${variant === "primary" ? "button" : variant === "danger" ? "danger-button" : "secondary-button"} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={classNames}>
        <motion.span whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
          {children}
        </motion.span>
      </Link>
    );
  }

  return (
    <motion.button
      whileHover={{ y: props.disabled ? 0 : -2 }}
      whileTap={{ scale: props.disabled ? 1 : 0.97 }}
      className={classNames}
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type}
    >
      {children}
    </motion.button>
  );
}
