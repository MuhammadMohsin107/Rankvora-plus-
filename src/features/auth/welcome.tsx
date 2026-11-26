"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useSession } from "@/features/session/session";
import { api, ApiRequestError, newIdempotencyKey } from "@/lib/api-client";

import { AuthCard, authLink, FormError, messageOf } from "./auth-ui";

const zones = () => Intl.supportedValuesOf("timeZone");
const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const noSubscribe = () => () => {};

/** A new account's first step: the organization that will hold its websites. */
export function Welcome() {
  const router = useRouter();
  const { state, refresh, signOut } = useSession();
  const detected = useSyncExternalStore(noSubscribe, localZone, () => "UTC");
  const [name, setName] = useState("");
  const [chosenZone, setZone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const zone = chosenZone ?? detected;

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/sign-in?next=/welcome");
  }, [state.status, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return setErrors({ name: "Enter a name of at least 2 characters." });
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/organizations", { method: "POST", body: { name: name.trim(), timezone: zone }, idempotencyKey: `${key}-${name.trim().length}` });
      await refresh();
      router.replace("/stores");
    } catch (failure) {
      if (failure instanceof ApiRequestError && Object.keys(failure.fields).length) setErrors(failure.fields);
      else setError(messageOf(failure));
      setBusy(false);
    }
  };

  const options = state.status === "ready" ? zones() : [zone];

  return (
    <AuthCard title="Create your organization" footer={<button type="button" className={`${authLink} cursor-pointer`} onClick={() => void signOut()}>Sign out</button>}>
      <FormError message={error} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Organization name" required error={errors.name}>
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-describedby={describedBy} invalid={invalid} value={name} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Field label="Time zone" error={errors.timezone}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} value={zone} onChange={(event) => setZone(event.target.value)}>
              {(options.includes(zone) ? options : [zone, ...options]).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={state.status !== "ready"}>Create organization</Button>
      </form>
    </AuthCard>
  );
}
