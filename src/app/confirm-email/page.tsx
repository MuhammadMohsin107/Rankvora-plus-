import type { Metadata } from "next";
import { Suspense } from "react";

import { ConfirmEmail } from "@/features/auth/confirm-email";

export const metadata: Metadata = { title: "Confirm email" };

export default function Page() {
  // The page reads the address's query string, which is only known in the browser.
  return (
    <Suspense>
      <ConfirmEmail />
    </Suspense>
  );
}
