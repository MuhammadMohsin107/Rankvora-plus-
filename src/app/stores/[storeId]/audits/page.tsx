import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Audit" };

export default function Page() {
  return <NotAvailablePage title="Audit" icon="audit" />;
}
