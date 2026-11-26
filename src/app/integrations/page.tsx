import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return <NotAvailablePage title="Integrations" icon="plug" />;
}
