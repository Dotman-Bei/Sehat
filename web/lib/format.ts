const nf = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 });

/** BOT with thousands separators and up to 4 decimals: 75,000 · 0.08 */
export const bot = (n: number) => nf.format(n);

/** Signed change: +40,000 / −7,000 */
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + nf.format(Math.abs(n));

/** 0x7a3f…c91e */
export const short = (hex: string, head = 4, tail = 4) =>
  hex.length <= head + tail + 3 ? hex : `${hex.slice(0, 2 + head)}…${hex.slice(-tail)}`;

import { CHAIN_LIVE } from "./config";

// Sample data is written relative to 2026-10-20; live chain data uses the real date.
export const TODAY = CHAIN_LIVE ? new Date().toISOString().slice(0, 10) : "2026-10-20";

const DAY = 86_400_000;
export const daysAgo = (iso: string, today = TODAY) =>
  Math.round((Date.parse(today) - Date.parse(iso)) / DAY);

/** Recency in words: Today, Yesterday, 4 days, 3 weeks */
export const age = (iso: string, today = TODAY) => {
  const d = daysAgo(iso, today);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 14) return `${d} days`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  return `${Math.round(d / 30)} months`;
};

/** "today", "yesterday", "3 days ago" */
export const ago = (iso: string, today = TODAY) => {
  const a = age(iso, today);
  return a === "Today" ? "today" : a === "Yesterday" ? "yesterday" : `${a} ago`;
};

/** Initials for a person disc: "Kemi Okafor" → "KO" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
