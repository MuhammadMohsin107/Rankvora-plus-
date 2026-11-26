"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ApiRequestError, authApi, safeNextPath } from "@/lib/api-client";
import { useSession } from "@/features/session/session";

import { AuthCard, authLink, FormError, FormNote, messageOf, PasswordField } from "./auth-ui";

type Step = "password" | "code" | "backup";

export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { state, refresh } = useSession();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Someone already signed in goes straight on.
  useEffect(() => {
    if (state.status === "ready") router.replace(next);
  }, [state.status, next, router]);

  const finish = async () => {
    await refresh();
    router.replace(next);
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    const missing = { email: email.trim() ? undefined : "Enter your email.", password: password ? undefined : "Enter your password." };
    setErrors(missing);
    if (missing.email || missing.password) return;
    setBusy(true);
    setError(null);
    setUnconfirmed(false);
    try {
      const result = await authApi<{ twoFactorRedirect?: boolean }>("/sign-in/email", { email: email.trim(), password });
      if (result.twoFactorRedirect) setStep("code");
      else await finish();
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "EMAIL_NOT_VERIFIED") {
        setUnconfirmed(true);
        setError("Confirm your email address first.");
      } else if (failure instanceof ApiRequestError && failure.status === 401) setError("Wrong email or password.");
      else setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return setErrors({ code: "Enter the code." });
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      await authApi(step === "backup" ? "/two-factor/verify-backup-code" : "/two-factor/verify-totp", { code: code.trim() });
      await finish();
    } catch (failure) {
      setError(failure instanceof ApiRequestError && failure.status < 500 && failure.status !== 429 ? "That code was not accepted." : messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await authApi("/send-verification-email", { email: email.trim() });
      setResent(true);
      setUnconfirmed(false);
      setError(null);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (step !== "password") {
    return (
      <AuthCard
        title="Two-step verification"
        footer={
          <button type="button" className={`${authLink} cursor-pointer`} onClick={() => { setStep(step === "code" ? "backup" : "code"); setCode(""); setError(null); }}>
            {step === "code" ? "Use a backup code" : "Use your authenticator app"}
          </button>
        }
      >
        <FormError message={error} />
        <form noValidate onSubmit={submitCode} className="flex flex-col gap-3">
          <Field label={step === "code" ? "Authenticator code" : "Backup code"} required error={errors.code}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} autoFocus autoComplete="one-time-code" inputMode={step === "code" ? "numeric" : "text"} value={code} onChange={(event) => setCode(event.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={busy}>Verify</Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          <Link href={next === "/stores" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`} className={authLink}>Create an account</Link>
          <Link href="/forgot-password" className={authLink}>Forgot password?</Link>
        </>
      }
    >
      <FormError message={error} />
      {resent ? <FormNote>If the address needs confirming, a new link is on its way.</FormNote> : null}
      {unconfirmed ? <Button variant="secondary" onClick={resend} loading={busy}>Send the confirmation email again</Button> : null}
      <form noValidate onSubmit={submitPassword} className="flex flex-col gap-3">
        <Field label="Email" required error={errors.email}>
          {({ id, describedBy, invalid }) => <Input id={id} type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} value={email} onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        <PasswordField label="Password" autoComplete="current-password" value={password} onValue={setPassword} error={errors.password} />
        <Button type="submit" variant="primary" size="lg" loading={busy}>Sign in</Button>
      </form>
    </AuthCard>
  );
}
