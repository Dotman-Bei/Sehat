import { MARK_PATH } from "@/components/Logo";
// One outline set, 1.5px stroke, drawn on a 20px grid.
const base = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Sehat's mark: a deposit box seen face-on, its brass plate and keyhole, in crimson. */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#b11226" d={MARK_PATH} />
    </svg>
  );
}

export const IconBoard = () => (
  <svg {...base} aria-hidden>
    <rect x="3" y="3" width="6" height="6" />
    <rect x="11" y="3" width="6" height="6" />
    <rect x="3" y="11" width="6" height="6" />
    <rect x="11" y="11" width="6" height="6" />
  </svg>
);
export const IconReports = () => (
  <svg {...base} aria-hidden>
    <path d="M5 2.5h7l3.5 3.5v11.5H5z" />
    <path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5" />
  </svg>
);
export const IconVault = () => (
  <svg {...base} aria-hidden>
    <rect x="3" y="3.5" width="14" height="13" />
    <circle cx="10" cy="10" r="3" />
    <path d="M10 7v1M10 12v1M7 10h1M12 10h1M5 16.5V18M15 16.5V18" />
  </svg>
);
export const IconFlag = () => (
  <svg {...base} aria-hidden>
    <path d="M5 18V3M5 3.5h10l-2 3.5 2 3.5H5" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base} aria-hidden>
    <path d="M10 4v12M4 10h12" />
  </svg>
);
export const IconHome = () => (
  <svg {...base} aria-hidden>
    <path d="M3 9.5 10 3l7 6.5V17H3z" />
    <path d="M8 17v-5h4v5" />
  </svg>
);
export const IconExternal = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <path d="M4.5 2.5h-2v7h7v-2M7 2.5h2.5V5M9.5 2.5 5.5 6.5" />
  </svg>
);
export const IconCopy = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <rect x="4" y="4" width="6" height="6" />
    <path d="M8 4V2H2v6h2" />
  </svg>
);
export const IconChevron = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <path d="m3 4.5 3 3 3-3" />
  </svg>
);
