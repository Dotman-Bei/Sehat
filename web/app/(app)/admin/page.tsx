import type { Metadata } from "next";
import Admin from "./Admin";

export const metadata: Metadata = { title: "Moderation · Sehat" };

export default function AdminPage() {
  return <Admin />;
}
