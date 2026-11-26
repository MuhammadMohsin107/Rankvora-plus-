import type { Metadata } from "next";

import { Welcome } from "@/features/auth/welcome";

export const metadata: Metadata = { title: "Create organization" };

export default function Page() {
  return <Welcome />;
}
