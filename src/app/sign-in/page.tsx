import type { Metadata } from "next";
import { Suspense } from "react";

import { SignIn } from "@/features/auth/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  // The page reads the address's query string, which is only known in the browser.
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
