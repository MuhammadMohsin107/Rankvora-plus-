import type { Metadata } from "next";
import { Suspense } from "react";

import { SignUp } from "@/features/auth/sign-up";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  // The page reads the address's query string, which is only known in the browser.
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}
