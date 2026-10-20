import type { Metadata } from "next";
import Admin from "./Admin";
import { listProgrammes } from "@/lib/programmes";

export const metadata: Metadata = { title: "Moderation · Sehat" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <Admin programmes={await listProgrammes()} />;
}
