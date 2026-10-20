"use client";

import { useState } from "react";
import { IconCopy, IconExternal } from "./icons";
import { short } from "@/lib/format";

/** An address or hash: truncated in tabular figures, a copy control, and an optional explorer link. */
export default function Hash({ value, href, head = 4, tail = 4 }: { value: string; href?: string; head?: number; tail?: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked: the full value stays in the title */
    }
  }
  return (
    <span className="hash" title={value}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="hash-link num">
          {short(value, head, tail)}
          <IconExternal />
        </a>
      ) : (
        <span className="num">{short(value, head, tail)}</span>
      )}
      <button type="button" className="hash-copy" onClick={copy} aria-label={copied ? "Copied" : `Copy ${value}`}>
        {copied ? <span className="hash-done">Copied</span> : <IconCopy />}
      </button>
    </span>
  );
}
