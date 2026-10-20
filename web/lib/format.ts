const nf = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** Whole BOT with thousands separators: 75,000 */
export const bot = (n: number) => nf.format(n);

/** Signed change: +40,000 / −7,000 */
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + nf.format(Math.abs(n));

/** 0x7a3f…c91e */
export const short = (hex: string, head = 4, tail = 4) =>
  hex.length <= head + tail + 3 ? hex : `${hex.slice(0, 2 + head)}…${hex.slice(-tail)}`;

export const TODAY = "2026-10-20";

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

/** Initials for a person disc: "Kemi Okafor" → "KO" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
