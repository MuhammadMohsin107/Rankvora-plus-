"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { authApi, safeNextPath } from "@/lib/api-client";

import { AuthCard, authLink, FormError, FormNote, messageOf, PasswordField } from "./auth-ui";

const MIN_PASSWORD = 12;

export function SignUp() {
  const next = safeNextPath(useSearchParams().get("next"));
  const signInHref = next === "/stores" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = {
      name: name.trim().length >= 2 ? undefined : "Enter your name.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : "Enter a valid email address.",
      password: password.length >= MIN_PASSWORD ? undefined : `Use at least ${MIN_PASSWORD} characters.`,
    };
    setErrors(found);
    if (found.name || found.email || found.password) return;
    setBusy(true);
    setError(null);
    try {
      await authApi("/sign-up/email", { name: name.trim(), email: email.trim(), password });
      setSentTo(email.trim());
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthCard title="Check your email" footer={<Link href={signInHref} className={authLink}>Sign in</Link>}>
        {/* The server answers the same for new and existing addresses, so this does not say which it was. */}
        <FormNote>
          We sent an email to <strong className="font-semibold">{sentTo}</strong>. Follow its link, then sign in.
        </FormNote>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" footer={<Link href={signInHref} className={authLink}>I already have an account</Link>}>
      <FormError message={error} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Your name" required error={errors.name}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" aria-describedby={describedBy} invalid={invalid} value={name} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Field label="Email" required error={errors.email}>
          {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} value={email} onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        <PasswordField label="Password" autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters`} value={password} onValue={setPassword} error={errors.password} />
        <Button type="submit" variant="primary" size="lg" loading={busy}>Create account</Button>
      </form>
    </AuthCard>
  );
}
