import type { Metadata } from "next";

import { ForgotPassword } from "@/features/auth/password-reset";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <ForgotPassword />;
}
