import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";

import { HelpCenter } from "./help-center";

export const metadata: Metadata = { title: "Help & Support" };

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help & Support" subtitle="Answers, guides and a way to reach us." />
      <HelpCenter />
    </>
  );
}
