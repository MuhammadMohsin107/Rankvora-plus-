import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPassword } from "@/features/auth/password-reset";

export const metadata: Metadata = { title: "New password" };

export default function Page() {
  // The page reads the address's query string, which is only known in the browser.
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
