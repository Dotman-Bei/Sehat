// Sehat's mark and wordmark as paths. The source of truth is scripts/brand.mjs, which also writes
// the standalone files in public/brand; keep the two in step.

export const MARK_PATH = "M0 0H24V6H7.5V9H24V24H0V18H16.5V15H0Z";
const WORD_PATH =
  "M0 0H17V4.5H4.5V9.75H17V24H0V19.5H12.5V14.25H0Z" +
  "M20.5 0H35.5V4.5H25V9.75H34V14.25H25V19.5H35.5V24H20.5Z" +
  "M39 0H43.5V9.75H51.5V0H56V24H51.5V14.25H43.5V24H39Z" +
  "M59.5 0H76.5V24H72V14.25H64V24H59.5ZM64 4.5V9.75H72V4.5Z" +
  "M80 0H97V4.5H90.75V24H86.25V4.5H80Z";

/** Mark and wordmark side by side. The mark is crimson; the wordmark takes the text colour. */
export function Logo({ height = 24 }: { height?: number }) {
  const s = 20 / 24;
  return (
    <svg height={height} viewBox={`0 0 ${52 + 97 * s} 40`} role="img" aria-label="Sehat" style={{ display: "block" }}>
      <path fill="var(--accent, #b11226)" transform={`scale(${40 / 24})`} d={MARK_PATH} />
      <path fill="currentColor" transform={`translate(52 10) scale(${s})`} d={WORD_PATH} />
    </svg>
  );
}
