import type { Metadata } from "next";

import { AddWebsite } from "@/features/websites/add-website";

export const metadata: Metadata = { title: "Add website" };

export default function Page() {
  return <AddWebsite />;
}
