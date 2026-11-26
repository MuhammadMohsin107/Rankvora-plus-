"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ApiRequestError, authApi } from "@/lib/api-client";

import { AuthCard, authLink, FormError, FormNote, messageOf, PasswordField } from "./auth-ui";

const MIN_PASSWORD = 12;
const backToSignIn = <Link href="/sign-in" className={authLink}>Back to sign in</Link>;

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return setFieldError("Enter your email.");
    setFieldError(undefined);
    setBusy(true);
    setError(null);
    try {
      await authApi("/request-password-reset", { email: email.trim(), redirectTo: "/reset-password" });
      setSent(true);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Reset your password" footer={backToSignIn}>
      {sent ? (
        <FormNote>If an account uses that address, a reset link is on its way. It works for one hour.</FormNote>
      ) : (
        <>
          <FormError message={error} />
          <form noValidate onSubmit={submit} className="flex flex-col gap-3">
            <Field label="Email" required error={fieldError}>
              {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} value={email} onChange={(event) => setEmail(event.target.value)} />}
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={busy}>Send reset link</Button>
          </form>
        </>
      )}
    </AuthCard>
  );
}

/** Where the emailed link lands: with `token`, or with `error` when the link no longer works. */
export function ResetPassword() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(Boolean(params.get("error")) || !token);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) return setFieldError(`Use at least ${MIN_PASSWORD} characters.`);
    setFieldError(undefined);
    setBusy(true);
    setError(null);
    try {
      await authApi("/reset-password", { token, newPassword: password });
      setDone(true);
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "INVALID_TOKEN") setExpired(true);
      else setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthCard title="Password changed">
        <FormNote>Every device was signed out. Sign in with your new password.</FormNote>
        <ButtonLink href="/sign-in" variant="primary" size="lg">Sign in</ButtonLink>
      </AuthCard>
    );
  }
  if (expired) {
    return (
      <AuthCard title="This link no longer works" footer={backToSignIn}>
        <p className="text-body-sm text-fg-muted">Reset links work once, for one hour.</p>
        <ButtonLink href="/forgot-password" variant="primary" size="lg">Send a new link</ButtonLink>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" footer={backToSignIn}>
      <FormError message={error} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <PasswordField label="New password" autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters`} value={password} onValue={setPassword} error={fieldError} />
        <Button type="submit" variant="primary" size="lg" loading={busy}>Change password</Button>
      </form>
    </AuthCard>
  );
}
