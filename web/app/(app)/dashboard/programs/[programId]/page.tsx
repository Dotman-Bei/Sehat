import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Manage from "./Manage";
import { PROGRAMMES, getProgramme } from "@/lib/sample-data";

type Params = { programId: string };

export function generateStaticParams() {
  return PROGRAMMES.map((p) => ({ programId: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = getProgramme((await params).programId);
  return { title: p ? `Manage ${p.project} · Sehat` : "Manage · Sehat" };
}

export default async function ManagePage({ params }: { params: Promise<Params> }) {
  const { programId } = await params;
  if (!getProgramme(programId)) notFound();
  return <Manage programId={programId} />;
}
