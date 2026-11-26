import type { Metadata } from "next";

import { WebsiteOverview } from "@/features/websites/website-overview";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <WebsiteOverview />;
}
