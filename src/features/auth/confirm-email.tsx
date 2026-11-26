"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { ApiRequestError, authApi } from "@/lib/api-client";

import { AuthCard, authLink, FormError, FormNote, messageOf, PasswordField } from "./auth-ui";

/** Where the confirmation link lands. It takes the password too, and signs nobody in. */
export function ConfirmEmail() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"form" | "confirmed" | "bad-link">(token ? "form" : "bad-link");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldError(password ? undefined : "Enter your password.");
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await authApi("/confirm-email", { token, password });
      setStatus("confirmed");
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "INVALID_TOKEN") setStatus("bad-link");
      else if (failure instanceof ApiRequestError && failure.code === "INVALID_PASSWORD") setFieldError(failure.message);
      else setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (status === "bad-link") {
    return (
      <AuthCard title="This link no longer works" footer={<Link href="/sign-up" className={authLink}>Create an account</Link>}>
        <p className="text-body-sm text-fg-muted">Sign in to send a new confirmation email.</p>
        <ButtonLink href="/sign-in" variant="primary" size="lg">Sign in</ButtonLink>
      </AuthCard>
    );
  }

  if (status === "confirmed") {
    return (
      <AuthCard title="Email confirmed">
        <FormNote>Your address is confirmed.</FormNote>
        <ButtonLink href="/sign-in" variant="primary" size="lg">Sign in</ButtonLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm your email" footer={<Link href="/forgot-password" className={authLink}>Forgot password?</Link>}>
      <FormError message={error} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <PasswordField label="Password" hint="The one you chose at sign-up" autoComplete="current-password" value={password} onValue={setPassword} error={fieldError} />
        <Button type="submit" variant="primary" size="lg" loading={busy}>Confirm email</Button>
      </form>
    </AuthCard>
  );
}
