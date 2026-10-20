"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconBoard, IconFlag, IconHome, IconPlus, IconReports, IconVault, Mark } from "./icons";
import { ACTIVE_NETWORK, PREVIEW_DATA } from "@/lib/config";
import { PREVIEW_IDENTITIES, sameAddress, useWallet } from "@/lib/wallet";
import { ADMIN_WALLET, PROGRAMMES, getProgramme, getReport } from "@/lib/sample-data";
import { short } from "@/lib/format";

type Crumb = { label: string; href?: string };

function crumbsFor(path: string): Crumb[] {
  const seg = path.split("/").filter(Boolean);
  const project = (id: string) => getProgramme(id)?.project ?? id;
  if (seg[0] === "programs") {
    if (seg[1] === "create") return [{ label: "Programmes", href: "/programs" }, { label: "New programme" }];
    if (seg[1] && seg[2] === "submit")
      return [{ label: "Programmes", href: "/programs" }, { label: project(seg[1]), href: `/programs/${seg[1]}` }, { label: "Submit report" }];
    if (seg[1]) return [{ label: "Programmes", href: "/programs" }, { label: project(seg[1]) }];
    return [{ label: "Programmes" }];
  }
  if (seg[0] === "researcher") return [{ label: "Your reports" }];
  if (seg[0] === "reports") {
    const r = getReport(seg[1] ?? "");
    return r
      ? [{ label: project(r.programmeId), href: `/programs/${r.programmeId}` }, { label: r.id }]
      : [{ label: "Report" }];
  }
  if (seg[0] === "dashboard") return [{ label: "Your programmes" }, { label: project(seg[2] ?? "") }];
  if (seg[0] === "admin") return [{ label: "Moderation" }];
  return [];
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { address } = useWallet();
  const owned = PROGRAMMES.find((p) => sameAddress(p.owner, address));
  const isAdmin = sameAddress(address, ADMIN_WALLET);

  const nav = [
    { href: "/programs", label: "Programmes", icon: <IconBoard />, active: path === "/programs" || (/^\/programs\/(?!create)/.test(path)) },
    { href: "/researcher", label: "Your reports", icon: <IconReports />, active: path.startsWith("/researcher") || path.startsWith("/reports") },
    {
      href: owned ? `/dashboard/programs/${owned.id}` : "/dashboard/programs/quayside-bridge",
      label: "Your programmes",
      icon: <IconVault />,
      active: path.startsWith("/dashboard"),
    },
    { href: "/programs/create", label: "Start a programme", icon: <IconPlus />, active: path === "/programs/create" },
  ];
  if (isAdmin || path.startsWith("/admin")) nav.push({ href: "/admin", label: "Moderation", icon: <IconFlag />, active: path.startsWith("/admin") });

  const crumbs = crumbsFor(path);

  return (
    <div className="app-root">
      <nav className="rail" aria-label="Sehat">
        <Link href="/" className="rail-mark" aria-label="Sehat home">
          <Mark />
        </Link>
        <div className="rail-group">
          {nav.map((n) => (
            <Link key={n.label} href={n.href} className="rail-item" aria-current={n.active ? "page" : undefined} aria-label={n.label}>
              {n.icon}
              <span className="tip">{n.label}</span>
            </Link>
          ))}
        </div>
        <div className="rail-bottom">
          <Link href="/" className="rail-item" aria-label="Sehat home">
            <IconHome />
            <span className="tip">Sehat home</span>
          </Link>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="sep">/</span>}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="here">{c.label}</span>}
              </span>
            ))}
          </nav>
          <div className="topbar-right">
            <span className="netchip">
              <span className="dot" />
              <span className="netname">
                {ACTIVE_NETWORK.name} · {ACTIVE_NETWORK.chainId}
              </span>
            </span>
            <WalletButton />
          </div>
        </header>
        {PREVIEW_DATA && (
          <p className="notice-line">
            Preview data. Programmes, reports and balances on this build are samples, not contract state.
          </p>
        )}
        <main className="canvas">{children}</main>
      </div>
    </div>
  );
}

function WalletButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (w.wrongChain) {
    return (
      <button className="btn" onClick={w.switchChain} style={{ color: "var(--notice)", borderColor: "#5a4a20" }}>
        Switch to {ACTIVE_NETWORK.name}
      </button>
    );
  }

  const preview = PREVIEW_IDENTITIES.find((p) => p.address === w.address);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {w.address ? (
          <>
            <span className="num">{short(w.address)}</span>
            {preview && <span className="pill pill-notice" style={{ height: 20 }}>Preview · {preview.label}</span>}
          </>
        ) : (
          "Connect wallet"
        )}
      </button>
      {open && (
        <div className="menu" role="menu">
          {w.address ? (
            <>
              <p className="menu-label">Connected {w.kind === "preview" ? "as a preview identity" : "wallet"}</p>
              <p className="menu-item num" style={{ cursor: "default" }}>{short(w.address, 8, 6)}</p>
              <button className="menu-item" role="menuitem" onClick={() => { w.disconnect(); setOpen(false); }}>
                Disconnect
              </button>
            </>
          ) : (
            <>
              <button className="menu-item" role="menuitem" disabled={w.connecting} onClick={async () => { await w.connectBrowser(); setOpen(false); }}>
                {w.connecting ? "Waiting for wallet…" : "Browser wallet"}
                <span className="meta">{w.hasBrowserWallet ? "Detected" : "Not detected"}</span>
              </button>
              {PREVIEW_IDENTITIES.length > 0 && <p className="menu-label">Preview as (sample data)</p>}
              {PREVIEW_IDENTITIES.map((p) => (
                <button key={p.address} className="menu-item" role="menuitem" onClick={() => { w.connectPreview(p.address); setOpen(false); }}>
                  {p.label}
                  <span className="meta">{p.note}</span>
                </button>
              ))}
              <p className="menu-label">Sehat never asks for a seed phrase or private key.</p>
            </>
          )}
          {w.error && <p className="menu-label" style={{ color: "var(--negative)" }}>{w.error}</p>}
        </div>
      )}
    </div>
  );
}
