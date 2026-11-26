import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInvitation } from "@/features/auth/accept-invitation";

export const metadata: Metadata = { title: "Invitation" };

export default function Page() {
  // The page reads the address's query string, which is only known in the browser.
  return (
    <Suspense>
      <AcceptInvitation />
    </Suspense>
  );
}
