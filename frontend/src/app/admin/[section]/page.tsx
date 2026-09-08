import { notFound } from "next/navigation";

import AdminConsole from "@/components/admin/AdminConsole";

const SECTIONS = [
  "overview",
  "workloads",
  "users",
  "models",
  "resources",
  "knowledge",
  "audit",
  "sovereignty",
  "system",
];

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export default function AdminSectionPage({ params }: { params: { section: string } }) {
  if (!SECTIONS.includes(params.section)) {
    notFound();
  }
  return <AdminConsole />;
}
