import type { Metadata } from "next";

import { WebsitesScreen } from "@/features/websites/websites-screen";

export const metadata: Metadata = { title: "Websites & Brands" };

export default function Page() {
  return <WebsitesScreen />;
}
