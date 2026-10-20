import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Manage from "./Manage";
import { findProgramme } from "@/lib/programmes";

type Params = { programId: string };

// Escrow figures and status come from the contract on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await findProgramme((await params).programId);
  return { title: p ? `Manage ${p.project} · Sehat` : "Manage · Sehat" };
}

export default async function ManagePage({ params }: { params: Promise<Params> }) {
  const p = await findProgramme((await params).programId);
  if (!p) notFound();
  return <Manage programme={p} />;
}
