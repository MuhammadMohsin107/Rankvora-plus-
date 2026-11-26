"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";

import { AuthCard, authLink, FormNote } from "./auth-ui";

/** Where the confirmation link lands. Confirming never signs anyone in. */
export function Verified() {
  const failed = Boolean(useSearchParams().get("error"));
  if (failed) {
    return (
      <AuthCard title="This link no longer works" footer={<Link href="/sign-up" className={authLink}>Create an account</Link>}>
        <p className="text-body-sm text-fg-muted">Sign in to send a new confirmation email.</p>
        <ButtonLink href="/sign-in" variant="primary" size="lg">Sign in</ButtonLink>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Email confirmed">
      <FormNote>Your address is confirmed.</FormNote>
      <ButtonLink href="/sign-in" variant="primary" size="lg">Sign in</ButtonLink>
    </AuthCard>
  );
}
