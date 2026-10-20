import type { Metadata } from "next";
import ResearcherDashboard from "./ResearcherDashboard";

export const metadata: Metadata = { title: "Your reports · Sehat" };

export default function ResearcherPage() {
  return <ResearcherDashboard />;
}
