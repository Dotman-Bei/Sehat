import type { Metadata } from "next";
import Builder from "./Builder";

export const metadata: Metadata = { title: "New programme · Sehat" };

export default function CreatePage() {
  return <Builder />;
}
