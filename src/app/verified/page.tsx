import type { Metadata } from "next";
import { Suspense } from "react";

import { Verified } from "@/features/auth/verified";

export const metadata: Metadata = { title: "Email confirmed" };

export default function Page() {
  // The page reads the address's query string, which is only known in the browser.
  return (
    <Suspense>
      <Verified />
    </Suspense>
  );
}
