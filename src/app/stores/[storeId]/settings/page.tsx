import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Website settings" };

export default function Page() {
  return <NotAvailablePage title="Website settings" icon="settings" />;
}
