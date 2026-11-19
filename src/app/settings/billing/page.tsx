import type { Metadata } from "next";

import { BillingView } from "@/features/settings/billing-view";
import { getBilling } from "@/services/settings";

export const metadata: Metadata = { title: "Usage and billing" };

export default async function BillingPage() {
  const billing = await getBilling();
  return <BillingView billing={billing} />;
}
