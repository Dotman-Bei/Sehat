// Writes Sehat's logo files to public/brand and app/icon.svg. Run: node scripts/brand.mjs
//
// The mark is a solid block cut by two slots, one from each side, so what is left reads as an S:
// a vault with a way in (funding) and a way out (payout). Everything sits on whole units of a
// 24-grid with bars 6 / slots 3 and stems 7.5, which lands on exact pixels at 16, 32 and 48.
// The wordmark uses the same slotted construction at a lighter stroke (4.5 on a 24 cap height).
import { mkdirSync, writeFileSync } from "node:fs";

const CRIMSON = "#b11226";
const INK = "#0a0a0a";
const PAPER = "#efefef";

const MARK = "M0 0H24V6H7.5V9H24V24H0V18H16.5V15H0Z";
const WORD = [
  "M0 0H17V4.5H4.5V9.75H17V24H0V19.5H12.5V14.25H0Z", // S
  "M20.5 0H35.5V4.5H25V9.75H34V14.25H25V19.5H35.5V24H20.5Z", // E
  "M39 0H43.5V9.75H51.5V0H56V24H51.5V14.25H43.5V24H39Z", // H
  "M59.5 0H76.5V24H72V14.25H64V24H59.5ZM64 4.5V9.75H72V4.5Z", // A (counter wound the other way)
  "M80 0H97V4.5H90.75V24H86.25V4.5H80Z", // T
].join("");
const WORD_W = 97;

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" role="img" aria-label="${title}">` +
  `<title>${title}</title>${body}</svg>\n`;

const mark = (fill) => svg(24, 24, `<path fill="${fill}" d="${MARK}"/>`, "Sehat");
const word = (fill) => svg(WORD_W, 24, `<path fill="${fill}" d="${WORD}"/>`, "Sehat");
// Lockup: 40px mark, wordmark at half its height, gap of a quarter mark.
const lockup = (markFill, wordFill) => {
  const s = 20 / 24;
  return svg(
    52 + WORD_W * s,
    40,
    `<path fill="${markFill}" transform="scale(${40 / 24})" d="${MARK}"/>` +
      `<path fill="${wordFill}" transform="translate(52 10) scale(${s})" d="${WORD}"/>`,
    "Sehat",
  );
};
// App icon: the white mark centred on a crimson tile, for launchers that crop to a square.
// 48 grid with the mark at 32 keeps every edge on a whole pixel.
const tile = svg(
  48,
  48,
  `<rect width="48" height="48" fill="${CRIMSON}"/><path fill="${PAPER}" transform="translate(8 8) scale(${4 / 3})" d="${MARK}"/>`,
  "Sehat",
);

const files = {
  "public/brand/sehat-mark.svg": mark(CRIMSON),
  "public/brand/sehat-mark-black.svg": mark(INK),
  "public/brand/sehat-mark-white.svg": mark(PAPER),
  "public/brand/sehat-wordmark-black.svg": word(INK),
  "public/brand/sehat-wordmark-white.svg": word(PAPER),
  "public/brand/sehat-logo-on-light.svg": lockup(CRIMSON, INK),
  "public/brand/sehat-logo-on-dark.svg": lockup(CRIMSON, PAPER),
  "public/brand/sehat-logo-black.svg": lockup(INK, INK),
  "public/brand/sehat-logo-white.svg": lockup(PAPER, PAPER),
  "public/brand/sehat-app-icon.svg": tile,
  "app/icon.svg": mark(CRIMSON),
};
mkdirSync("public/brand", { recursive: true });
for (const [path, body] of Object.entries(files)) writeFileSync(path, body);
console.log(Object.keys(files).join("\n"));
